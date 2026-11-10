// theme.js - Оболочка в стиле JetBrains IntelliJ IDEA (New UI) с отключаемыми Tool Windows
import { initCliBar } from "/js/cli.js";

const THEME_STORAGE_KEY = "journal_theme";
const HUD_STORAGE_KEY = "journal_hud_visible";
const THEMES = ["dark", "oled", "light"];

const THEME_META = {
  dark:  { icon: "🌙", label: "IDEA Dark",    nextLabel: "Включить режим OLED Pitch Black" },
  oled:  { icon: "🖤", label: "OLED Black",   nextLabel: "Включить светлую тему Light Violet" },
  light: { icon: "☀️", label: "IDEA Light",   nextLabel: "Включить тёмную тему IDEA Dark" }
};

export function getCurrentTheme() {
  const currentAttr = document.documentElement.getAttribute("data-theme");
  if (THEMES.includes(currentAttr)) return currentAttr;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch (e) {}
  return "dark";
}

export function setTheme(theme) {
  const chosen = THEMES.includes(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", chosen);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, chosen);
  } catch (e) {}
  updateThemeButton(chosen);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: chosen } }));
  return chosen;
}

export function toggleTheme() {
  const current = getCurrentTheme();
  const nextIdx = (THEMES.indexOf(current) + 1) % THEMES.length;
  return setTheme(THEMES[nextIdx]);
}

function updateThemeButton(theme) {
  const btn = document.querySelector("#theme-toggle");
  if (!btn) return;
  const meta = THEME_META[theme] || THEME_META.dark;
  const icon = btn.querySelector(".theme-toggle-icon");
  const text = btn.querySelector(".theme-toggle-text");
  if (icon) icon.textContent = meta.icon;
  if (text) text.textContent = meta.label;
  btn.setAttribute("title", `${meta.nextLabel} (Alt+T)`);
}

function startStatusClock() {
  const clockEl = document.querySelector("#polybar-clock");
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };
  update();
  setInterval(update, 10000);
}

