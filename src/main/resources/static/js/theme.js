import { requestJSON } from "/js/api.js";

const THEME_STORAGE_KEY = "journal_theme";
const THEMES = ["dark", "oled", "light"];

const SVG_ICONS = {
  moon: `<svg class="theme-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
  contrast: `<svg class="theme-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"></path></svg>`,
  sun: `<svg class="theme-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
};

const THEME_META = {
  dark:  { icon: SVG_ICONS.moon,     label: "Dracula Dark", nextLabel: "Включить режим OLED" },
  oled:  { icon: SVG_ICONS.contrast, label: "OLED Pitch",   nextLabel: "Включить светлую тему" },
  light: { icon: SVG_ICONS.sun,      label: "Alabaster",    nextLabel: "Включить тему Dracula" }
};

/** Координаты смещения градиента для каждой вкладки страницы */
const AURORA_STATES = {
  home:     { x1: "50%", y1: "15%", x2: "50%", y2: "75%", c1: "rgba(189, 147, 249, 0.28)", c2: "rgba(255, 121, 198, 0.16)" },
  groups:   { x1: "12%", y1: "18%", x2: "78%", y2: "65%", c1: "rgba(189, 147, 249, 0.22)", c2: "rgba(255, 121, 198, 0.14)" },
  subjects: { x1: "32%", y1: "12%", x2: "62%", y2: "75%", c1: "rgba(167, 139, 250, 0.24)", c2: "rgba(139, 233, 253, 0.12)" },
  students: { x1: "52%", y1: "22%", x2: "20%", y2: "70%", c1: "rgba(192, 132, 252, 0.22)", c2: "rgba(244, 114, 182, 0.15)" },
  journal:  { x1: "72%", y1: "16%", x2: "28%", y2: "60%", c1: "rgba(139, 92, 246, 0.25)",  c2: "rgba(236, 72, 153, 0.16)" },
  reports:  { x1: "88%", y1: "28%", x2: "15%", y2: "50%", c1: "rgba(217, 70, 239, 0.22)",  c2: "rgba(129, 140, 248, 0.16)" }
};

export function getCurrentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (THEMES.includes(attr)) return attr;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch (e) {}
  return "dark";
}

export function setTheme(theme) {
  const chosen = THEMES.includes(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", chosen);
  try { localStorage.setItem(THEME_STORAGE_KEY, chosen); } catch (e) {}
  updateThemeButton(chosen);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: chosen } }));
  return chosen;
}

export function toggleTheme() {
  const current = getCurrentTheme();
  return setTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]);
}

function updateThemeButton(theme) {
  const btn = document.querySelector("#theme-toggle");
  if (!btn) return;
  const meta = THEME_META[theme] || THEME_META.dark;
  const icon = btn.querySelector(".theme-toggle-icon");
  const text = btn.querySelector(".theme-toggle-text");
  if (icon) icon.innerHTML = meta.icon;
  if (text) text.textContent = meta.label;
  btn.setAttribute("title", `${meta.nextLabel} (Alt+T)`);
}

/* ==========================================================================
   1. ПЛАВНОЕ СМЕЩЕНИЕ ГРАДИЕНТА И КАРЕТКИ ВКЛАДОК (SLIDING GLIDER)
   ========================================================================== */

function applyAuroraForKey(key) {
  const state = AURORA_STATES[key] || AURORA_STATES.groups;
  const root = document.documentElement;
  root.style.setProperty("--aurora-x1", state.x1);
  root.style.setProperty("--aurora-y1", state.y1);
  root.style.setProperty("--aurora-x2", state.x2);
  root.style.setProperty("--aurora-y2", state.y2);
  root.style.setProperty("--aurora-c1", state.c1);
  root.style.setProperty("--aurora-c2", state.c2);
}

function initSlidingNavigation() {
  const nav = document.querySelector("#main-nav");
  const glider = document.querySelector("#nav-glider");
  if (!nav || !glider) return;

  const activeLink = nav.querySelector('a[aria-current="page"]') || nav.querySelector("a");
  if (!activeLink) return;

  const currentKey = activeLink.dataset.nav || (window.location.pathname === "/" ? "home" : "groups");
  const prevKey = sessionStorage.getItem("journal_prev_nav_key");
  const prevRectRaw = sessionStorage.getItem("journal_prev_nav_rect");

  // Ставим градиент активного раздела
  applyAuroraForKey(currentKey);

  const targetRect = activeLink.getBoundingClientRect();
  const navRect = nav.getBoundingClientRect();
  const targetLeft = targetRect.left - navRect.left;

  // Если был сохранён предыдущий прямоугольник, плавно перемещаем каретку от него к текущей вкладке
  if (prevRectRaw) {
    try {
      const prev = JSON.parse(prevRectRaw);
      glider.style.transition = "none";
      glider.style.width = `${prev.width}px`;
      glider.style.transform = `translateX(${prev.left}px)`;
      glider.style.opacity = "1";
    } catch (e) {}
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      glider.style.transition = "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), width 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
      glider.style.width = `${targetRect.width}px`;
      glider.style.transform = `translateX(${targetLeft}px)`;
      glider.style.opacity = "1";
    });
  });

  // Рамка смещается ТОЛЬКО при нажатии на вкладку!
  // При наведении на вкладку срабатывает отдельное подчёркивание в CSS (.navigation a:hover::after)
  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      const r = link.getBoundingClientRect();
      const nr = nav.getBoundingClientRect();
      const nextLeft = r.left - nr.left;
      glider.style.transition = "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), width 0.35s cubic-bezier(0.22, 1, 0.36, 1)";
      glider.style.width = `${r.width}px`;
      glider.style.transform = `translateX(${nextLeft}px)`;
      if (link.dataset.nav) applyAuroraForKey(link.dataset.nav);
      sessionStorage.setItem("journal_prev_nav_rect", JSON.stringify({ left: nextLeft, width: r.width }));
      sessionStorage.setItem("journal_prev_nav_key", link.dataset.nav || "groups");
    });
  });

  // При изменении размера окна синхронизируем ширину и положение каретки с активной вкладкой
  window.addEventListener("resize", () => {
    const r = activeLink.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    glider.style.transition = "none";
    glider.style.width = `${r.width}px`;
    glider.style.transform = `translateX(${r.left - nr.left}px)`;
  });

  // Смещение градиента при переключении внутренних табов (например, в Отчётах)
  document.querySelectorAll(".view-tab-btn").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      const keys = ["reports", "journal", "students"];
      applyAuroraForKey(keys[idx % keys.length]);
    });
  });
}

/* ==========================================================================
   2. ШТОРКА «РЕНТГЕН ЛОГИКИ» (X-RAY BACKEND LOGIC DRAWER)
   ========================================================================== */

const apiTraces = [];
const XRAY_WIDTH_STORAGE_KEY = "journal_xray_width";

function applyXRayWidth(widthPx) {
  const minW = 280;
  const maxW = Math.max(300, Math.round(window.innerWidth * 0.82));
  const clamped = Math.max(minW, Math.min(widthPx, maxW));
  document.documentElement.style.setProperty("--xray-width", `${clamped}px`);
  try {
    localStorage.setItem(XRAY_WIDTH_STORAGE_KEY, String(clamped));
  } catch (e) {}
  return clamped;
}

