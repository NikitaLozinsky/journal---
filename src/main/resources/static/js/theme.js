// theme.js - Оконный менеджер bspwm, боковые иллюстрации-шпаргалки, темы и горячие клавиши
import { initCliBar } from "/js/cli.js";

const THEME_STORAGE_KEY = "journal_theme";
const HUD_STORAGE_KEY = "journal_hud_visible";
const THEMES = ["dark", "oled", "light"];

const THEME_META = {
  dark:  { icon: "󰄛", label: "Dracula-Pink", nextLabel: "Включить OLED-режим" },
  oled:  { icon: "󰌵", label: "OLED Black",   nextLabel: "Включить светлую тему" },
  light: { icon: "󰖨", label: "Light Violet", nextLabel: "Включить тему Dracula" }
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

/** Часы в Polybar */
function startPolybarClock() {
  const clockEl = document.querySelector("#polybar-clock");
  if (!clockEl) return;
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };
  update();
  setInterval(update, 10000);
}

/** Создаёт боковые тайловые панели с векторными мини-иллюстрациями */
function mountBspwmLayout() {
  const main = document.querySelector("main#main-content");
  if (!main || document.querySelector(".bspwm-desktop")) return;

  // Создаём тайловый контейнер рабочего стола
  const desktop = document.createElement("div");
  desktop.className = "bspwm-desktop";

  // Декоративная шапка терминального окна для центрального тайла
  const pathName = window.location.pathname.replace("/", "") || "groups";
  const winBar = document.createElement("div");
  winBar.className = "bspwm-winbar";
  winBar.innerHTML = `
    <span class="winbar-title"><span class="pink-accent">milk13@journal</span>:<span class="lavender-accent">~/features/${pathName}</span>$</span>
    <span class="winbar-flags">[tiled · master]</span>
  `;
  main.prepend(winBar);

  // ЛЕВЫЙ ТАЙЛ: Навигация и Воркспейсы (с SVG-иллюстрациями)
  const leftDock = document.createElement("aside");
  leftDock.className = "bspwm-hud-dock hud-left";
  leftDock.setAttribute("aria-label", "Шпаргалка навигации");
  leftDock.innerHTML = `
    <div class="bspwm-winbar">
      <span class="winbar-title">┌─ навигация_клавиатурой</span>
      <button type="button" class="winbar-close" data-close-hud title="Скрыть панели (?)">×</button>
    </div>
    <div class="hud-body">
      <!-- Карточка 1: Воркспейсы -->
      <div class="hud-card">
        <div class="hud-card-title"><span class="tree-branch">├─</span> Воркспейсы (1..5)</div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 46" class="hud-svg" aria-hidden="true">
            <rect x="4" y="8" width="34" height="28" rx="3" class="svg-key"/>
            <text x="21" y="26" class="svg-key-text">1</text>
            <rect x="44" y="8" width="34" height="28" rx="3" class="svg-key"/>
            <text x="61" y="26" class="svg-key-text">2</text>
            <rect x="84" y="8" width="34" height="28" rx="3" class="svg-key"/>
            <text x="101" y="26" class="svg-key-text">3</text>
            <rect x="124" y="8" width="34" height="28" rx="3" class="svg-key svg-key-active"/>
            <text x="141" y="26" class="svg-key-text active">4</text>
            <rect x="164" y="8" width="34" height="28" rx="3" class="svg-key"/>
            <text x="181" y="26" class="svg-key-text">5</text>
            <line x1="124" y1="41" x2="158" y2="41" class="svg-accent-line"/>
          </svg>
        </div>
        <ul class="hud-tree-list">
          <li><span class="tree-branch">│</span> <kbd>1</kbd>–<kbd>5</kbd> переход по вкладкам</li>
          <li><span class="tree-branch">└─</span> <kbd>Alt+1..5</kbd> из любого поля</li>
        </ul>
      </div>

      <!-- Карточка 2: Перемещение HJKL и Стрелки -->
      <div class="hud-card">
        <div class="hud-card-title"><span class="tree-branch">├─</span> Движение (Vim / Стрелки)</div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 64" class="hud-svg" aria-hidden="true">
            <!-- Клавиша H / Left -->
            <rect x="12" y="20" width="40" height="32" rx="3" class="svg-key"/>
            <text x="32" y="35" class="svg-key-text">H</text>
            <text x="32" y="47" class="svg-key-sub">←</text>
            <!-- Клавиша J / Down -->
            <rect x="58" y="26" width="40" height="32" rx="3" class="svg-key svg-key-active"/>
            <text x="78" y="41" class="svg-key-text active">J</text>
            <text x="78" y="53" class="svg-key-sub active">↓</text>
            <!-- Клавиша K / Up -->
            <rect x="104" y="14" width="40" height="32" rx="3" class="svg-key svg-key-active"/>
            <text x="124" y="29" class="svg-key-text active">K</text>
            <text x="124" y="41" class="svg-key-sub active">↑</text>
            <!-- Клавиша L / Right -->
            <rect x="150" y="20" width="40" height="32" rx="3" class="svg-key"/>
            <text x="170" y="35" class="svg-key-text">L</text>
            <text x="170" y="47" class="svg-key-sub">→</text>
          </svg>
        </div>
        <ul class="hud-tree-list">
          <li><span class="tree-branch">├─</span> <kbd>J</kbd> / <kbd>↓</kbd> на строку ниже</li>
          <li><span class="tree-branch">├─</span> <kbd>K</kbd> / <kbd>↑</kbd> на строку выше</li>
          <li><span class="tree-branch">└─</span> <kbd>H</kbd> <kbd>L</kbd> / <kbd>←</kbd> <kbd>→</kbd> по предметам</li>
        </ul>
      </div>

      <!-- Карточка 3: Поиск и Фокус -->
      <div class="hud-card">
        <div class="hud-card-title"><span class="tree-branch">└─</span> Поиск и фильтры</div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 42" class="hud-svg" aria-hidden="true">
            <rect x="6" y="6" width="136" height="30" rx="3" class="svg-input-box"/>
            <text x="16" y="25" class="svg-prompt">/ фильтр...</text>
            <rect x="150" y="6" width="52" height="30" rx="3" class="svg-key"/>
            <text x="176" y="25" class="svg-key-text">ESC</text>
          </svg>
        </div>
        <ul class="hud-tree-list">
          <li><span class="tree-branch">├─</span> <kbd>/</kbd> фокус в поле поиска</li>
          <li><span class="tree-branch">├─</span> <kbd>G</kbd> выбор учебной группы</li>
          <li><span class="tree-branch">└─</span> <kbd>Esc</kbd> возврат в таблицу</li>
        </ul>
      </div>
    </div>
  `;

  // ПРАВЫЙ ТАЙЛ: Быстрый ввод в журнале, CRUD-действия и Терминал Ex-mode
  const rightDock = document.createElement("aside");
  rightDock.className = "bspwm-hud-dock hud-right";
  rightDock.setAttribute("aria-label", "Шпаргалка действий");
  rightDock.innerHTML = `
    <div class="bspwm-winbar">
      <span class="winbar-title">┌─ операции_и_матрица</span>
      <button type="button" class="winbar-close" data-close-hud title="Скрыть панели (?)">×</button>
    </div>
    <div class="hud-body">
      <!-- Карточка 1: Конвейер оценок -->
      <div class="hud-card">
        <div class="hud-card-title"><span class="tree-branch">├─</span> Конвейер оценок (Excel)</div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 68" class="hud-svg" aria-hidden="true">
            <!-- Ячейка 1: Ввод 5 -->
            <rect x="14" y="6" width="76" height="24" rx="2" class="svg-cell-active"/>
            <text x="52" y="22" class="svg-key-text active">Оценка: 5</text>
            <!-- Стрелка автошага -->
            <path d="M 102 18 L 128 18 L 128 46 L 100 46" fill="none" class="svg-arrow-path"/>
            <polygon points="100,42 92,46 100,50" class="svg-arrow-head"/>
            <text x="165" y="36" class="svg-key-sub active">Автошаг ↓</text>
            <!-- Ячейка 2: Следующий студент -->
            <rect x="14" y="36" width="76" height="24" rx="2" class="svg-key"/>
            <text x="52" y="52" class="svg-key-sub">След. строка</text>
          </svg>
        </div>
        <ul class="hud-tree-list">
          <li><span class="tree-branch">├─</span> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> <kbd>5</kbd> поставить и шаг ↓</li>
          <li><span class="tree-branch">├─</span> <kbd>Del</kbd> / <kbd>Bksp</kbd> / <kbd>X</kbd> стереть оценку</li>
          <li><span class="tree-branch">└─</span> <kbd>Space</kbd> / <kbd>E</kbd> открыть окно оценки</li>
        </ul>
      </div>

      <!-- Карточка 2: CRUD Операции со строками -->
      <div class="hud-card">
        <div class="hud-card-title"><span class="tree-branch">├─</span> Управление записями</div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 46" class="hud-svg" aria-hidden="true">
            <rect x="8" y="8" width="58" height="30" rx="3" class="svg-key svg-key-green"/>
            <text x="37" y="27" class="svg-key-text">+ [A]</text>
            <rect x="76" y="8" width="58" height="30" rx="3" class="svg-key svg-key-active"/>
            <text x="105" y="27" class="svg-key-text active">✎ [E]</text>
            <rect x="144" y="8" width="58" height="30" rx="3" class="svg-key svg-key-danger"/>
            <text x="173" y="27" class="svg-key-text">× [D]</text>
          </svg>
        </div>
        <ul class="hud-tree-list">
          <li><span class="tree-branch">├─</span> <kbd>A</kbd> добавить новую запись</li>
          <li><span class="tree-branch">├─</span> <kbd>E</kbd> / <kbd>Enter</kbd> изменить строку</li>
          <li><span class="tree-branch">└─</span> <kbd>D</kbd> / <kbd>Del</kbd> удалить строку</li>
        </ul>
      </div>

      <!-- Карточка 3: Терминал Ex-mode (:) -->
      <div class="hud-card">
        <div class="hud-card-title"><span class="tree-branch">└─</span> Консоль Ex-Mode (:)</div>
        <div class="hud-illustration">
          <svg viewBox="0 0 210 44" class="hud-svg" aria-hidden="true">
            <rect x="4" y="8" width="202" height="28" rx="2" class="svg-input-box"/>
            <text x="12" y="26" class="svg-prompt">:grade Иванов Python 5</text>
            <rect x="172" y="13" width="28" height="18" rx="2" class="svg-key svg-key-active"/>
            <text x="186" y="25" class="svg-key-sub active">RET</text>
          </svg>
        </div>
        <ul class="hud-tree-list">
          <li><span class="tree-branch">├─</span> <kbd>:</kbd> открыть командную строку</li>
          <li><span class="tree-branch">├─</span> <kbd>:g ФИО Предм 5</kbd> оценка</li>
          <li><span class="tree-branch">├─</span> <kbd>:add БЭИ2401</kbd> создать</li>
          <li><span class="tree-branch">└─</span> <kbd>Tab</kbd> автодополнение</li>
        </ul>
      </div>
    </div>
  `;

  main.parentNode.insertBefore(desktop, main);
  desktop.append(leftDock, main, rightDock);

  // Восстановление состояния видимости HUD
  const savedHud = localStorage.getItem(HUD_STORAGE_KEY);
  const isHudVisible = savedHud !== "false";
  setHudVisibility(isHudVisible);

  const hudToggleBtn = document.querySelector("#hud-toggle");
  if (hudToggleBtn) {
    hudToggleBtn.addEventListener("click", () => toggleHudVisibility());
  }
  desktop.querySelectorAll("[data-close-hud]").forEach(btn => {
    btn.addEventListener("click", () => setHudVisibility(false));
  });
}