/** Монтирует рабочее пространство IntelliJ IDEA New UI (Islands) */
function mountIdeaWorkspace() {
  const main = document.querySelector("main#main-content");
  if (!main || document.querySelector(".idea-workbench")) return;

  const path = window.location.pathname.replace("/", "") || "groups";
  const crumbMod = document.querySelector("#crumb-current-module");
  if (crumbMod) crumbMod.textContent = path;

  const workbench = document.createElement("div");
  workbench.className = "idea-workbench";

  // 1. Левая узкая полоса иконок (Left Tool Window Strip)
  const leftStrip = document.createElement("div");
  leftStrip.className = "idea-strip strip-left";
  leftStrip.innerHTML = `
    <button type="button" class="strip-btn active" data-toggle-left title="Project & Навигация (Alt+1 или ?)">
      <span class="strip-icon">📁</span>
      <span class="strip-label">Project</span>
    </button>
    <button type="button" class="strip-btn" onclick="location.href='/journal'" title="Перейти в матрицу журнала (Клавиша 4)">
      <span class="strip-icon">⊞</span>
      <span class="strip-label">DataGrip</span>
    </button>
    <button type="button" class="strip-btn" onclick="location.href='/reports'" title="Аналитика и графики (Клавиша 5)">
      <span class="strip-icon">📊</span>
      <span class="strip-label">Charts</span>
    </button>
  `;

  // 2. Правая узкая полоса иконок (Right Tool Window Strip)
  const rightStrip = document.createElement("div");
  rightStrip.className = "idea-strip strip-right";
  rightStrip.innerHTML = `
    <button type="button" class="strip-btn active" data-toggle-right title="Шпаргалка горячих клавиш с иллюстрациями (?)">
      <span class="strip-icon">⌨️</span>
      <span class="strip-label">Keymap</span>
    </button>
  `;

  // 3. ЛЕВОЕ ОКНО ИНСТРУМЕНТОВ: Дерево проекта + Иллюстрации навигации
  const leftToolWin = document.createElement("aside");
  leftToolWin.className = "idea-toolwindow toolwindow-left";
  leftToolWin.setAttribute("aria-label", "Дерево проекта и навигация");
  leftToolWin.innerHTML = `
    <div class="toolwindow-header">
      <span class="toolwindow-title">Project · jrnl</span>
      <button type="button" class="toolwindow-hide" data-toggle-left title="Свернуть панель (Alt+1 / ?)">—</button>
    </div>
    <div class="toolwindow-content">
      <!-- Дерево проекта как на скриншоте IDEA -->
      <div class="idea-tree">
        <div class="tree-root">▾ 📁 <strong>jrnl</strong> <span class="tree-path">~/IdeaProjects/jrnl</span></div>
        <div class="tree-folder">▾ 📁 src/main/features</div>
        <a href="/groups" class="tree-item ${path === 'groups' ? 'active' : ''}">
          <span class="icon-java">C</span> GroupsController <span class="inlay-hint">Alt+1</span>
        </a>
        <a href="/subjects" class="tree-item ${path === 'subjects' ? 'active' : ''}">
          <span class="icon-java">C</span> SubjectsController <span class="inlay-hint">Alt+2</span>
        </a>
        <a href="/students" class="tree-item ${path === 'students' ? 'active' : ''}">
          <span class="icon-java">C</span> StudentsController <span class="inlay-hint">Alt+3</span>
        </a>
        <a href="/journal" class="tree-item ${path === 'journal' ? 'active' : ''}">
          <span class="icon-db">⊞</span> JournalMatrix.db <span class="inlay-hint">Alt+4</span>
        </a>
        <a href="/reports" class="tree-item ${path === 'reports' ? 'active' : ''}">
          <span class="icon-sql">📊</span> ReportsAnalytics.sql <span class="inlay-hint">Alt+5</span>
        </a>
      </div>

      <!-- Иллюстрированная подсказка 1: Перемещение по таблицам -->
      <div class="idea-hint-card">
        <div class="hint-card-header">
          <span>Навигация по строкам и ячейкам</span>
          <span class="inlay-hint">Vim / Стрелки</span>
        </div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 62" class="hud-svg" aria-hidden="true">
            <rect x="12" y="18" width="40" height="32" rx="5" class="svg-key"/>
            <text x="32" y="33" class="svg-key-text">←</text>
            <text x="32" y="45" class="svg-key-sub">H</text>

            <rect x="58" y="24" width="40" height="32" rx="5" class="svg-key svg-key-active"/>
            <text x="78" y="39" class="svg-key-text active">↓</text>
            <text x="78" y="51" class="svg-key-sub active">J</text>

            <rect x="104" y="12" width="40" height="32" rx="5" class="svg-key svg-key-active"/>
            <text x="124" y="27" class="svg-key-text active">↑</text>
            <text x="124" y="39" class="svg-key-sub active">K</text>

            <rect x="150" y="18" width="40" height="32" rx="5" class="svg-key"/>
            <text x="170" y="33" class="svg-key-text">→</text>
            <text x="170" y="45" class="svg-key-sub">L</text>
          </svg>
        </div>
        <ul class="hint-list">
          <li><span>Вверх / Вниз по таблице</span> <span><kbd>↑</kbd> <kbd>↓</kbd> или <kbd>J</kbd> <kbd>K</kbd></span></li>
          <li><span>Влево / Вправо в журнале</span> <span><kbd>←</kbd> <kbd>→</kbd> или <kbd>H</kbd> <kbd>L</kbd></span></li>
          <li><span>Быстрый переход по вкладкам</span> <span><kbd>1</kbd> – <kbd>5</kbd></span></li>
        </ul>
      </div>

      <!-- Иллюстрированная подсказка 2: Поиск и фильтрация -->
      <div class="idea-hint-card">
        <div class="hint-card-header">
          <span>Мгновенный поиск</span>
          <span class="inlay-hint">Search</span>
        </div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 42" class="hud-svg" aria-hidden="true">
            <rect x="6" y="6" width="136" height="30" rx="5" class="svg-input-box"/>
            <text x="16" y="25" class="svg-prompt">🔍 / Поиск...</text>
            <rect x="150" y="6" width="52" height="30" rx="5" class="svg-key"/>
            <text x="176" y="25" class="svg-key-text">ESC</text>
          </svg>
        </div>
        <ul class="hint-list">
          <li><span>Фокус в поле поиска</span> <kbd>/</kbd></li>
          <li><span>Выбрать учебную группу</span> <kbd>G</kbd></li>
          <li><span>Сбросить фокус / закрыть окно</span> <kbd>Esc</kbd></li>
        </ul>
      </div>
    </div>
  `;

  // 4. ПРАВОЕ ОКНО ИНСТРУМЕНТОВ: Keymap & Быстрый ввод оценок
  const rightToolWin = document.createElement("aside");
  rightToolWin.className = "idea-toolwindow toolwindow-right";
  rightToolWin.setAttribute("aria-label", "Шпаргалка быстрых действий");
  rightToolWin.innerHTML = `
    <div class="toolwindow-header">
      <span class="toolwindow-title">Keymap · Быстрый ввод</span>
      <button type="button" class="toolwindow-hide" data-toggle-right title="Свернуть панель (?)">—</button>
    </div>
    <div class="toolwindow-content">
      <!-- Иллюстрация 1: Поточный ввод оценок в стиле DataGrip / Excel -->
      <div class="idea-hint-card">
        <div class="hint-card-header">
          <span>Поточный ввод оценок</span>
          <span class="inlay-hint">Excel Mode</span>
        </div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 68" class="hud-svg" aria-hidden="true">
            <rect x="12" y="6" width="82" height="24" rx="4" class="svg-cell-active"/>
            <text x="53" y="22" class="svg-key-text active">Нажатие: 5</text>
            <path d="M 102 18 L 128 18 L 128 46 L 100 46" fill="none" class="svg-arrow-path"/>
            <polygon points="100,42 92,46 100,50" class="svg-arrow-head"/>
            <text x="166" y="36" class="svg-key-sub active">Автошаг ↓</text>
            <rect x="12" y="36" width="82" height="24" rx="4" class="svg-key"/>
            <text x="53" y="52" class="svg-key-sub">След. студент</text>
          </svg>
        </div>
        <ul class="hint-list">
          <li><span>Выставить оценку и шагнуть ↓</span> <span><kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> <kbd>5</kbd></span></li>
          <li><span>Очистить оценку в ячейке</span> <span><kbd>Del</kbd> / <kbd>Bksp</kbd></span></li>
          <li><span>Открыть диалог оценки</span> <kbd>Space</kbd></li>
        </ul>
      </div>

      <!-- Иллюстрация 2: Действия со строками (CRUD) -->
      <div class="idea-hint-card">
        <div class="hint-card-header">
          <span>Действия с записями</span>
          <span class="inlay-hint">Actions</span>
        </div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 44" class="hud-svg" aria-hidden="true">
            <rect x="8" y="7" width="58" height="30" rx="5" class="svg-key svg-key-green"/>
            <text x="37" y="26" class="svg-key-text">+ [A]</text>
            <rect x="76" y="7" width="58" height="30" rx="5" class="svg-key svg-key-active"/>
            <text x="105" y="26" class="svg-key-text active">✎ [E]</text>
            <rect x="144" y="7" width="58" height="30" rx="5" class="svg-key svg-key-danger"/>
            <text x="173" y="26" class="svg-key-text">× [D]</text>
          </svg>
        </div>
        <ul class="hint-list">
          <li><span>Создать новую запись</span> <kbd>A</kbd></li>
          <li><span>Редактировать выбранную</span> <span><kbd>E</kbd> / <kbd>Enter</kbd></span></li>
          <li><span>Удалить выбранную строку</span> <kbd>D</kbd></li>
        </ul>
      </div>

      <!-- Иллюстрация 3: Встроенная консоль (:) -->
      <div class="idea-hint-card">
        <div class="hint-card-header">
          <span>Консоль быстрых команд</span>
          <span class="inlay-hint">Terminal</span>
        </div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 42" class="hud-svg" aria-hidden="true">
            <rect x="6" y="6" width="198" height="30" rx="5" class="svg-input-box"/>
            <text x="14" y="25" class="svg-prompt">:grade Иванов Python 5</text>
          </svg>
        </div>
        <ul class="hint-list">
          <li><span>Открыть консоль внизу</span> <kbd>:</kbd></li>
          <li><span>Command Palette (Везде)</span> <kbd>Ctrl+K</kbd></li>
          <li><span>Сменить тему (Dark/OLED/Light)</span> <kbd>Alt+T</kbd></li>
          <li><span>Скрыть/показать подсказки</span> <kbd>?</kbd></li>
        </ul>
      </div>
    </div>
  `;

  // Декоративная строка пути файла вверху центрального редактора (Editor Breadcrumb Bar)
  const editorHeader = document.createElement("div");
  editorHeader.className = "idea-editor-subbar";
  editorHeader.innerHTML = `
    <div class="subbar-path">
      <span class="icon-java">☕</span>
      <span>ru.edu.journal.features.<strong>${path}</strong></span>
      <span class="inlay-hint">SQLite WAL · Foreign Keys ON</span>
    </div>
    <div class="subbar-actions">
      <span class="inlay-hint">Нажмите <kbd>?</kbd> для скрытия боковых панелей</span>
    </div>
  `;
  main.prepend(editorHeader);

  main.parentNode.insertBefore(workbench, main);
  workbench.append(leftStrip, leftToolWin, main, rightToolWin, rightStrip);

  // Восстановление видимости боковых панелей
  const savedHud = localStorage.getItem(HUD_STORAGE_KEY);
  setHudVisibility(savedHud !== "false");

  const hudToggleBtn = document.querySelector("#hud-toggle");
  if (hudToggleBtn) {
    hudToggleBtn.addEventListener("click", () => toggleHudVisibility());
  }

  // Кнопки сворачивания левой и правой панели по отдельности или вместе
  workbench.querySelectorAll("[data-toggle-left]").forEach(btn => {
    btn.addEventListener("click", () => {
      workbench.classList.toggle("left-collapsed");
      leftStrip.querySelector("[data-toggle-left]")?.classList.toggle("active", !workbench.classList.contains("left-collapsed"));
    });
  });

  workbench.querySelectorAll("[data-toggle-right]").forEach(btn => {
    btn.addEventListener("click", () => {
      workbench.classList.toggle("right-collapsed");
      rightStrip.querySelector("[data-toggle-right]")?.classList.toggle("active", !workbench.classList.contains("right-collapsed"));
    });
  });

  // Зелёная кнопка Run ▶ в шапке
  const runBtn = document.querySelector("#idea-run-btn");
  if (runBtn) {
    runBtn.addEventListener("click", () => {
      const exportExcel = document.querySelector("#btn-export-excel");
      const applyFilter = document.querySelector("#apply-filter");
      if (exportExcel) exportExcel.click();
      else if (applyFilter) applyFilter.click();
      else window.location.reload();
    });
  }

  // Кнопка Debug 🐞 (открывает консоль Run Tool Window)
  const debugBtn = document.querySelector("#idea-debug-btn");
  if (debugBtn) {
    debugBtn.addEventListener("click", () => {
      toggleRunWindow();
    });
  }
}