function initXRayInspector() {
  if (document.querySelector("#xray-drawer")) return;

  const savedWidth = parseInt(localStorage.getItem(XRAY_WIDTH_STORAGE_KEY), 10) || 440;
  applyXRayWidth(savedWidth);

  const drawer = document.createElement("aside");
  drawer.id = "xray-drawer";
  drawer.className = "xray-drawer";
  drawer.setAttribute("aria-label", "Инспектор логики и SQL-запросов");
  drawer.setAttribute("aria-hidden", "true");

  drawer.innerHTML = `
    <!-- Ручка изменения размера панели -->
    <div class="xray-resizer" id="xray-resizer" title="Потяните для изменения ширины панели"></div>
    <div class="xray-header">
      <div>
        <div class="xray-title"><svg class="btn-icon brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Рентген внутренней логики</div>
        <div class="xray-subtitle">Цепочка: HTTP Ручка → Spring Service → SQLite</div>
      </div>
      <div class="xray-header-actions">
        <button id="xray-clear" class="xray-mini-btn" type="button" title="Очистить лог">Очистить</button>
        <button id="xray-close" class="xray-mini-btn" type="button" title="Закрыть панель (Alt+L)">✕</button>
      </div>
    </div>
    <div id="xray-feed" class="xray-feed">
      <div class="xray-empty">Выполните любое действие на странице (добавьте запись, выставьте оценку или отфильтруйте список), чтобы увидеть выполняемый код и SQL.</div>
    </div>
  `;
  document.body.append(drawer);

  const toggleBtn = document.querySelector("#xray-toggle-btn");
  const closeBtn = drawer.querySelector("#xray-close");
  const clearBtn = drawer.querySelector("#xray-clear");
  const feed = drawer.querySelector("#xray-feed");
  const counter = document.querySelector("#xray-counter");
  const resizer = drawer.querySelector("#xray-resizer");

  function isDrawerOpen() {
    return document.body.classList.contains("xray-open");
  }

  function setDrawerOpen(open) {
    document.body.classList.toggle("xray-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    sessionStorage.setItem("journal_xray_open", String(open));
    if (toggleBtn) toggleBtn.classList.toggle("active", open);
    if (open) {
      const curW = parseInt(localStorage.getItem(XRAY_WIDTH_STORAGE_KEY), 10) || 440;
      applyXRayWidth(curW);
    }
  }

  function toggleDrawer() {
    setDrawerOpen(!isDrawerOpen());
  }

  if (toggleBtn) toggleBtn.addEventListener("click", toggleDrawer);
  if (closeBtn) closeBtn.addEventListener("click", () => setDrawerOpen(false));
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      apiTraces.length = 0;
      if (counter) counter.textContent = "0";
      feed.innerHTML = `<div class="xray-empty">Журнал вызовов очищен. Ожидание действий...</div>`;
    });
  }

  // Интерактивное изменение ширины панели (drag-to-resize)
  let isDragging = false;
  let startX = 0;
  let startW = 440;

  resizer.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startW = drawer.getBoundingClientRect().width;
    document.body.classList.add("xray-resizing");
    resizer.setPointerCapture(e.pointerId);
  });

  resizer.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const deltaX = startX - e.clientX; // сдвиг влево увеличивает ширину
    applyXRayWidth(startW + deltaX);
  });

  function stopDragging(e) {
    if (!isDragging) return;
    isDragging = false;
    document.body.classList.remove("xray-resizing");
    try {
      resizer.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  resizer.addEventListener("pointerup", stopDragging);
  resizer.addEventListener("pointercancel", stopDragging);

  window.addEventListener("resize", () => {
    const curW = parseInt(localStorage.getItem(XRAY_WIDTH_STORAGE_KEY), 10) || 440;
    applyXRayWidth(curW);
  });

  // Сохранение состояния открытости шторки между переходами по страницам
  if (sessionStorage.getItem("journal_xray_open") === "true") {
    setDrawerOpen(true);
  } else {
    setDrawerOpen(false);
  }

  function renderTraceCard(t) {
    const empty = feed.querySelector(".xray-empty");
    if (empty) empty.remove();

    const card = document.createElement("div");
    card.className = "xray-card";
    const methodClass = `m-${t.method.toLowerCase()}`;
    const payloadHtml = t.payload
      ? `<div class="xray-payload"><span>Тело JSON:</span> <code>${JSON.stringify(t.payload)}</code></div>`
      : "";

    card.innerHTML = `
      <div class="xray-card-top">
        <span class="xray-method ${methodClass}">${t.method}</span>
        <span class="xray-url">${t.url}</span>
        <span class="xray-meta">${t.status} • ${t.durationMs} ms</span>
      </div>
      ${payloadHtml}
      <div class="xray-pipeline">
        <div class="xray-step">
          <span class="step-tag">Controller</span>
          <code>${t.controller}</code>
        </div>
        <div class="xray-step">
          <span class="step-tag">Service</span>
          <code>${t.service}</code>
          ${t.tx ? '<span class="tx-badge">@Transactional</span>' : ""}
        </div>
        <div class="xray-step">
          <span class="step-tag">Repository</span>
          <code>${t.repo}</code>
        </div>
      </div>
      <div class="xray-sql-box">
        <div class="xray-sql-label">SQLite (JdbcClient):</div>
        <pre class="xray-sql-code">${t.sql}</pre>
      </div>
    `;
    feed.prepend(card);
  }

  window.addEventListener("journal:apicall", (e) => {
    const trace = e.detail;
    apiTraces.unshift(trace);
    if (counter) {
      counter.textContent = String(apiTraces.length);
      counter.classList.remove("bump");
      void counter.offsetWidth;
      counter.classList.add("bump");
    }
    renderTraceCard(trace);

    // Синхронный неоновый импульс логотипа и лазерной полосы в шапке
    const brandGlyph = document.querySelector(".brand-glyph");
    if (brandGlyph) {
      brandGlyph.classList.remove("pulse-active");
      void brandGlyph.offsetWidth;
      brandGlyph.classList.add("pulse-active");
      setTimeout(() => brandGlyph.classList.remove("pulse-active"), 400);
    }
    const header = document.querySelector(".site-header");
    if (header) {
      header.classList.remove("laser-flash");
      void header.offsetWidth;
      header.classList.add("laser-flash");
      setTimeout(() => header.classList.remove("laser-flash"), 450);
    }
  });
}

/* ==========================================================================
   3. ВСТРОЕННЫЙ LINUX-ТЕРМИНАЛ (GHOSTTY + FISH + RANGER VFS)
   ========================================================================== */

const VFS = {
  "/home/milk13": {
    type: "dir",
    children: ["bspwm-dotfiles", "claude-mem", "IdeaProjects"]
  },
  "/home/milk13/bspwm-dotfiles": {
    type: "dir",
    children: ["bspwmrc", "sxhkdrc", "polybar.ini"]
  },
  "/home/milk13/bspwm-dotfiles/bspwmrc": {
    type: "file",
    content: `#! /bin/sh\nbspc monitor -d 1 2 3 4 5 6 7 8 9\nbspc config border_width         2\nbspc config window_gap           8\nbspc config focused_border_color "#bd93f9"\nbspc config normal_border_color  "#282a36"`
  },
  "/home/milk13/bspwm-dotfiles/sxhkdrc": {
    type: "file",
    content: `super + Return\n\tghostty\nsuper + d\n\trofi -show drun`
  },
  "/home/milk13/bspwm-dotfiles/polybar.ini": {
    type: "file",
    content: `[bar/main]\nfont-0 = "JetBrainsMono Nerd Font:size=11;2"\nbackground = #0b0a10\nforeground = #f8f8f2`
  },
  "/home/milk13/claude-mem": {
    type: "dir",
    children: ["notes.md"]
  },
  "/home/milk13/claude-mem/notes.md": {
    type: "file",
    content: `# Архив контекста\n- Сеть: Split DNS + AmneziaWG\n- Проект: Электронный журнал (Java 21 + Spring Boot 3.3.5 + SQLite WAL)`
  },
  "/home/milk13/IdeaProjects": {
    type: "dir",
    children: ["jrnl"]
  },
  "/home/milk13/IdeaProjects/jrnl": {
    type: "dir",
    children: ["pom.xml", "README.md", "src", "instance"]
  },
  "/home/milk13/IdeaProjects/jrnl/pom.xml": {
    type: "file",
    content: `<project>\n  <groupId>ru.edu</groupId>\n  <artifactId>journal</artifactId>\n  <version>1.0.0</version>\n  <properties>\n    <java.version>21</java.version>\n    <spring-boot.version>3.3.5</spring-boot.version>\n    <sqlite-jdbc.version>3.47.1.0</sqlite-jdbc.version>\n  </properties>\n</project>`
  },
  "/home/milk13/IdeaProjects/jrnl/README.md": {
    type: "file",
    content: `# Электронный журнал успеваемости\nСтек: Java 21, Spring Boot 3.3.5, SQLite (WAL), Thymeleaf, Apache POI 5.3.0.\nКоманды: --prepare, --check-baseline, --check-rollback.`
  },
  "/home/milk13/IdeaProjects/jrnl/instance": {
    type: "dir",
    children: ["journal.db", "journal.db-wal"]
  },
  "/home/milk13/IdeaProjects/jrnl/instance/journal.db": {
    type: "file",
    content: `[SQLite format 3 binary database: tables = groups, students, subjects, grades]\nПодсказка: введите 'sql groups' или 'sql students' для живого запроса к БД!`
  },
  "/home/milk13/IdeaProjects/jrnl/src": {
    type: "dir",
    children: ["main", "test"]
  },
  "/home/milk13/IdeaProjects/jrnl/src/main": {
    type: "dir",
    children: ["java", "resources"]
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/resources": {
    type: "dir",
    children: ["application.properties", "schema.sql"]
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/resources/application.properties": {
    type: "file",
    content: `server.port=5000\nspring.application.name=journal\napp.db.path=instance/journal.db\napp.db.auto-init=true`
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/resources/schema.sql": {
    type: "file",
    content: `CREATE TABLE groups (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);\nCREATE TABLE subjects (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);\nCREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, group_id INTEGER REFERENCES groups(id), email TEXT);\nCREATE TABLE grades (id INTEGER PRIMARY KEY, student_id INTEGER REFERENCES students(id), subject_id INTEGER REFERENCES subjects(id), mark INTEGER CHECK(mark IN (2,3,4,5)));`
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/java": {
    type: "dir",
    children: ["JournalApplication.java", "DatabaseConfig.java", "GroupController.java", "JournalService.java", "StudentService.java"]
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/java/JournalApplication.java": {
    type: "file",
    content: `@SpringBootApplication\npublic class JournalApplication implements CommandLineRunner {\n    public static void main(String[] args) {\n        SpringApplication.run(JournalApplication.class, args);\n    }\n}`
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/java/DatabaseConfig.java": {
    type: "file",
    content: `@Configuration\npublic class DatabaseConfig {\n    @Bean\n    public DataSource dataSource() {\n        SQLiteConfig config = new SQLiteConfig();\n        config.enforceForeignKeys(true);\n        config.setJournalMode(SQLiteConfig.JournalMode.WAL);\n        return new SQLiteDataSource(config);\n    }\n}`
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/java/GroupController.java": {
    type: "file",
    content: `@Controller\npublic class GroupController {\n    @GetMapping("/api/groups") @ResponseBody\n    public Map<String, Object> listGroups() { return Map.of("items", groupService.listGroups()); }\n}`
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/java/JournalService.java": {
    type: "file",
    content: `@Service\npublic class JournalService {\n    @Transactional\n    public GradeDto saveGrade(GradeSaveRequest req) { /* Upsert 2..5 */ }\n}`
  },
  "/home/milk13/IdeaProjects/jrnl/src/main/java/StudentService.java": {
    type: "file",
    content: `@Service\npublic class StudentService {\n    @Transactional\n    public void deleteStudent(Long id, boolean simulateError) {\n        studentRepository.deleteGrades(id);\n        studentRepository.delete(id);\n    }\n}`
  },
  "/home/milk13/IdeaProjects/jrnl/src/test": {
    type: "dir",
    children: ["DatabaseBaselineTest.java", "RollbackTest.java", "JournalIntegrationTest.java"]
  },
  "/home/milk13/IdeaProjects/jrnl/src/test/RollbackTest.java": {
    type: "file",
    content: `@SpringBootTest\nclass RollbackTest {\n    // Проверяет откат @Transactional при сбое посередине удаления студента\n}`
  }
};

/* ==========================================================================
   3. ВСТРОЕННЫЙ LINUX-ТЕРМИНАЛ (PAM AUTH + TUI IDE + FISH SHELL)
   ========================================================================== */

const SVG_ICONS_PACK = {
  home: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
  groups: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  subjects: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
  students: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
  journal: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
  reports: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>`,
  terminal: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
  xray: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  theme: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"></path></svg>`,
  excel: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
  csv: `<svg class="cmd-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
  key: `<svg class="pam-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="M21 2l-9.6 9.6"></path><path d="M15.5 7.5l3 3"></path></svg>`,
  java: `<svg class="f-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`,
  test: `<svg class="f-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2v7.31"></path><path d="M14 9.3V2"></path><path d="M8.5 2h7"></path><path d="M14 9.3a6.5 6.5 0 1 1-4 0"></path><path d="M5.52 16h12.96"></path></svg>`,
  sql: `<svg class="f-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
  config: `<svg class="f-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  xml: `<svg class="f-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  doc: `<svg class="f-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
  folder: `<svg class="f-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
};

const PAM_VALID_PASSWORDS = ["admin", "milk13", "root", "1234"];
const PAM_AUTH_KEY = "journal_term_auth";

const IDE_KEY_FILES = [
  { path: "/home/milk13/IdeaProjects/jrnl/src/main/java/JournalApplication.java", name: "JournalApplication.java", lang: "Java 21", icon: SVG_ICONS_PACK.java },
  { path: "/home/milk13/IdeaProjects/jrnl/src/test/RollbackTest.java", name: "RollbackTest.java", lang: "Java 21 Test", icon: SVG_ICONS_PACK.test },
  { path: "/home/milk13/IdeaProjects/jrnl/src/main/java/GroupController.java", name: "GroupController.java", lang: "Java 21", icon: SVG_ICONS_PACK.java },
  { path: "/home/milk13/IdeaProjects/jrnl/src/main/java/JournalService.java", name: "JournalService.java", lang: "Java 21", icon: SVG_ICONS_PACK.java },
  { path: "/home/milk13/IdeaProjects/jrnl/src/main/java/StudentService.java", name: "StudentService.java", lang: "Java 21", icon: SVG_ICONS_PACK.java },
  { path: "/home/milk13/IdeaProjects/jrnl/src/main/resources/schema.sql", name: "schema.sql", lang: "SQL DDL", icon: SVG_ICONS_PACK.sql },
  { path: "/home/milk13/IdeaProjects/jrnl/src/main/resources/application.properties", name: "application.properties", lang: "Properties", icon: SVG_ICONS_PACK.config },
  { path: "/home/milk13/IdeaProjects/jrnl/pom.xml", name: "pom.xml", lang: "Maven XML", icon: SVG_ICONS_PACK.xml },
  { path: "/home/milk13/IdeaProjects/jrnl/README.md", name: "README.md", lang: "Markdown", icon: SVG_ICONS_PACK.doc }
];

function initLinuxTerminal() {
  if (document.querySelector("#linux-term-overlay")) return;

  let cwd = "/home/milk13/IdeaProjects/jrnl";
  let activeIdeFile = IDE_KEY_FILES[0].path;
  let viewMode = "ide"; // "ide" | "ranger"
  let rangerIdx = 0;
  const history = [];
  let histIdx = -1;

  const overlay = document.createElement("div");
  overlay.id = "linux-term-overlay";
  overlay.className = "term-overlay";
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="term-window" role="dialog" aria-modal="true" aria-label="Linux Terminal milk13@archarnel">
      <div class="term-titlebar">
        <div class="term-title-left">
          <span class="term-arch-icon">A</span>
          <span id="term-title-text">ghostty — fish — milk13@archarnel: <span id="term-title-cwd">~/IdeaProjects/jrnl</span></span>
        </div>
        <div class="term-title-actions">
          <button id="term-btn-mode-ide" class="term-top-btn active" type="button" title="Переключить TUI Редактор"><svg class="term-top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg> IDE + Shell</button>
          <button id="term-btn-mode-ranger" class="term-top-btn" type="button" title="Файловый менеджер Ranger"><svg class="term-top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> ranger</button>
          <button id="term-btn-run" class="term-top-btn run-btn" type="button" title="Запустить проверку текущего файла (команда 'run')"><svg class="term-top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Run / Verify</button>
          <button id="term-btn-lock" class="term-top-btn lock-btn" type="button" title="Заблокировать сессию терминала (PAM Lock)"><svg class="term-top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Lock</button>
          <button id="term-btn-close" class="term-top-btn close" type="button" title="Закрыть (Esc)">✕</button>
        </div>
      </div>

      <!-- ЭКРАН 1: PAM SUDO GATE (ВХОД АДМИНИСТРАТОРА) -->
      <div id="term-pam-gate" class="term-pam-gate" hidden>
        <div class="pam-auth-box">
          <div class="pam-badge">PAM Security Subsystem v2.1</div>
          <pre class="pam-ascii-logo">
   ____  ____  __  ____      ____  ___  ______   ______
  / __ \\/ __ \\/ / / / /     / __ \\/   |/  _/ /  / ____/
 / /_/ / / / / / / / /     / /_/ / /| |  / // /  / __/   
/ ____/ /_/ / /_/ / /___  / ____/ ___ |_/ // /__/ /___   
/_/    \\____/\\____/_____/ /_/   /_/  |_/___/_____/_____/   
          </pre>
          <div class="pam-prompt-title">Аутентификация sudo для пользователя <span class="pam-user">milk13@archarnel</span></div>
          <div class="pam-subtitle">Доступ к внутреннему TUI редактору, тестам транзакций и консоли Spring Boot</div>
          <form id="pam-form" class="pam-form">
            <div class="pam-input-wrap">
              <span class="pam-key-icon">${SVG_ICONS_PACK.key}</span>
              <input id="pam-password-input" class="pam-input" type="password" autocomplete="off" placeholder="Введите пароль администратора..." autofocus>
              <button type="submit" class="button-primary pam-submit-btn">Войти</button>
            </div>
            <div id="pam-error-msg" class="pam-error-msg" hidden></div>
            <div class="pam-footer-row">
              <button type="button" id="pam-auto-auth-btn" class="button-secondary pam-quick-btn">⚡ Быстрый вход (Auto-Auth: milk13)</button>
              <span class="pam-hint">Подсказка: пароли <code>admin</code>, <code>milk13</code>, <code>root</code>, <code>1234</code></span>
            </div>
          </form>
        </div>
      </div>

      <!-- ЭКРАН 2: РАБОЧЕЕ ОКРУЖЕНИЕ (TUI IDE SPLIT + SHELL) -->
      <div id="term-workspace" class="term-workspace">
        
        <!-- ВЕРХНЯЯ ЧАСТЬ: TUI CODE EDITOR (MICRO/NVIM STYLE) -->
        <div id="term-ide-pane" class="term-ide-pane">
          <div class="ide-sidebar">
            <div class="ide-sidebar-title">ПРОЕКТ: JRNL</div>
            <div id="ide-file-list" class="ide-file-list"></div>
          </div>
          <div class="ide-editor-area">
            <div class="ide-editor-tabbar">
              <div class="ide-tab active">
                <span id="ide-tab-icon" class="ide-tab-icon"></span>
                <span id="ide-tab-name" class="ide-tab-name">JournalApplication.java</span>
                <span id="ide-tab-lang" class="ide-tab-lang">Java 21</span>
              </div>
              <div class="ide-tab-actions">
                <button type="button" id="ide-btn-save" class="ide-mini-btn" title="Сохранить в VFS (Ctrl+S)"><svg class="term-top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Сохранить (Ctrl+S)</button>
              </div>
            </div>
            <div class="ide-editor-container">
              <div id="ide-lines" class="ide-lines"></div>
              <textarea id="ide-textarea" class="ide-textarea" spellcheck="false" wrap="off"></textarea>
            </div>
            <div id="ide-statusbar" class="ide-statusbar">
              <span class="st-mode">NORMAL</span>
              <span id="st-filename" class="st-file">JournalApplication.java</span>
              <span class="st-encoding">UTF-8</span>
              <span id="st-lines" class="st-lines">24 строк</span>
              <span class="st-hint">[Ctrl+S] Сохранить • [run] Проверить</span>
            </div>
          </div>
        </div>

        <!-- АЛЬТЕРНАТИВНАЯ ВЕРХНЯЯ ЧАСТЬ: RANGER -->
        <div id="term-ranger" class="term-ranger" hidden>
          <div class="ranger-header" id="ranger-path-bar">milk13@archarnel /home/milk13/IdeaProjects/jrnl</div>
          <div class="ranger-columns">
            <div class="ranger-col" id="ranger-parent"></div>
            <div class="ranger-col active" id="ranger-current"></div>
            <div class="ranger-col preview" id="ranger-preview"></div>
          </div>
          <div class="ranger-footer">drwxr-xr-x milk13 milk13 • Навигация: [↑/↓] Выбор  [←] Назад  [→/Enter] Открыть  [q/Esc] Закрыть ranger</div>
        </div>

        <!-- РАЗДЕЛИТЕЛЬ ДВУХ СИСТЕМ -->
        <div class="term-split-divider">
          <span class="term-divider-label">GHOSTTY CONSOLE (FISH 4.9.3)</span>
          <span class="term-divider-meta">milk13@archarnel:pty/1</span>
        </div>

        <!-- НИЖНЯЯ ЧАСТЬ: ИНТЕРАКТИВНЫЙ FISH ШЕЛЛ -->
        <div id="term-body" class="term-body"></div>

        <form id="term-form" class="term-input-row">
          <span id="term-prompt-time" class="term-time">01:44:00</span>
          <span class="term-chevron">❯</span>
          <input id="term-input" class="term-input" type="text" autocomplete="off" spellcheck="false" placeholder="Введите help, run, micro, sql groups, group add, grade, lock ...">
        </form>

      </div>
    </div>
  `;
  document.body.append(overlay);

  // Ссылки на элементы DOM
  const pamGate = overlay.querySelector("#term-pam-gate");
  const pamForm = overlay.querySelector("#pam-form");
  const pamInput = overlay.querySelector("#pam-password-input");
  const pamError = overlay.querySelector("#pam-error-msg");
  const pamAutoBtn = overlay.querySelector("#pam-auto-auth-btn");
  const workspace = overlay.querySelector("#term-workspace");

  const btnModeIde = overlay.querySelector("#term-btn-mode-ide");
  const btnModeRanger = overlay.querySelector("#term-btn-mode-ranger");
  const btnRun = overlay.querySelector("#term-btn-run");
  const btnLock = overlay.querySelector("#term-btn-lock");
  const btnClose = overlay.querySelector("#term-btn-close");

  const idePane = overlay.querySelector("#term-ide-pane");
  const ideFileList = overlay.querySelector("#ide-file-list");
  const ideTabIcon = overlay.querySelector("#ide-tab-icon");
  const ideTabName = overlay.querySelector("#ide-tab-name");
  const ideTabLang = overlay.querySelector("#ide-tab-lang");
  const ideLines = overlay.querySelector("#ide-lines");
  const ideTextarea = overlay.querySelector("#ide-textarea");
  const ideBtnSave = overlay.querySelector("#ide-btn-save");
  const stFilename = overlay.querySelector("#st-filename");
  const stLines = overlay.querySelector("#st-lines");

  const body = overlay.querySelector("#term-body");
  const rangerBox = overlay.querySelector("#term-ranger");
  const form = overlay.querySelector("#term-form");
  const input = overlay.querySelector("#term-input");
  const titleCwd = overlay.querySelector("#term-title-cwd");
  const promptTime = overlay.querySelector("#term-prompt-time");

  function isAuthorized() {
    return sessionStorage.getItem(PAM_AUTH_KEY) === "true";
  }

  function setAuthorized(auth) {
    if (auth) {
      sessionStorage.setItem(PAM_AUTH_KEY, "true");
      pamGate.hidden = true;
      workspace.hidden = false;
      renderIdeFiles();
      loadIdeFile(activeIdeFile);
      if (!body.children.length) {
        printFastfetch();
        printOutput(`Аутентификация <span style="color:#50fa7b;font-weight:700">PAM PASS</span>: сессия пользователя <span class="hl-cmd">milk13</span> открыта.<br>Доступно: TUI редактор кода, тесты транзакций (<span class="hl-cmd">run</span>), живой SQL (<span class="hl-cmd">sql groups</span>) и <span class="hl-cmd">help</span>.`);
      }
      setTimeout(() => input.focus(), 50);
    } else {
      sessionStorage.removeItem(PAM_AUTH_KEY);
      workspace.hidden = true;
      pamGate.hidden = false;
      pamError.hidden = true;
      pamInput.value = "";
      setTimeout(() => pamInput.focus(), 50);
    }
  }

  function handlePamSubmit(pass) {
    const p = (pass || "").trim().toLowerCase();
    if (PAM_VALID_PASSWORDS.includes(p)) {
      setAuthorized(true);
    } else {
      const box = pamGate.querySelector(".pam-auth-box");
      box.classList.remove("term-shake");
      void box.offsetWidth;
      box.classList.add("term-shake");
      pamError.textContent = "✕ Ошибка аутентификации PAM: неверный пароль. Доступ заблокирован.";
      pamError.hidden = false;
      pamInput.select();
    }
  }

  pamForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handlePamSubmit(pamInput.value);
  });

  pamAutoBtn.addEventListener("click", () => {
    handlePamSubmit("milk13");
  });

  btnLock.addEventListener("click", () => {
    printPromptEcho("lock", "0ms");
    printOutput("Сессия заблокирована. Возврат к экрану PAM.");
    setAuthorized(false);
  });

  /* Управление режимами IDE / Ranger */
  function setViewMode(mode) {
    viewMode = mode;
    btnModeIde.classList.toggle("active", mode === "ide");
    btnModeRanger.classList.toggle("active", mode === "ranger");
    if (mode === "ide") {
      rangerBox.hidden = true;
      idePane.hidden = false;
    } else {
      idePane.hidden = true;
      rangerBox.hidden = false;
      renderRanger();
    }
  }

  btnModeIde.addEventListener("click", () => setViewMode("ide"));
  btnModeRanger.addEventListener("click", () => setViewMode(viewMode === "ranger" ? "ide" : "ranger"));

  /* Редактор кода (TUI IDE) */
  function renderIdeFiles() {
    ideFileList.replaceChildren();
    IDE_KEY_FILES.forEach(f => {
      const item = document.createElement("div");
      item.className = "ide-file-item" + (f.path === activeIdeFile ? " active" : "");
      item.innerHTML = `<span class="f-icon">${f.icon}</span><span class="f-name">${f.name}</span>`;
      item.addEventListener("click", () => {
        loadIdeFile(f.path);
      });
      ideFileList.append(item);
    });
  }

  function loadIdeFile(path) {
    activeIdeFile = path;
    const fileMeta = IDE_KEY_FILES.find(f => f.path === path) || { name: path.split("/").pop(), lang: "Text", icon: SVG_ICONS_PACK.doc };
    const content = VFS[path]?.content || "// Файл пуст или создан в VFS";

    ideTabIcon.innerHTML = fileMeta.icon;
    ideTabName.textContent = fileMeta.name;
    ideTabLang.textContent = fileMeta.lang;
    stFilename.textContent = fileMeta.name;
    ideTextarea.value = content;
    updateIdeLineNumbers();

    ideFileList.querySelectorAll(".ide-file-item").forEach((el, idx) => {
      el.classList.toggle("active", IDE_KEY_FILES[idx]?.path === path);
    });
  }

  function updateIdeLineNumbers() {
    const lines = ideTextarea.value.split("\n").length;
    const nums = [];
    for (let i = 1; i <= lines; i++) nums.push(i);
    ideLines.textContent = nums.join("\n");
    stLines.textContent = `${lines} строк`;
  }

  ideTextarea.addEventListener("input", updateIdeLineNumbers);

  function saveCurrentIdeFile() {
    if (!activeIdeFile) return;
    if (!VFS[activeIdeFile]) {
      VFS[activeIdeFile] = { type: "file", content: ideTextarea.value };
    } else {
      VFS[activeIdeFile].content = ideTextarea.value;
    }
    const name = activeIdeFile.split("/").pop();
    printOutput(`<span style="color:#50fa7b">✔ [micro 2.0.14] Записано байт в VFS: <b>${name}</b> (${ideTextarea.value.length} символов).</span>`);
    const originalText = ideBtnSave.innerHTML;
    ideBtnSave.innerHTML = `✔ Сохранено!`;
    setTimeout(() => ideBtnSave.innerHTML = originalText, 1200);
  }

  ideBtnSave.addEventListener("click", saveCurrentIdeFile);

  ideTextarea.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveCurrentIdeFile();
    }
  });

  /* Контекстное действие [Run / Verify] */
  async function runActiveFileVerification() {
    const fname = activeIdeFile.split("/").pop();
    const t0 = performance.now();
    printPromptEcho(`run ${fname}`, "4ms");

    if (fname === "RollbackTest.java" || fname === "JournalApplication.java") {
      printOutput(`<pre class="term-pre">[INFO] Проверка механизма транзакций Spring Boot @Transactional...
[INFO] 1. Создан snapshot базы: 3 предмета, 3 группы, 60 студентов, 162 оценки.
[INFO] 2. Вызов deleteStudent(1, simulateError = true)...
[WARN] Учебный сбой: Имитация исключения после удаления оценок!
[INFO] 3. Транзакционный диспетчер перехватил RuntimeException -> ROLLBACK!
[INFO] <span style="color:#50fa7b;font-weight:700">PASS: студент #1 и все 5 оценок успешно сохранены в базе (откат сработал на 100%)!</span>
[INFO] <span style="color:#50fa7b;font-weight:700">PASS: рабочая база полностью идентична эталонному snapshot.</span></pre>`);
    } else if (fname === "GroupController.java") {
      try {
        const res = await requestJSON("/api/groups");
        const ms = Math.round(performance.now() - t0) + "ms";
        const rows = res.items.map(g => `| ${String(g.id).padEnd(3)} | ${g.name.padEnd(18)} | ${String(g.student_count).padStart(9)} |`).join("\n");
        printOutput(`<pre class="term-pre">[GET /api/groups -> GroupController.listGroups() (${ms})]
+-----+--------------------+-----------+
| ID  | Группа             | Студентов |
+-----+--------------------+-----------+
${rows}
+-----+--------------------+-----------+
Всего активных групп: ${res.items.length}</pre>`);
      } catch (err) {
        printOutput(`<span class="term-err">Ошибка запроса к GroupController: ${err.message}</span>`);
      }
    } else if (fname === "StudentService.java") {
      try {
        const res = await requestJSON("/api/students");
        const ms = Math.round(performance.now() - t0) + "ms";
        const top = res.items.slice(0, 10).map(s => `| ${String(s.id).padEnd(3)} | ${s.name.padEnd(20)} | ${s.group_name.padEnd(10)} | ${String(s.average_mark ?? "—").padStart(6)} |`).join("\n");
        printOutput(`<pre class="term-pre">[GET /api/students -> StudentService.listStudents() (${ms})]
+-----+----------------------+------------+--------+
| ID  | ФИО                  | Группа     | Ср.бал |
+-----+----------------------+------------+--------+
${top}
+-----+----------------------+------------+--------+
Всего студентов: ${res.items.length} (показаны первые 10)</pre>`);
      } catch (err) {
        printOutput(`<span class="term-err">Ошибка: ${err.message}</span>`);
      }
    } else if (fname === "schema.sql") {
      printOutput(`<pre class="term-pre">[SQLite Schema Verification]
PRAGMA foreign_keys = ON;  --> <span style="color:#50fa7b">ENABLED (1)</span>
PRAGMA journal_mode = WAL; --> <span style="color:#50fa7b">WAL MODE</span>
Таблицы:
  - groups (id, name UNIQUE)
  - subjects (id, name UNIQUE)
  - students (id, name, group_id REFERENCES groups(id), email)
  - grades (id, student_id REFERENCES students(id), subject_id REFERENCES subjects(id), mark IN (2,3,4,5))
<span style="color:#50fa7b">✔ Нарушений внешних ключей не обнаружено (PRAGMA foreign_key_check = 0).</span></pre>`);
    } else {
      printOutput(`<span style="color:#50fa7b">✔ Синтаксическая валидация ${fname}: OK. Файл загружен в VFS и готов к сборке.</span>`);
    }
  }

  btnRun.addEventListener("click", runActiveFileVerification);

  function shortPath(p) {
    return p.replace("/home/milk13", "~");
  }

  function resolvePath(target) {
    if (!target || target === "~") return "/home/milk13";
    if (target.startsWith("~/")) return "/home/milk13/" + target.slice(2);
    if (target.startsWith("/")) return target.replace(/\/+$/, "") || "/";
    const parts = cwd.split("/").filter(Boolean);
    for (const seg of target.split("/")) {
      if (seg === "." || !seg) continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return "/" + parts.join("/");
  }

  function printPromptEcho(cmdText, elapsedMs = "0ms") {
    const now = new Date().toLocaleTimeString("ru-RU", { hour12: false });
    const block = document.createElement("div");
    block.className = "term-entry";
    block.innerHTML = `
      <div class="fish-prompt-top">
        <span class="fp-arch">A</span>
        <span class="fp-cwd">${shortPath(cwd)}</span>
        <span class="fp-ms">${elapsedMs}</span>
        <span class="fp-heart">♡</span>
      </div>
      <div class="fish-prompt-cmd">
        <span class="term-time">${now}</span>
        <span class="term-chevron">❯</span>
        <span class="fp-typed">${cmdText.replace(/</g, "&lt;")}</span>
      </div>
    `;
    body.append(block);
  }

  function printOutput(html) {
    const out = document.createElement("div");
    out.className = "term-output";
    out.innerHTML = html;
    body.append(out);
    body.scrollTop = body.scrollHeight;
  }

  function printFastfetch() {
    printOutput(`
<div class="ff-grid">
<pre class="ff-ascii">
       .o+
      \`ooo/
     \`+oooo:
    \`+oooooo:
    -+oooooo+:
  \`/:-:++oooo+:
 \`/++++/+++++++:
\`/++++++++++++++:
\`/+++ooooooooooooo/\`
./ooosssso++osssssso+\`
.oossssso-  \`/ossssss+\`
-osssssso.    :ssssssso.
:osssssss/    osssso+++.
/ossssssss/   +ssssooo/-
\`/ossssso+/:- -:/+osssso+-
\`+sso+:-\`       \`.-/+oso:
\`++:.              \`-/+/
.\`                   \`/
</pre>
<div class="ff-info">
  <div><span class="ff-key">A milk13</span>@<span class="ff-host">archarnel</span></div>
  <div class="ff-sep">──────────────────────────</div>
  <div><span class="ff-key">ОС</span>         Arch Linux x86_64</div>
  <div><span class="ff-key">Ядро</span>       Linux 7.2.11-arch1-1</div>
  <div><span class="ff-key">Оболочка</span>   fish 4.9.3 (web-vfs)</div>
  <div><span class="ff-key">WM</span>         bspwm (Dracula-pink-accent)</div>
  <div><span class="ff-key">Шрифт</span>      JetBrainsMono Nerd Font (13pt)</div>
  <div><span class="ff-key">Терминал</span>   ghostty 1.3.1-arch2</div>
  <div><span class="ff-key">Бэкенд</span>     Java 21 + Spring Boot 3.3.5 + SQLite WAL</div>
  <div class="ff-dots">
    <span style="color:#ff5555">●</span> <span style="color:#50fa7b">●</span> <span style="color:#f1fa8c">●</span> <span style="color:#bd93f9">●</span> <span style="color:#ff79c6">●</span> <span style="color:#8be9fd">●</span>
  </div>
</div>
</div>`);
  }

  /* Интерактивный 3-колоночный режим ranger */
  function openRanger() {
    if (!VFS[cwd] || VFS[cwd].type !== "dir") cwd = "/home/milk13/IdeaProjects/jrnl";
    rangerIdx = 0;
    setViewMode("ranger");
  }

  function renderRanger() {
    const node = VFS[cwd];
    const children = node?.children || [];
    rangerIdx = Math.max(0, Math.min(rangerIdx, Math.max(0, children.length - 1)));

    overlay.querySelector("#ranger-path-bar").textContent = `milk13@archarnel ${cwd}`;

    const parentPath = resolvePath("..");
    const parentNode = VFS[parentPath];
    const parentEl = overlay.querySelector("#ranger-parent");
    parentEl.innerHTML = (parentNode?.children || []).map(name => {
      const full = (parentPath === "/" ? "" : parentPath) + "/" + name;
      const isCurrent = full === cwd;
      return `<div class="r-item ${isCurrent ? "selected" : ""}">📁 ${name}</div>`;
    }).join("");

    const currEl = overlay.querySelector("#ranger-current");
    currEl.innerHTML = children.map((name, i) => {
      const full = cwd + "/" + name;
      const isDir = VFS[full]?.type === "dir";
      return `<div class="r-item ${i === rangerIdx ? "selected" : ""}" data-idx="${i}">${isDir ? "📁" : "📄"} ${name}</div>`;
    }).join("");

    currEl.querySelectorAll(".r-item").forEach(el => {
      el.addEventListener("click", () => {
        rangerIdx = Number(el.dataset.idx);
        renderRanger();
      });
      el.addEventListener("dblclick", () => {
        stepRangerRight();
      });
    });

    const prevEl = overlay.querySelector("#ranger-preview");
    const activeName = children[rangerIdx];
    const activeFull = activeName ? cwd + "/" + activeName : null;
    const activeTarget = activeFull ? VFS[activeFull] : null;

    if (!activeTarget) {
      prevEl.innerHTML = `<span class="muted">Пусто</span>`;
    } else if (activeTarget.type === "dir") {
      prevEl.innerHTML = activeTarget.children.map(c => `<div class="r-item">• ${c}</div>`).join("");
    } else {
      prevEl.innerHTML = `<pre class="r-code">${activeTarget.content.replace(/</g, "&lt;")}</pre>`;
    }
  }

  function stepRangerRight() {
    const children = VFS[cwd]?.children || [];
    const activeName = children[rangerIdx];
    if (!activeName) return;
    const targetPath = cwd + "/" + activeName;
    if (VFS[targetPath]?.type === "dir") {
      cwd = targetPath;
      rangerIdx = 0;
      titleCwd.textContent = shortPath(cwd);
      renderRanger();
    } else {
      loadIdeFile(targetPath);
      setViewMode("ide");
    }
  }

  function stepRangerLeft() {
    const parent = resolvePath("..");
    if (VFS[parent]?.type === "dir" && parent !== cwd) {
      cwd = parent;
      rangerIdx = 0;
      titleCwd.textContent = shortPath(cwd);
      renderRanger();
    }
  }

  async function executeCommand(raw) {
    const cmdLine = raw.trim();
    if (!cmdLine) return;
    history.unshift(cmdLine);
    histIdx = -1;

    const t0 = performance.now();
    const parts = cmdLine.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg1 = parts[1];

    if (cmd === "clear" || cmd === "cls") {
      body.replaceChildren();
      return;
    }

    if (cmd === "lock") {
      printPromptEcho(cmdLine, "0ms");
      printOutput("Сессия заблокирована.");
      setAuthorized(false);
      return;
    }

    if (cmd === "run") {
      await runActiveFileVerification();
      return;
    }

    if (cmd === "ranger" || cmd === "lf") {
      printPromptEcho(cmdLine, "1ms");
      openRanger();
      return;
    }

    if (cmd === "micro" || cmd === "vim" || cmd === "nano" || cmd === "edit") {
      printPromptEcho(cmdLine, "1ms");
      if (!arg1) {
        setViewMode("ide");
        ideTextarea.focus();
        printOutput("Открыт встроенный TUI редактор кода.");
        return;
      }
      const target = resolvePath(arg1);
      if (VFS[target] && VFS[target].type === "file") {
        loadIdeFile(target);
        setViewMode("ide");
        ideTextarea.focus();
        printOutput(`Файл <span class="hl-cmd">${target}</span> открыт в верхнем редакторе micro.`);
      } else {
        printOutput(`<span class="term-err">${cmd}: файл '${arg1}' не найден</span>`);
      }
      return;
    }

    if (cmd === "help" || cmd === "?") {
      printPromptEcho(cmdLine, "0ms");
      printOutput(`
<div class="term-help">
  <div><span class="hl-cmd">run</span>                  — запустить проверку активного файла в редакторе</div>
  <div><span class="hl-cmd">micro &lt;file&gt; / vim</span>    — открыть файл в верхнем TUI редакторе</div>
  <div><span class="hl-cmd">ls, ll, tree</span>          — список файлов и дерево каталогов</div>
  <div><span class="hl-cmd">cd &lt;dir&gt;</span>              — смена рабочей директории (Tab — автодополнение)</div>
  <div><span class="hl-cmd">cat &lt;file&gt;</span>             — вывод содержимого файла в терминал</div>
  <div><span class="hl-cmd">ranger</span>                 — открыть файловый менеджер ranger</div>
  <div><span class="hl-cmd">sql &lt;groups|students|subjects&gt;</span> — живые SQL-выборки через Spring Boot REST API</div>
  <div><span class="hl-cmd">group add &lt;название&gt;</span>  — создать группу в базе SQLite прямо из консоли</div>
  <div><span class="hl-cmd">grade &lt;stId&gt; &lt;subId&gt; &lt;2..5&gt;</span> — выставить оценку студенту через API</div>
  <div><span class="hl-cmd">mvn test</span>              — запустить тестовый suite (Baseline & Rollback)</div>
  <div><span class="hl-cmd">theme &lt;dark|oled|light&gt;</span> — переключить тему интерфейса</div>
  <div><span class="hl-cmd">xray</span>                  — переключить боковую шторку «Рентген логики»</div>
  <div><span class="hl-cmd">lock</span>                  — заблокировать консоль и вернуться к PAM Gate</div>
</div>`);
      return;
    }

    if (cmd === "ff" || cmd === "fastfetch" || cmd === "neofetch") {
      printPromptEcho(cmdLine, "2ms");
      printFastfetch();
      return;
    }

    if (cmd === "pwd") {
      printPromptEcho(cmdLine, "0ms");
      printOutput(cwd);
      return;
    }

    if (cmd === "ls" || cmd === "ll" || cmd === "la") {
      const target = arg1 ? resolvePath(arg1) : cwd;
      const node = VFS[target];
      printPromptEcho(cmdLine, "1ms");
      if (!node || node.type !== "dir") {
        printOutput(`<span class="term-err">ls: не удаётся получить доступ к '${arg1 || target}': Нет такого каталога</span>`);
        return;
      }
      if (cmd === "ll" || cmd === "la") {
        const lines = node.children.map(name => {
          const full = target + "/" + name;
          const isDir = VFS[full]?.type === "dir";
          return `${isDir ? "drwxr-xr-x" : "-rw-r--r--"} 1 milk13 milk13  4096 ноя 10 01:44 <span class="${isDir ? "hl-dir" : "hl-file"}">${name}${isDir ? "/" : ""}</span>`;
        });
        printOutput(`<pre class="term-pre">${lines.join("\n")}</pre>`);
      } else {
        const items = node.children.map(name => {
          const isDir = VFS[target + "/" + name]?.type === "dir";
          return `<span class="${isDir ? "hl-dir" : "hl-file"}">${isDir ? "📁 " + name + "/" : "📄 " + name}</span>`;
        });
        printOutput(`<div class="term-ls-row">${items.join("   ")}</div>`);
      }
      return;
    }

    if (cmd === "tree") {
      printPromptEcho(cmdLine, "2ms");
      const lines = [shortPath(cwd)];
      function walk(path, prefix) {
        const n = VFS[path];
        if (!n || n.type !== "dir") return;
        n.children.forEach((ch, idx) => {
          const last = idx === n.children.length - 1;
          const full = path + "/" + ch;
          const isDir = VFS[full]?.type === "dir";
          lines.push(`${prefix}${last ? "└── " : "├── "}<span class="${isDir ? "hl-dir" : "hl-file"}">${ch}</span>`);
          if (isDir) walk(full, prefix + (last ? "    " : "│   "));
        });
      }
      walk(cwd, "");
      printOutput(`<pre class="term-pre">${lines.join("\n")}</pre>`);
      return;
    }

    if (cmd === "cd") {
      const next = resolvePath(arg1 || "~");
      printPromptEcho(cmdLine, "0ms");
      if (VFS[next] && VFS[next].type === "dir") {
        cwd = next;
        titleCwd.textContent = shortPath(cwd);
      } else {
        printOutput(`<span class="term-err">cd: каталог '${arg1}' не найден</span>`);
      }
      return;
    }

    if (cmd === "cat" || cmd === "bat") {
      printPromptEcho(cmdLine, "1ms");
      if (!arg1) {
        printOutput(`<span class="term-err">${cmd}: укажите имя файла</span>`);
        return;
      }
      const target = resolvePath(arg1);
      const node = VFS[target];
      if (!node) {
        printOutput(`<span class="term-err">${cmd}: ${arg1}: Нет такого файла</span>`);
      } else if (node.type === "dir") {
        printOutput(`<span class="term-err">${cmd}: ${arg1}: Это каталог</span>`);
      } else {
        printOutput(`<pre class="term-code-box">${node.content.replace(/</g, "&lt;")}</pre>`);
      }
      return;
    }

    if (cmd === "theme") {
      printPromptEcho(cmdLine, "1ms");
      if (THEMES.includes(arg1)) {
        setTheme(arg1);
        printOutput(`Тема оформления переключена на <span class="hl-cmd">${arg1}</span>.`);
      } else {
        printOutput(`Доступные темы: <span class="hl-cmd">theme dark</span> | <span class="hl-cmd">theme oled</span> | <span class="hl-cmd">theme light</span>`);
      }
      return;
    }

    if (cmd === "xray") {
      printPromptEcho(cmdLine, "1ms");
      document.querySelector("#xray-toggle-btn")?.click();
      printOutput("Шторка «Рентген логики» переключена.");
      return;
    }

    if (cmd === "mvn" && arg1 === "test") {
      printPromptEcho(cmdLine, "42ms");
      printOutput(`<pre class="term-pre">[INFO] Scanning for projects...
[INFO] -----------------------&lt; ru.edu:journal &gt;-----------------------
[INFO] Building journal 1.0.0 (Java 21)
[INFO] Running ru.edu.journal.DatabaseBaselineTest
[INFO] <span style="color:#50fa7b">Tests run: 1, Failures: 0, Errors: 0 — PASS (foreign_keys=1, students=60, grades=162)</span>
[INFO] Running ru.edu.journal.RollbackTest
[INFO] <span style="color:#50fa7b">Tests run: 1, Failures: 0, Errors: 0 — PASS (откат @Transactional сохранил целостность)</span>
[INFO] Running ru.edu.journal.JournalIntegrationTest
[INFO] <span style="color:#50fa7b">Tests run: 8, Failures: 0, Errors: 0 — PASS</span>
[INFO] ------------------------------------------------------------------------
[INFO] <span style="color:#50fa7b;font-weight:700">BUILD SUCCESS</span> (Все 10 тестов завершены успешно!)</pre>`);
      return;
    }

    if (cmd === "sql" || cmd === "db") {
      try {
        if (arg1 === "groups") {
          const res = await requestJSON("/api/groups");
          const ms = Math.round(performance.now() - t0) + "ms";
          printPromptEcho(cmdLine, ms);
          const rows = res.items.map(g => `| ${String(g.id).padEnd(3)} | ${g.name.padEnd(18)} | ${String(g.student_count).padStart(9)} |`).join("\n");
          printOutput(`<pre class="term-pre">+-----+--------------------+-----------+\n| ID  | Группа             | Студентов |\n+-----+--------------------+-----------+\n${rows}\n+-----+--------------------+-----------+</pre>`);
        } else if (arg1 === "subjects") {
          const res = await requestJSON("/api/subjects");
          const ms = Math.round(performance.now() - t0) + "ms";
          printPromptEcho(cmdLine, ms);
          const rows = res.items.map(s => `| ${String(s.id).padEnd(3)} | ${s.name.padEnd(26)} |`).join("\n");
          printOutput(`<pre class="term-pre">+-----+----------------------------+\n| ID  | Дисциплина                 |\n+-----+----------------------------+\n${rows}\n+-----+----------------------------+</pre>`);
        } else if (arg1 === "students") {
          const res = await requestJSON("/api/students");
          const ms = Math.round(performance.now() - t0) + "ms";
          printPromptEcho(cmdLine, ms);
          const top = res.items.slice(0, 12).map(s => `| ${String(s.id).padEnd(3)} | ${s.name.padEnd(22)} | ${s.group_name.padEnd(10)} | ${String(s.average_mark ?? "—").padStart(6)} |`).join("\n");
          printOutput(`<pre class="term-pre">+-----+------------------------+------------+--------+\n| ID  | ФИО (первые 12)        | Группа     | Ср.бал |\n+-----+------------------------+------------+--------+\n${top}\n+-----+------------------------+------------+--------+\nВсего в выборке: ${res.items.length} студентов</pre>`);
        } else {
          printPromptEcho(cmdLine, "1ms");
          printOutput(`Использование: <span class="hl-cmd">sql groups</span> | <span class="hl-cmd">sql students</span> | <span class="hl-cmd">sql subjects</span>`);
        }
      } catch (err) {
        printPromptEcho(cmdLine, "err");
        printOutput(`<span class="term-err">Ошибка API: ${err.message}</span>`);
      }
      return;
    }

    if (cmd === "group" && arg1 === "add") {
      const name = parts.slice(2).join(" ").trim();
      if (!name) {
        printPromptEcho(cmdLine, "0ms");
        printOutput(`<span class="term-err">Укажите название: group add БЭИ2304</span>`);
        return;
      }
      try {
        const res = await requestJSON("/api/groups", "POST", { name });
        const ms = Math.round(performance.now() - t0) + "ms";
        printPromptEcho(cmdLine, ms);
        printOutput(`<span style="color:#50fa7b">✔ Группа '${res.item.name}' (id=${res.item.id}) создана в SQLite! Проверьте шторку «⚡ Логика».</span>`);
      } catch (err) {
        printPromptEcho(cmdLine, "err");
        printOutput(`<span class="term-err">Ошибка: ${err.message}</span>`);
      }
      return;
    }

    if (cmd === "grade") {
      const stId = Number(parts[1]);
      const subId = Number(parts[2]);
      const mark = Number(parts[3]);
      if (!stId || !subId || !mark) {
        printPromptEcho(cmdLine, "0ms");
        printOutput(`<span class="term-err">Формат: grade &lt;student_id&gt; &lt;subject_id&gt; &lt;2..5&gt; (например: grade 1 1 5)</span>`);
        return;
      }
      try {
        await requestJSON("/api/journal/grades", "POST", { student_id: stId, subject_id: subId, mark });
        const ms = Math.round(performance.now() - t0) + "ms";
        printPromptEcho(cmdLine, ms);
        printOutput(`<span style="color:#50fa7b">✔ Оценка ${mark} выставлена (student_id=${stId}, subject_id=${subId}).</span>`);
      } catch (err) {
        printPromptEcho(cmdLine, "err");
        printOutput(`<span class="term-err">Ошибка: ${err.message}</span>`);
      }
      return;
    }

    printPromptEcho(cmdLine, "0ms");
    printOutput(`<span class="term-err">fish: неизвестная команда: ${cmd}. Введите <span class="hl-cmd">help</span> для списка команд.</span>`);
  }

  function toggleTerminal() {
    overlay.hidden = !overlay.hidden;
    if (!overlay.hidden) {
      promptTime.textContent = new Date().toLocaleTimeString("ru-RU", { hour12: false });
      if (isAuthorized()) {
        setAuthorized(true);
      } else {
        setAuthorized(false);
      }
    }
  }

  document.querySelector("#term-toggle-btn")?.addEventListener("click", toggleTerminal);
  btnClose.addEventListener("click", toggleTerminal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) toggleTerminal();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    executeCommand(v);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const parts = input.value.split(/\s+/);
      const last = parts[parts.length - 1] || "";
      const children = VFS[cwd]?.children || [];
      const match = children.find(c => c.toLowerCase().startsWith(last.toLowerCase()));
      if (match) {
        parts[parts.length - 1] = match;
        input.value = parts.join(" ");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx + 1 < history.length) {
        histIdx++;
        input.value = history[histIdx];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) {
        histIdx--;
        input.value = history[histIdx];
      } else {
        histIdx = -1;
        input.value = "";
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      toggleTerminal();
    } else if (e.ctrlKey && (e.key === "`" || e.key === "~" || e.key === "ё")) {
      e.preventDefault();
      toggleTerminal();
    } else if (e.altKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      document.querySelector("#xray-toggle-btn")?.click();
    } else if (e.altKey && e.key.toLowerCase() === "t") {
      e.preventDefault();
      toggleTheme();
    } else if (!overlay.hidden && viewMode === "ranger") {
      if (e.key === "Escape" || e.key.toLowerCase() === "q") {
        e.preventDefault();
        setViewMode("ide");
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        rangerIdx++;
        renderRanger();
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        rangerIdx--;
        renderRanger();
      } else if (e.key === "ArrowRight" || e.key === "l" || e.key === "Enter") {
        e.preventDefault();
        stepRangerRight();
      } else if (e.key === "ArrowLeft" || e.key === "h") {
        e.preventDefault();
        stepRangerLeft();
      }
    } else if (!overlay.hidden && e.key === "Escape") {
      toggleTerminal();
    }
  });
}

