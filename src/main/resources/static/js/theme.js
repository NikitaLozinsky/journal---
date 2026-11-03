// theme.js - Управление светлой и тёмной темой оформления
const THEME_STORAGE_KEY = "journal_theme";

/**
 * Возвращает текущую активную тему: 'dark' (по умолчанию) или 'light'.
 */
export function getCurrentTheme() {
  const currentAttr = document.documentElement.getAttribute("data-theme");
  if (currentAttr === "dark" || currentAttr === "light") {
    return currentAttr;
  }
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return "dark"; // Тёмная тема по умолчанию
}

/**
 * Устанавливает и сохраняет тему.
 */
export function setTheme(theme) {
  const chosen = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", chosen);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, chosen);
  } catch (e) {
    // В случае ограничений localStorage
  }
  updateThemeButton(chosen);
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: chosen } }));
  return chosen;
}

/**
 * Переключает тему между 'dark' и 'light'.
 */
export function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === "light" ? "dark" : "light";
  return setTheme(next);
}

/**
 * Обновляет внешний вид кнопки переключения темы в шапке.
 */
function updateThemeButton(theme) {
  const btn = document.querySelector("#theme-toggle");
  if (!btn) return;
  const isLight = theme === "light";
  const icon = btn.querySelector(".theme-toggle-icon");
  const text = btn.querySelector(".theme-toggle-text");
  if (icon) icon.textContent = isLight ? "🌙" : "☀️";
  if (text) text.textContent = isLight ? "Тёмная тема" : "Светлая тема";
  btn.setAttribute("title", isLight ? "Переключить на тёмную тему" : "Переключить на светлую тему");
  btn.setAttribute("aria-label", isLight ? "Переключить на тёмную тему" : "Переключить на светлую тему");
}

/**
 * Инициализирует тему при загрузке страницы.
 */
export function initTheme() {
  const active = getCurrentTheme();
  document.documentElement.setAttribute("data-theme", active);
  updateThemeButton(active);

  const btn = document.querySelector("#theme-toggle");
  if (btn && !btn.dataset.initialized) {
    btn.dataset.initialized = "true";
    btn.addEventListener("click", () => {
      toggleTheme();
    });
  }
}

// Запуск при готовности DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTheme);
} else {
  initTheme();
}