export function setRunWindowVisibility(visible) {
  const runWin = document.querySelector("#idea-run-toolwindow");
  const toggleBtn = document.querySelector("#run-window-toggle");
  if (!runWin) return;
  runWin.hidden = !visible;
  if (toggleBtn) toggleBtn.classList.toggle("active", visible);
  try {
    localStorage.setItem("idea_run_visible", String(visible));
  } catch (e) {}
}

export function toggleRunWindow() {
  const runWin = document.querySelector("#idea-run-toolwindow");
  if (!runWin) return;
  setRunWindowVisibility(runWin.hidden);
}

export function logToRunConsole(msg, level = "INFO") {
  const container = document.querySelector("#run-dynamic-logs");
  if (!container) return;
  const now = new Date();
  const timeStr = now.toISOString().replace("Z", "+03:00");
  const line = document.createElement("div");
  line.className = "run-log-line log-" + level.toLowerCase();
  const safeMsg = String(msg).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  line.innerHTML = `
    <span class="log-time">${timeStr}</span>
    <span class="log-level">${level}</span>
    <span class="log-pid">761156</span>
    <span class="log-src">--- [journal] [ user] :</span>
    <span class="log-msg">${safeMsg}</span>
  `;
  container.append(line);
  const output = document.querySelector("#run-console-log");
  if (output) output.scrollTop = output.scrollHeight;
}