/* ==========================================================================
   4. CURSOR SPOTLIGHT (ИНТЕРАКТИВНЫЙ НЕОНОВЫЙ ОРЕОЛ КУРСОРА)
   ========================================================================== */
function initCursorSpotlight() {
  let rafId = null;
  const selector = ".kpi-card, .chart-card, .toolbar, .editor, .table-scroll, .term-window, .cmd-palette-box, .status-card, .home-card, table, tbody tr, .journal-progress-box";

  window.addEventListener("pointermove", (e) => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const targets = document.querySelectorAll(selector);
      const mx = e.clientX;
      const my = e.clientY;

      targets.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (
          mx >= rect.left - 80 &&
          mx <= rect.right + 80 &&
          my >= rect.top - 80 &&
          my <= rect.bottom + 80
        ) {
          el.style.setProperty("--mx", `${mx - rect.left}px`);
          el.style.setProperty("--my", `${my - rect.top}px`);
        }
      });
    });
  }, { passive: true });
}

/* ==========================================================================
   6. HEADER WATER RIPPLE (ИНТЕРАКТИВНАЯ РЯБЬ ВЕРХНЕЙ ПАНЕЛИ)
   ========================================================================== */
function initHeaderRipple() {
  const header = document.querySelector(".site-header");
  const layer = document.querySelector("#header-ripple-layer");
  if (!header || !layer) return;

  header.addEventListener("pointermove", (e) => {
    const rect = header.getBoundingClientRect();
    const hx = e.clientX - rect.left;
    const hy = e.clientY - rect.top;
    header.style.setProperty("--hx", `${hx}px`);
    header.style.setProperty("--hy", `${hy}px`);
  }, { passive: true });

  header.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, input, select")) return;
    const rect = header.getBoundingClientRect();
    const drop = document.createElement("div");
    drop.className = "header-ripple-drop";
    drop.style.left = `${e.clientX - rect.left}px`;
    drop.style.top = `${e.clientY - rect.top}px`;
    layer.append(drop);
    setTimeout(() => drop.remove(), 750);
  });
}