export function setHudVisibility(visible) {
  const desktop = document.querySelector(".bspwm-desktop");
  const hudBtn = document.querySelector("#hud-toggle");
  if (!desktop) return;
  desktop.classList.toggle("hud-collapsed", !visible);
  if (hudBtn) hudBtn.classList.toggle("active", visible);
  try {
    localStorage.setItem(HUD_STORAGE_KEY, String(visible));
  } catch (e) {}
}

export function toggleHudVisibility() {
  const desktop = document.querySelector(".bspwm-desktop");
  if (!desktop) return;
  const currentlyCollapsed = desktop.classList.contains("hud-collapsed");
  setHudVisibility(currentlyCollapsed);
}

/** Глобальный контроллер клавиатуры в стиле Vim / Ranger / bspwm */
function initBspwmKeyboardNavigation() {
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

  // Отслеживание фокуса для переключения индикатора NORMAL / INSERT / MATRIX
  document.addEventListener("focusin", (e) => {
    if (e.target.classList && e.target.classList.contains("grade-button")) {
      updateStatusMode("MATRIX", "mode-matrix");
      const r = Number(e.target.dataset.row || 0) + 1;
      const c = Number(e.target.dataset.col || 0) + 1;
      if (cursorPosEl) cursorPosEl.textContent = `CELL ${r}:${c}`;
    } else if (isInputElement(e.target)) {
      if (e.target.id === "cli-input") {
        updateStatusMode("COMMAND", "mode-command");
      } else {
        updateStatusMode("INSERT", "mode-insert");
      }
    } else {
      updateStatusMode("NORMAL", "mode-normal");
    }
  });

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!isInputElement(document.activeElement) &&
          !(document.activeElement && document.activeElement.classList.contains("grade-button"))) {
        updateStatusMode("NORMAL", "mode-normal");
      }
    }, 10);
  });

  /** Выделение строки в обычных таблицах (Группы, Предметы, Студенты, Отчёты) */
  function highlightTableRow(delta) {
    const isJournalPage = window.location.pathname.startsWith("/journal");
    if (isJournalPage) {
      // В журнале фокусируем первую ячейку матрицы, если ещё не в ней
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
      if (cursorPosEl) cursorPosEl.textContent = `ROW ${selectedRowIdx + 1}/${rows.length}`;
    }
  }

  window.addEventListener("keydown", (e) => {
    const backdrop = document.querySelector("#cmd-palette-backdrop");
    if (backdrop && !backdrop.hidden) return;

    // 1. Глобальные хоткеи с модификаторами (работают даже из полей ввода)
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

    // Escape универсально закрывает открытые формы/модалки или снимает фокус с инпута
    if (e.key === "Escape") {
      const cancelEdit = document.querySelector("#cancel-edit");
      const editor = document.querySelector("#editor");
      const cancelDelete = document.querySelector("#cancel-delete");
      const confirmation = document.querySelector("#confirmation");

      if (editor && !editor.hidden && cancelEdit) {
        cancelEdit.click();
        return;
      }
      if (confirmation && !confirmation.hidden && cancelDelete) {
        cancelDelete.click();
        return;
      }
      if (document.activeElement) {
        document.activeElement.blur();
        updateStatusMode("NORMAL", "mode-normal");
      }
      return;
    }

    // Если пользователь печатает в input/select — не перехватываем одиночные буквы
    if (isInputElement(document.activeElement)) return;

    // Если фокус уже внутри кнопки матрицы журнала — её обрабатывает journal.js, кроме ? и 1..5 с Alt
    const inMatrixCell = document.activeElement && document.activeElement.classList.contains("grade-button");

    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      toggleHudVisibility();
      return;
    }

    // Переход по воркспейсам клавишами 1..5 (когда не в ячейке журнала, где 2..5 ставят оценки)
    if (!inMatrixCell && !e.ctrlKey && !e.metaKey && ["1", "2", "3", "4", "5"].includes(e.key)) {
      e.preventDefault();
      const routes = ["/groups", "/subjects", "/students", "/journal", "/reports"];
      window.location.href = routes[Number(e.key) - 1];
      return;
    }

    // Поиск по нажатию /
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

    // Выбор группы по клавише G
    if (e.key.toLowerCase() === "g" && !e.ctrlKey && !e.metaKey) {
      const groupSel = document.querySelector("#group-select") || document.querySelector("#filter-group");
      if (groupSel) {
        e.preventDefault();
        groupSel.focus();
      }
      return;
    }

    // Навигация J / K или Стрелки вниз/вверх для таблиц
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

    // Клавиша A — Добавить запись
    if (!inMatrixCell && (e.key === "a" || e.key === "A") && !e.ctrlKey && !e.metaKey) {
      const addBtn = document.querySelector("#add-record");
      if (addBtn) {
        e.preventDefault();
        addBtn.click();
      }
      return;
    }

    // Клавиша E или Enter — Изменить выбранную строку таблицы
    if (!inMatrixCell && (e.key === "e" || e.key === "E" || e.key === "Enter")) {
      const selectedRow = document.querySelector("#table-body tr.ranger-selected");
      if (selectedRow) {
        const editBtn = selectedRow.querySelector('button[data-action="edit"]');
        if (editBtn) {
          e.preventDefault();
          editBtn.click();
        }
      }
      return;
    }

    // Клавиша D или Delete — Удалить выбранную строку таблицы
    if (!inMatrixCell && (e.key === "d" || e.key === "D" || e.key === "Delete")) {
      const selectedRow = document.querySelector("#table-body tr.ranger-selected");
      if (selectedRow) {
        const delBtn = selectedRow.querySelector('button[data-action="delete"]');
        if (delBtn) {
          e.preventDefault();
          delBtn.click();
        }
      }
    }
  });
}