function initRunToolWindow() {
  const runWin = document.querySelector("#idea-run-toolwindow");
  const toggleBtn = document.querySelector("#run-window-toggle");
  const minBtn = document.querySelector("#run-tw-minimize");
  const rerunBtn = document.querySelector("#run-btn-rerun");
  const stopBtn = document.querySelector("#run-btn-stop");
  const clearBtn = document.querySelector("#run-btn-clear");
  const themeBtn = document.querySelector("#run-btn-theme");

  if (!runWin) return;

  if (toggleBtn) toggleBtn.addEventListener("click", () => toggleRunWindow());
  if (minBtn) minBtn.addEventListener("click", () => setRunWindowVisibility(false));

  if (rerunBtn) {
    rerunBtn.addEventListener("click", () => {
      logToRunConsole("Перезагрузка представления и синхронизация кэша...", "INFO");
      window.location.reload();
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      logToRunConsole("Очистка фильтров поиска и сброс формы", "WARN");
      const searchInput = document.querySelector("#search-input");
      if (searchInput) {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
      }
      const groupSelect = document.querySelector("#group-select");
      if (groupSelect && groupSelect.options.length) {
        groupSelect.selectedIndex = 0;
        groupSelect.dispatchEvent(new Event("change"));
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const dyn = document.querySelector("#run-dynamic-logs");
      if (dyn) dyn.replaceChildren();
    });
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => toggleTheme());
  }

  // Хоткей Alt+4 (как в IDEA для вызова панели Run)
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "4" || e.code === "Digit4")) {
      e.preventDefault();
      toggleRunWindow();
    }
  });
}