/* ==========================================================================
   5. КОМАНДНАЯ ПАЛИТРА (QUICK COMMAND PALETTE Ctrl+K / Alt+K)
   ========================================================================== */
function initCommandPalette() {
  if (document.querySelector("#cmd-palette-modal")) return;

  const modal = document.createElement("div");
  modal.id = "cmd-palette-modal";
  modal.className = "cmd-palette-modal";
  modal.hidden = true;

  modal.innerHTML = `
    <div class="cmd-palette-box" role="dialog" aria-modal="true" aria-label="Палитра быстрых команд">
      <div class="cmd-palette-header">
        <svg class="cmd-palette-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input id="cmd-palette-input" class="cmd-palette-input" type="text" autocomplete="off" spellcheck="false" placeholder="Введите команду или раздел (например: журнал, терминал, oled, excel)...">
        <kbd class="cmd-esc-kbd">Esc</kbd>
      </div>
      <div id="cmd-palette-list" class="cmd-palette-list"></div>
      <div class="cmd-palette-footer">
        <span><kbd>↑</kbd> <kbd>↓</kbd> Навигация</span>
        <span><kbd>Enter</kbd> Выбрать</span>
        <span><kbd>Esc</kbd> Закрыть</span>
      </div>
    </div>
  `;
  document.body.append(modal);

  const input = modal.querySelector("#cmd-palette-input");
  const list = modal.querySelector("#cmd-palette-list");
  let activeIndex = 0;

  const COMMANDS = [
    { id: "nav-home", title: "Главная страница (Портал)", category: "Навигация", keys: "home главная портал journal antigravity", icon: SVG_ICONS_PACK.home, action: () => window.location.href = "/" },
    { id: "nav-journal", title: "Журнал успеваемости (Ведомость)", category: "Навигация", keys: "journal журнал оценки матрица ведомость excel", icon: SVG_ICONS_PACK.journal, action: () => window.location.href = "/journal" },
    { id: "nav-groups", title: "Учебные группы", category: "Навигация", keys: "groups группы поток", icon: SVG_ICONS_PACK.groups, action: () => window.location.href = "/groups" },
    { id: "nav-subjects", title: "Дисциплины (Предметы)", category: "Навигация", keys: "subjects предметы дисциплины", icon: SVG_ICONS_PACK.subjects, action: () => window.location.href = "/subjects" },
    { id: "nav-students", title: "Студенты и зачисление", category: "Навигация", keys: "students студенты состав обучающиеся", icon: SVG_ICONS_PACK.students, action: () => window.location.href = "/students" },
    { id: "nav-reports", title: "Академические отчёты", category: "Навигация", keys: "reports отчеты группы должники отличники", icon: SVG_ICONS_PACK.reports, action: () => window.location.href = "/reports" },
    { id: "tool-terminal", title: "Консоль разработчика milk13@archarnel", category: "Инструменты", keys: "terminal shell bash fish консоль терминал tui ide", icon: SVG_ICONS_PACK.terminal, action: () => { togglePalette(false); document.querySelector("#term-toggle-btn")?.click(); } },
    { id: "tool-xray", title: "Рентген внутренней логики (SQL & API)", category: "Инструменты", keys: "xray sql trace рентген логика", icon: SVG_ICONS_PACK.xray, action: () => { togglePalette(false); document.querySelector("#xray-toggle-btn")?.click(); } },
    { id: "theme-next", title: "Сменить тему (Dark / OLED / Light)", category: "Интерфейс", keys: "theme тема dark oled light вид", icon: SVG_ICONS_PACK.theme, action: () => { togglePalette(false); toggleTheme(); } },
    { id: "export-excel", title: "Экспорт журнала в Excel (.xlsx)", category: "Экспорт", keys: "excel xlsx экспорт скачать", icon: SVG_ICONS_PACK.excel, action: () => { togglePalette(false); document.querySelector("#btn-export-excel")?.click() || (window.location.href = "/api/journal/export/excel"); } },
    { id: "export-csv", title: "Экспорт журнала в текстовый CSV", category: "Экспорт", keys: "csv экспорт скачать", icon: SVG_ICONS_PACK.csv, action: () => { togglePalette(false); document.querySelector("#btn-export-csv")?.click() || (window.location.href = "/api/journal/export/csv"); } }
  ];

  let filtered = [...COMMANDS];

  function renderList() {
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "cmd-palette-empty";
      empty.textContent = "Ничего не найдено. Попробуйте другой запрос.";
      list.append(empty);
      return;
    }

    filtered.forEach((cmd, idx) => {
      const item = document.createElement("div");
      item.className = "cmd-palette-item" + (idx === activeIndex ? " active" : "");
      item.innerHTML = `
        <span class="cmd-item-icon">${cmd.icon}</span>
        <div class="cmd-item-content">
          <span class="cmd-item-title">${cmd.title}</span>
          <span class="cmd-item-cat">${cmd.category}</span>
        </div>
        <span class="cmd-item-hint">↵</span>
      `;
      item.addEventListener("mouseenter", () => {
        activeIndex = idx;
        updateActiveItem();
      });
      item.addEventListener("click", () => {
        cmd.action();
      });
      list.append(item);
    });
    scrollActiveIntoView();
  }

  function updateActiveItem() {
    list.querySelectorAll(".cmd-palette-item").forEach((el, i) => {
      el.classList.toggle("active", i === activeIndex);
    });
  }

  function scrollActiveIntoView() {
    const active = list.children[activeIndex];
    if (active) active.scrollIntoView({ block: "nearest" });
  }

  function togglePalette(show) {
    const isShow = typeof show === "boolean" ? show : modal.hidden;
    modal.hidden = !isShow;
    if (isShow) {
      input.value = "";
      filtered = [...COMMANDS];
      activeIndex = 0;
      renderList();
      input.focus();
    }
  }

  document.querySelector("#cmd-palette-btn")?.addEventListener("click", () => togglePalette(true));

  modal.addEventListener("click", (e) => {
    if (e.target === modal) togglePalette(false);
  });

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      filtered = [...COMMANDS];
    } else {
      filtered = COMMANDS.filter(c => c.title.toLowerCase().includes(q) || c.keys.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    }
    activeIndex = 0;
    renderList();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (filtered.length) {
        activeIndex = (activeIndex + 1) % filtered.length;
        updateActiveItem();
        scrollActiveIntoView();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (filtered.length) {
        activeIndex = (activeIndex - 1 + filtered.length) % filtered.length;
        updateActiveItem();
        scrollActiveIntoView();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) {
        filtered[activeIndex].action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      togglePalette(false);
    }
  });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      togglePalette();
    } else if (e.altKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      togglePalette();
    } else if (!modal.hidden && e.key === "Escape") {
      e.preventDefault();
      togglePalette(false);
    }
  });
}

export function initTheme() {
  const active = getCurrentTheme();
  document.documentElement.setAttribute("data-theme", active);
  updateThemeButton(active);

  const btn = document.querySelector("#theme-toggle");
  if (btn && !btn.dataset.initialized) {
    btn.dataset.initialized = "true";
    btn.addEventListener("click", () => toggleTheme());
  }

  initSlidingNavigation();
  initXRayInspector();
  initCursorSpotlight();
  initHeaderRipple();
  initCommandPalette();
  initLinuxTerminal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}