/** Командная палитра (Ctrl+K) в стиле Rofi / dmenu */
function initCommandPalette() {
  if (document.querySelector("#cmd-palette-backdrop")) return;

  const commands = [
    { title: "1: Перейти в Учебные группы", hint: "Workspace 1", action: () => location.href = "/groups" },
    { title: "2: Перейти к Предметам", hint: "Workspace 2", action: () => location.href = "/subjects" },
    { title: "3: Перейти к Студентам", hint: "Workspace 3", action: () => location.href = "/students" },
    { title: "4: Открыть Журнал успеваемости", hint: "Workspace 4", action: () => location.href = "/journal" },
    { title: "5: Открыть Отчёты и аналитику", hint: "Workspace 5", action: () => location.href = "/reports" },
    { title: "HUD: Переключить боковые панели с иллюстрациями", hint: "Клавиша ?", action: () => toggleHudVisibility() },
    { title: "Тема: Dracula Pink Accent (bspwm)", hint: "Dark", action: () => setTheme("dark") },
    { title: "Тема: Pitch Black (Режим для OLED)", hint: "OLED", action: () => setTheme("oled") },
    { title: "Тема: Alabaster Violet (Светлая)", hint: "Light", action: () => setTheme("light") }
  ];

  const backdrop = document.createElement("div");
  backdrop.id = "cmd-palette-backdrop";
  backdrop.className = "cmd-backdrop";
  backdrop.hidden = true;

  backdrop.innerHTML = `
    <div class="cmd-modal" role="dialog" aria-modal="true" aria-label="Rofi Launcher">
      <div class="bspwm-winbar">
        <span class="winbar-title">rofi -show drun</span>
        <span class="winbar-flags">[ESC — закрыть]</span>
      </div>
      <input type="search" class="cmd-input" placeholder="drun: введите команду или номер воркспейса...">
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

  startPolybarClock();
  mountBspwmLayout();
  initBspwmKeyboardNavigation();
  initCommandPalette();
  initCliBar();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}