export function setHudVisibility(visible) {
  const workbench = document.querySelector(".idea-workbench");
  const hudBtn = document.querySelector("#hud-toggle");
  if (!workbench) return;
  workbench.classList.toggle("left-collapsed", !visible);
  workbench.classList.toggle("right-collapsed", !visible);
  workbench.querySelectorAll(".strip-btn[data-toggle-left], .strip-btn[data-toggle-right]").forEach(b => {
    b.classList.toggle("active", visible);
  });
  if (hudBtn) hudBtn.classList.toggle("active", visible);
  try {
    localStorage.setItem(HUD_STORAGE_KEY, String(visible));
  } catch (e) {}
}

export function toggleHudVisibility() {
  const workbench = document.querySelector(".idea-workbench");
  if (!workbench) return;
  const isAnyOpen = !workbench.classList.contains("left-collapsed") || !workbench.classList.contains("right-collapsed");
  setHudVisibility(!isAnyOpen);
}

/** Клавиатурный контроллер в стиле JetBrains DataGrip / IdeaVim */
function initIdeaKeyboardNavigation() {
  let selectedRowIdx = -1;
  const vimModeEl = document.querySelector("#vim-mode-indicator");
  const cursorPosEl = document.querySelector("#status-cursor-pos");

  function updateStatusMode(modeText, modeClass) {
    if (!vimModeEl) return;
    vimModeEl.textContent = modeText;
    vimModeEl.className = "vim-mode " + modeClass;
  }

  function isInputElement(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  document.addEventListener("focusin", (e) => {
    if (e.target.classList && e.target.classList.contains("grade-button")) {
      updateStatusMode("DATAGRIP", "mode-matrix");
      const r = Number(e.target.dataset.row || 0) + 1;
      const c = Number(e.target.dataset.col || 0) + 1;
      if (cursorPosEl) cursorPosEl.textContent = `Ln ${r}, Col ${c}`;
    } else if (isInputElement(e.target)) {
      updateStatusMode("EDITING", "mode-insert");
    } else {
      updateStatusMode("READY", "mode-normal");
    }
  });

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!isInputElement(document.activeElement) &&
          !(document.activeElement && document.activeElement.classList.contains("grade-button"))) {
        updateStatusMode("READY", "mode-normal");
      }
    }, 10);
  });

  function highlightTableRow(delta) {
    const isJournalPage = window.location.pathname.startsWith("/journal");
    if (isJournalPage) {
      const firstCell = document.querySelector("button.grade-button.cell-active") ||
                        document.querySelector("button.grade-button");
      if (firstCell && document.activeElement !== firstCell) {
        firstCell.click();
        firstCell.focus();
      }
      return;
    }

    const tbody = document.querySelector("#table-body");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr")).filter(r => !r.querySelector(".empty-row"));
    if (!rows.length) return;

    rows.forEach(r => r.classList.remove("ranger-selected"));
    selectedRowIdx = Math.max(0, Math.min(selectedRowIdx + delta, rows.length - 1));
    const activeRow = rows[selectedRowIdx];
    if (activeRow) {
      activeRow.classList.add("ranger-selected");
      activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
      if (cursorPosEl) cursorPosEl.textContent = `Ln ${selectedRowIdx + 1}/${rows.length}, Col 1`;
    }
  }

  window.addEventListener("keydown", (e) => {
    const backdrop = document.querySelector("#cmd-palette-backdrop");
    if (backdrop && !backdrop.hidden) return;

    if (e.altKey && ["1", "2", "3", "4", "5"].includes(e.key)) {
      e.preventDefault();
      const routes = ["/groups", "/subjects", "/students", "/journal", "/reports"];
      window.location.href = routes[Number(e.key) - 1];
      return;
    }

    if (e.altKey && e.key.toLowerCase() === "t") {
      e.preventDefault();
      toggleTheme();
      return;
    }

    if (e.key === "Escape") {
      const cancelEdit = document.querySelector("#cancel-edit");
      const editor = document.querySelector("#editor");
      const cancelDelete = document.querySelector("#cancel-delete");
      const confirmation = document.querySelector("#confirmation");

      if (editor && !editor.hidden && cancelEdit) { cancelEdit.click(); return; }
      if (confirmation && !confirmation.hidden && cancelDelete) { cancelDelete.click(); return; }
      if (document.activeElement) {
        document.activeElement.blur();
        updateStatusMode("READY", "mode-normal");
      }
      return;
    }

    if (isInputElement(document.activeElement)) return;

    const inMatrixCell = document.activeElement && document.activeElement.classList.contains("grade-button");

    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      toggleHudVisibility();
      return;
    }

    if (!inMatrixCell && !e.ctrlKey && !e.metaKey && ["1", "2", "3", "4", "5"].includes(e.key)) {
      e.preventDefault();
      const routes = ["/groups", "/subjects", "/students", "/journal", "/reports"];
      window.location.href = routes[Number(e.key) - 1];
      return;
    }

    if (e.key === "/") {
      const searchEl = document.querySelector("#search-input") ||
                       document.querySelector("#journal-student-filter");
      if (searchEl) {
        e.preventDefault();
        searchEl.focus();
        searchEl.select();
      }
      return;
    }

    if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
      const groupSel = document.querySelector("#group-select") || document.querySelector("#filter-group");
      if (groupSel) { e.preventDefault(); groupSel.focus(); }
      return;
    }

    if (!inMatrixCell && (e.key === "j" || e.key === "J" || e.key === "ArrowDown")) {
      e.preventDefault();
      highlightTableRow(1);
      return;
    }
    if (!inMatrixCell && (e.key === "k" || e.key === "K" || e.key === "ArrowUp")) {
      e.preventDefault();
      highlightTableRow(-1);
      return;
    }

    if (!inMatrixCell && (e.key === "a" || e.key === "A") && !e.ctrlKey && !e.metaKey) {
      const addBtn = document.querySelector("#add-record");
      if (addBtn) { e.preventDefault(); addBtn.click(); }
      return;
    }

    if (!inMatrixCell && (e.key === "e" || e.key === "E" || e.key === "Enter")) {
      const selectedRow = document.querySelector("#table-body tr.ranger-selected");
      if (selectedRow) {
        const editBtn = selectedRow.querySelector('button[data-action="edit"]');
        if (editBtn) { e.preventDefault(); editBtn.click(); }
      }
      return;
    }

    if (!inMatrixCell && (e.key === "d" || e.key === "D" || e.key === "Delete")) {
      const selectedRow = document.querySelector("#table-body tr.ranger-selected");
      if (selectedRow) {
        const delBtn = selectedRow.querySelector('button[data-action="delete"]');
        if (delBtn) { e.preventDefault(); delBtn.click(); }
      }
    }
  });
}

