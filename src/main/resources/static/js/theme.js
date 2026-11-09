const THEME_STORAGE_KEY = "journal_theme";
const OLED_STORAGE_KEY = "journal_oled";
const THEMES = ["dark", "light"];

export function getCurrentTheme() {
  const currentAttr = document.documentElement.getAttribute("data-theme");
  if (THEMES.includes(currentAttr)) return currentAttr;
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch (e) {}
  return "dark";
}

export function isOledActive() {
  try {
    return localStorage.getItem(OLED_STORAGE_KEY) === "true";
  } catch (e) {
    return false;
  }
}

export function setTheme(theme) {
  const chosen = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", chosen);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, chosen);
  } catch (e) {}

  if (chosen === "dark") {
    if (isOledActive()) {
      document.documentElement.setAttribute("data-oled", "true");
    } else {
      document.documentElement.removeAttribute("data-oled");
    }
  } else {
    document.documentElement.removeAttribute("data-oled");
  }

  updateUI(chosen);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: chosen, oled: isOledActive() } }));
  return chosen;
}

export function setOled(enabled) {
  const currentTheme = getCurrentTheme();
  try {
    localStorage.setItem(OLED_STORAGE_KEY, String(enabled));
  } catch (e) {}

  if (currentTheme === "dark") {
    if (enabled) {
      document.documentElement.setAttribute("data-oled", "true");
    } else {
      document.documentElement.removeAttribute("data-oled");
    }
  }

  updateOledCheckbox(enabled);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: currentTheme, oled: enabled } }));
  return enabled;
}

export function toggleTheme() {
  const current = getCurrentTheme();
  return setTheme(current === "dark" ? "light" : "dark");
}

export function toggleOled() {
  return setOled(!isOledActive());
}

function updateUI(theme) {
  const btn = document.querySelector("#theme-toggle");
  if (btn) {
    const isLight = theme === "light";
    const icon = btn.querySelector(".theme-toggle-icon");
    const text = btn.querySelector(".theme-toggle-text");
    if (icon) icon.textContent = isLight ? "☀️" : "🌙";
    if (text) text.textContent = isLight ? "Светлая" : "Тёмная";
    const nextLabel = isLight ? "Включить тёмную тему" : "Включить светлую тему";
    btn.setAttribute("title", `${nextLabel} (Alt+T)`);
    btn.setAttribute("aria-label", nextLabel);
  }

  const oledWrap = document.querySelector("#oled-toggle-wrap");
  if (oledWrap) {
    oledWrap.hidden = (theme === "light");
  }
  updateOledCheckbox(isOledActive());
}

function updateOledCheckbox(enabled) {
  const chk = document.querySelector("#oled-toggle");
  if (chk) {
    chk.checked = enabled;
  }
}

/** Инициализация глобальной командной палитры (Ctrl+K / Cmd+K) */
function initCommandPalette() {
  if (document.querySelector("#cmd-palette-backdrop")) return;

  const commands = [
    { title: "📘 Перейти в Журнал оценок", hint: "/journal", action: () => location.href = "/journal" },
    { title: "⚡ Массовое оценивание группы", hint: "Bulk Grade", action: () => { if (location.pathname === "/journal") { const btn = document.querySelector("#btn-bulk-grade"); if (btn) btn.click(); } else { location.href = "/journal"; } } },
    { title: "🎓 Перейти к списку Студентов", hint: "/students", action: () => location.href = "/students" },
    { title: "👥 Перейти к Учебным группам", hint: "/groups", action: () => location.href = "/groups" },
    { title: "📚 Перейти к Предметам", hint: "/subjects", action: () => location.href = "/subjects" },
    { title: "📊 Перейти к Отчётам и аналитике", hint: "/reports", action: () => location.href = "/reports" },
    { title: "🌙 Тёмная тема (Серо-графитовая)", hint: "Dark", action: () => setTheme("dark") },
    { title: "☀️ Светлая тема (Алебастровая)", hint: "Light", action: () => setTheme("light") },
    { title: "🖤 OLED-режим (для тёмной темы)", hint: "Alt+O", action: () => { setTheme("dark"); toggleOled(); } }
  ];

  const backdrop = document.createElement("div");
  backdrop.id = "cmd-palette-backdrop";
  backdrop.className = "cmd-backdrop";
  backdrop.hidden = true;

  backdrop.innerHTML = `
    <div class="cmd-modal" role="dialog" aria-modal="true" aria-label="Быстрые команды">
      <input type="search" class="cmd-input" placeholder="Введите команду или раздел... (Esc — закрыть)">
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
    } else if (e.altKey && e.key.toLowerCase() === "t") {
      e.preventDefault();
      toggleTheme();
    } else if (e.altKey && e.key.toLowerCase() === "o") {
      e.preventDefault();
      if (getCurrentTheme() === "dark") {
        toggleOled();
      }
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
  setTheme(active);

  const themeBtn = document.querySelector("#theme-toggle");
  if (themeBtn && !themeBtn.dataset.initialized) {
    themeBtn.dataset.initialized = "true";
    themeBtn.addEventListener("click", () => toggleTheme());
  }

  const oledChk = document.querySelector("#oled-toggle");
  if (oledChk && !oledChk.dataset.initialized) {
    oledChk.dataset.initialized = "true";
    oledChk.addEventListener("change", () => setOled(oledChk.checked));
  }

  initCommandPalette();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}