/** Окно Search Everywhere (Ctrl+K) в стиле IntelliJ IDEA */
function initSearchEverywhere() {
  if (document.querySelector("#cmd-palette-backdrop")) return;

  const commands = [
    { title: "☕ GroupsController.java — Учебные группы", hint: "Alt+1", action: () => location.href = "/groups" },
    { title: "☕ SubjectsController.java — Дисциплины", hint: "Alt+2", action: () => location.href = "/subjects" },
    { title: "☕ StudentsController.java — Контингент студентов", hint: "Alt+3", action: () => location.href = "/students" },
    { title: "⊞ JournalMatrix.db — Матрица оценок (DataGrip)", hint: "Alt+4", action: () => location.href = "/journal" },
    { title: "📊 ReportsAnalytics.sql — Отчёты и графики", hint: "Alt+5", action: () => location.href = "/reports" },
    { title: "⌨️ Переключить боковые Tool Windows с подсказками", hint: "Клавиша ?", action: () => toggleHudVisibility() },
    { title: "🌙 Тема: JetBrains Dark Lavender (Islands)", hint: "Dark", action: () => setTheme("dark") },
    { title: "🖤 Тема: JetBrains OLED Pitch Black", hint: "OLED", action: () => setTheme("oled") },
    { title: "☀️ Тема: JetBrains Light Violet", hint: "Light", action: () => setTheme("light") }
  ];

  const backdrop = document.createElement("div");
  backdrop.id = "cmd-palette-backdrop";
  backdrop.className = "cmd-backdrop";
  backdrop.hidden = true;

  backdrop.innerHTML = `
    <div class="cmd-modal" role="dialog" aria-modal="true" aria-label="Search Everywhere">
      <div class="idea-search-header">
        <span>🔍 Search Everywhere</span>
        <span class="inlay-hint">Classes · Files · Actions · [ESC — закрыть]</span>
      </div>
      <input type="search" class="cmd-input" placeholder="Введите название раздела, действия или темы...">
      <ul class="cmd-list"></ul>
    </div>
  `;
  document.body.append(backdrop);

  const input = backdrop.querySelector(".cmd-input");
  const list = backdrop.querySelector(".cmd-list");
  let filtered = [...commands];
  let activeIndex = 0;

  function renderList() {
    list.replaceChildren();
    filtered.forEach((cmd, idx) => {
      const li = document.createElement("li");
      li.className = "cmd-item" + (idx === activeIndex ? " active" : "");
      li.innerHTML = `<span>${cmd.title}</span><span class="cmd-shortcut">${cmd.hint}</span>`;
      li.addEventListener("click", () => { closePalette(); cmd.action(); });
      list.append(li);
    });
  }

  function openPalette() {
    backdrop.hidden = false;
    input.value = "";
    filtered = [...commands];
    activeIndex = 0;
    renderList();
    input.focus();
  }

  function closePalette() {
    backdrop.hidden = true;
  }

  const triggerBtn = document.querySelector("#cmd-palette-trigger");
  if (triggerBtn) triggerBtn.addEventListener("click", openPalette);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closePalette();
  });

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    filtered = commands.filter(c => c.title.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q));
    activeIndex = 0;
    renderList();
  });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      backdrop.hidden ? openPalette() : closePalette();
    } else if (!backdrop.hidden) {
      if (e.key === "Escape") closePalette();
      else if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, filtered.length - 1); renderList(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderList(); }
      else if (e.key === "Enter" && filtered[activeIndex]) { e.preventDefault(); closePalette(); filtered[activeIndex].action(); }
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

  startStatusClock();
  mountIdeaWorkspace();
  initIdeaKeyboardNavigation();
  initSearchEverywhere();
  initCliBar();
  initRunToolWindow();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}
