// cli.js - Встроенная командная консоль в стиле Vim Ex-mode / fish shell
import { requestJSON } from "/js/api.js";
import { message } from "/js/ui.js";
import { setTheme, setHudVisibility, toggleHudVisibility } from "/js/theme.js";

const HISTORY_KEY = "journal_cli_history";

const BASE_COMMANDS = [
  { cmd: "grade ",        desc: "grade <ФИО> <Предмет> <2..5|del> — выставить/удалить оценку" },
  { cmd: "add ",          desc: "add <Название> — добавить запись в текущем разделе" },
  { cmd: "add group ",    desc: "add group <Название> — создать учебную группу" },
  { cmd: "add subject ",  desc: "add subject <Название> — создать дисциплину" },
  { cmd: "add student ",  desc: "add student <Группа> <ФИО> [email] — добавить студента" },
  { cmd: "w excel",       desc: "w excel — скачать журнал текущей группы в .xlsx" },
  { cmd: "w csv",         desc: "w csv — скачать журнал текущей группы в .csv" },
  { cmd: "print",         desc: "print — печать официальной ведомости А4" },
  { cmd: "theme dark",    desc: "theme dark — тема Dracula Pink Accent" },
  { cmd: "theme oled",    desc: "theme oled — тема Pitch Black для OLED" },
  { cmd: "theme light",   desc: "theme light — светлая бело-фиолетовая тема" },
  { cmd: "hud on",        desc: "hud on — показать боковые панели с иллюстрациями" },
  { cmd: "hud off",       desc: "hud off — скрыть боковые панели" },
  { cmd: "del",           desc: "del — удалить выбранную строку таблицы" },
  { cmd: "clear",         desc: "clear — сбросить фильтры и поиск" },
  { cmd: "open journal",  desc: "open <groups|subjects|students|journal|reports>" }
];

let cache = { groups: null, subjects: null, students: null };
let history = [];
let historyIdx = -1;
let currentSuggestions = [];
let activeSuggestionIdx = 0;

try {
  history = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
} catch (e) {
  history = [];
}

function saveHistory(cmdLine) {
  if (!cmdLine) return;
  history = [cmdLine, ...history.filter(item => item !== cmdLine)].slice(0, 50);
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {}
}

/** Фоновая подгрузка справочников для живого автодополнения */
async function ensureCache(force = false) {
  try {
    if (force || !cache.groups) {
      const [g, sub, st] = await Promise.all([
        requestJSON("/api/groups"),
        requestJSON("/api/subjects"),
        requestJSON("/api/students")
      ]);
      cache.groups = g.items || [];
      cache.subjects = sub.items || [];
      cache.students = st.items || [];
    }
  } catch (e) {
    // Игнорируем ошибки сети при фоновом префетче
  }
}

/** Обновляет данные на текущей странице после выполнения команды без перезагрузки */
function refreshCurrentPageView() {
  const path = window.location.pathname;
  if (path.startsWith("/journal")) {
    const groupSelect = document.querySelector("#group-select");
    if (groupSelect && groupSelect.value) {
      groupSelect.dispatchEvent(new Event("change"));
      return;
    }
  }
  if (path.startsWith("/students")) {
    window.location.reload();
    return;
  }
  window.location.reload();
}

/** Вычисляет контекстные подсказки и fish-автодополнение */
function buildSuggestions(rawInput) {
  const val = rawInput.replace(/^:/, "");
  const lower = val.toLowerCase();

  // 1. Автодополнение для :grade <Студент> <Предмет> <Оценка>
  if (lower.startsWith("grade ") || lower.startsWith("g ")) {
    const prefix = val.match(/^(grade|g)\s+/i)[0];
    const rest = val.slice(prefix.length);
    const parts = rest.split(/\s+/);

    if (parts.length <= 1 && cache.students) {
      const q = (parts[0] || "").toLowerCase();
      return cache.students
        .filter(s => s.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map(s => {
          const surname = s.name.split(/\s+/)[0];
          return {
            cmd: `${prefix}${surname} `,
            desc: `Студент: ${s.name} (${s.group_name || "группа"})`
          };
        });
    }

    if (parts.length === 2 && cache.subjects) {
      const studentPart = parts[0];
      const subQ = parts[1].toLowerCase();
      return cache.subjects
        .filter(sub => sub.name.toLowerCase().includes(subQ))
        .map(sub => ({
          cmd: `${prefix}${studentPart} "${sub.name}" 5`,
          desc: `Выставить 5 по предмету «${sub.name}»`
        }));
    }
  }

  // 2. Автодополнение для :add student <Группа> <ФИО>
  if ((lower.startsWith("add student ") || lower.startsWith("ast ")) && cache.groups) {
    const prefix = val.match(/^(add\s+student|ast)\s+/i)[0];
    const rest = val.slice(prefix.length);
    const parts = rest.split(/\s+/);
    if (parts.length <= 1) {
      const gQ = (parts[0] || "").toLowerCase();
      return cache.groups
        .filter(g => g.name.toLowerCase().includes(gQ))
        .map(g => ({
          cmd: `${prefix}${g.name} `,
          desc: `Группа ${g.name} (студентов: ${g.student_count})`
        }));
    }
  }

  // 3. Базовые команды
  return BASE_COMMANDS.filter(item =>
    item.cmd.toLowerCase().startsWith(lower) || item.desc.toLowerCase().includes(lower)
  ).slice(0, 7);
}

/** Парсит аргументы с поддержкой кавычек (например: :grade Иванов "Базы данных" 5) */
function tokenizeArgs(str) {
  const tokens = [];
  const regex = /"([^"]+)"|'([^']+)'|(\S+)/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    tokens.push(match[1] || match[2] || match[3]);
  }
  return tokens;
}

/** Выполняет введённую команду */
async function executeCommand(rawLine) {
  const clean = rawLine.trim().replace(/^:/, "").trim();
  if (!clean) return;

  saveHistory(clean);
  const tokens = tokenizeArgs(clean);
  const verb = tokens[0].toLowerCase();
  const args = tokens.slice(1);

  try {
    // 1. Переход по номерам воркспейсов :1 .. :5
    if (["1", "2", "3", "4", "5"].includes(verb)) {
      const routes = ["/groups", "/subjects", "/students", "/journal", "/reports"];
      window.location.href = routes[Number(verb) - 1];
      return;
    }

    // 2. Переход по имени раздела :open / :o / :e
    if (verb === "open" || verb === "o" || verb === "e") {
      const target = (args[0] || "").toLowerCase();
      const map = {
        "1": "/groups", "groups": "/groups", "группы": "/groups",
        "2": "/subjects", "subjects": "/subjects", "предметы": "/subjects",
        "3": "/students", "students": "/students", "студенты": "/students",
        "4": "/journal", "journal": "/journal", "журнал": "/journal",
        "5": "/reports", "reports": "/reports", "отчеты": "/reports", "отчёты": "/reports"
      };
      if (map[target]) {
        window.location.href = map[target];
      } else {
        message(`Неизвестный раздел: ${target}`, true);
      }
      return;
    }

    // 3. Смена темы :theme <dark|oled|light>
    if (verb === "theme" || verb === "t") {
      const mode = (args[0] || "dark").toLowerCase();
      setTheme(mode);
      message(`Тема переключена: ${mode.toUpperCase()}`);
      return;
    }

    // 4. Управление боковыми панелями :hud <on|off>
    if (verb === "hud") {
      const sub = (args[0] || "").toLowerCase();
      if (sub === "on") setHudVisibility(true);
      else if (sub === "off") setHudVisibility(false);
      else toggleHudVisibility();
      return;
    }

    // 5. Печать :print / :hardcopy
    if (verb === "print" || verb === "hardcopy") {
      window.print();
      return;
    }

    // 6. Сброс фильтров :clear / :noh
    if (verb === "clear" || verb === "noh") {
      const resetBtn = document.querySelector("#reset-filter");
      if (resetBtn) resetBtn.click();
      const jFilter = document.querySelector("#journal-student-filter");
      const jStatus = document.querySelector("#journal-status-filter");
      if (jFilter) { jFilter.value = ""; jFilter.dispatchEvent(new Event("input")); }
      if (jStatus) { jStatus.value = "all"; jStatus.dispatchEvent(new Event("change")); }
      message("Фильтры сброшены.");
      return;
    }

    // 7. Экспорт :export <excel|csv> или :w <excel|csv>
    if (verb === "export" || verb === "w") {
      await ensureCache();
      const fmt = (args[0] || "excel").toLowerCase();
      const groupSelect = document.querySelector("#group-select") || document.querySelector("#filter-group");
      const groupId = (groupSelect && groupSelect.value) ? groupSelect.value : (cache.groups?.[0]?.id);
      if (!groupId) {
        message("Нет доступной учебной группы для экспорта.", true);
        return;
      }
      if (fmt === "csv") {
        window.location.href = `/api/journal/export/csv?group_id=${groupId}`;
        message("Экспорт CSV запущен...");
      } else {
        window.location.href = `/api/journal/export/excel?group_id=${groupId}`;
        message("Экспорт Excel (.xlsx) запущен...");
      }
      return;
    }

    // 8. Удаление выбранной строки :del / :d
    if (verb === "del" || verb === "d") {
      const selectedRow = document.querySelector("#table-body tr.ranger-selected");
      if (!selectedRow) {
        message("Сначала выберите строку клавишами J / K.", true);
        return;
      }
      const delBtn = selectedRow.querySelector('button[data-action="delete"]');
      if (delBtn) delBtn.click();
      return;
    }

    // 9. Выставление или удаление оценки :grade <ФИО> <Предмет> <2..5|del>
    if (verb === "grade" || verb === "g") {
      if (args.length < 3) {
        message("Формат: :grade <ФИО> <Предмет> <2..5|del>", true);
        return;
      }
      await ensureCache(true);
      const markArg = args[args.length - 1].toLowerCase();
      const subjectQuery = args[args.length - 2].toLowerCase();
      const studentQuery = args.slice(0, args.length - 2).join(" ").toLowerCase();

      const student = cache.students.find(s => s.name.toLowerCase().includes(studentQuery));
      if (!student) {
        message(`Студент «${studentQuery}» не найден.`, true);
        return;
      }

      const subject = cache.subjects.find(sub => sub.name.toLowerCase().includes(subjectQuery));
      if (!subject) {
        message(`Предмет «${subjectQuery}» не найден.`, true);
        return;
      }

      if (markArg === "del" || markArg === "delete" || markArg === "-" || markArg === "0") {
        await requestJSON(`/api/journal/grades/${student.id}/${subject.id}`, "DELETE");
        message(`Удалена оценка: ${student.name} — ${subject.name}`);
      } else {
        const mark = Number(markArg);
        if (![2, 3, 4, 5].includes(mark)) {
          message("Оценка должна быть 2, 3, 4, 5 или del.", true);
          return;
        }
        await requestJSON("/api/journal/grades", "POST", {
          student_id: student.id,
          subject_id: subject.id,
          mark: mark
        });
        message(`Оценка ${mark} выставлена: ${student.name} (${subject.name})`);
      }
      refreshCurrentPageView();
      return;
    }

    // 10. Добавление групп, предметов и студентов (:add, :ag, :asub, :ast)
    if (verb === "ag") {
      const name = args.join(" ").trim();
      await requestJSON("/api/groups", "POST", { name });
      cache.groups = null;
      message(`Группа «${name}» создана.`);
      refreshCurrentPageView();
      return;
    }

    if (verb === "asub") {
      const name = args.join(" ").trim();
      await requestJSON("/api/subjects", "POST", { name });
      cache.subjects = null;
      message(`Предмет «${name}» создан.`);
      refreshCurrentPageView();
      return;
    }

    if (verb === "ast") {
      await createStudentViaCli(args);
      return;
    }

    if (verb === "add" || verb === "a") {
      const subVerb = (args[0] || "").toLowerCase();
      if (subVerb === "group") {
        const name = args.slice(1).join(" ").trim();
        await requestJSON("/api/groups", "POST", { name });
        cache.groups = null;
        message(`Группа «${name}» создана.`);
        refreshCurrentPageView();
        return;
      }
      if (subVerb === "subject") {
        const name = args.slice(1).join(" ").trim();
        await requestJSON("/api/subjects", "POST", { name });
        cache.subjects = null;
        message(`Предмет «${name}» создан.`);
        refreshCurrentPageView();
        return;
      }
      if (subVerb === "student") {
        await createStudentViaCli(args.slice(1));
        return;
      }

      // Контекстное добавление по текущему URL
      const name = args.join(" ").trim();
      if (!name) {
        const addBtn = document.querySelector("#add-record");
        if (addBtn) addBtn.click();
        return;
      }
      const path = window.location.pathname;
      if (path.startsWith("/subjects")) {
        await requestJSON("/api/subjects", "POST", { name });
        message(`Предмет «${name}» добавлен.`);
        refreshCurrentPageView();
      } else {
        await requestJSON("/api/groups", "POST", { name });
        message(`Группа «${name}» добавлена.`);
        refreshCurrentPageView();
      }
      return;
    }

    message(`Неизвестная команда: :${clean}`, true);
  } catch (err) {
    message(err.message || "Ошибка выполнения команды", true);
  }
}

async function createStudentViaCli(args) {
  if (args.length < 2) {
    message("Формат: :add student <Группа> <ФИО> [email]", true);
    return;
  }
  await ensureCache(true);
  const groupQuery = args[0].toLowerCase();
  const group = cache.groups.find(g => g.name.toLowerCase() === groupQuery) ||
                cache.groups.find(g => g.name.toLowerCase().includes(groupQuery));
  if (!group) {
    message(`Группа «${args[0]}» не найдена.`, true);
    return;
  }

  let email = null;
  let nameTokens = args.slice(1);
  if (nameTokens.length > 1 && nameTokens[nameTokens.length - 1].includes("@")) {
    email = nameTokens.pop();
  }
  const fullName = nameTokens.join(" ").trim();

  await requestJSON("/api/students", "POST", {
    name: fullName,
    group_id: group.id,
    email: email
  });
  cache.students = null;
  message(`Студент «${fullName}» зачислен в группу ${group.name}.`);
  refreshCurrentPageView();
}

/** Инициализация терминального бара в футере */
export function initCliBar() {
  const form = document.querySelector("#cli-form");
  const input = document.querySelector("#cli-input");
  const ghost = document.querySelector("#cli-ghost");
  const defaultBar = document.querySelector("#status-default-bar");
  const wildmenu = document.querySelector("#cli-wildmenu");
  const suggestionsList = document.querySelector("#cli-suggestions");
  const vimModeEl = document.querySelector("#vim-mode-indicator");
  const triggerBtn = document.querySelector("#cli-trigger-btn");

  if (!form || !input) return;

  function renderWildmenu() {
    const val = input.value;
    currentSuggestions = buildSuggestions(val);
    activeSuggestionIdx = 0;

    // Призрачный текст (fish-style autosuggestion)
    if (ghost) {
      const top = currentSuggestions[0];
      if (top && val && top.cmd.toLowerCase().startsWith(val.toLowerCase())) {
        ghost.textContent = val + top.cmd.slice(val.length);
      } else {
        ghost.textContent = "";
      }
    }

    suggestionsList.replaceChildren();
    if (!currentSuggestions.length) {
      wildmenu.hidden = true;
      return;
    }

    wildmenu.hidden = false;
    currentSuggestions.forEach((item, idx) => {
      const li = document.createElement("li");
      li.className = "wildmenu-item" + (idx === activeSuggestionIdx ? " active" : "");
      li.innerHTML = `<span class="wild-cmd">:${item.cmd}</span><span class="wild-desc">${item.desc}</span>`;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = item.cmd;
        input.focus();
        renderWildmenu();
      });
      suggestionsList.append(li);
    });
  }

  function openCli(initialText = "") {
    ensureCache();
    if (defaultBar) defaultBar.hidden = true;
    form.hidden = false;
    input.value = initialText;
    historyIdx = -1;
    if (vimModeEl) {
      vimModeEl.textContent = "COMMAND";
      vimModeEl.className = "vim-mode mode-command";
    }
    input.focus();
    renderWildmenu();
  }

  function closeCli() {
    form.hidden = true;
    if (wildmenu) wildmenu.hidden = true;
    if (defaultBar) defaultBar.hidden = false;
    input.value = "";
    if (ghost) ghost.textContent = "";
    input.blur();
    if (vimModeEl) {
      vimModeEl.textContent = "NORMAL";
      vimModeEl.className = "vim-mode mode-normal";
    }
  }

  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      form.hidden ? openCli() : closeCli();
    });
  }

  input.addEventListener("input", renderWildmenu);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeCli();
      return;
    }

    // Tab подставляет выбранную подсказку
    if (e.key === "Tab") {
      e.preventDefault();
      if (currentSuggestions.length > 0) {
        const chosen = currentSuggestions[activeSuggestionIdx] || currentSuggestions[0];
        input.value = chosen.cmd;
        renderWildmenu();
      }
      return;
    }

    // Стрелки вверх/вниз листают историю команд
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0 && historyIdx < history.length - 1) {
        historyIdx++;
        input.value = history[historyIdx];
        renderWildmenu();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        input.value = history[historyIdx];
        renderWildmenu();
      } else if (historyIdx === 0) {
        historyIdx = -1;
        input.value = "";
        renderWildmenu();
      }
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cmdText = input.value;
    closeCli();
    await executeCommand(cmdText);
  });

  // Глобальный перехват клавиши : (и Shift+Ж в русской раскладке)
  window.addEventListener("keydown", (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : "";
    const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (inInput) return;

    const isColon = e.key === ":" || (e.shiftKey && (e.code === "Semicolon" || e.key === "Ж" || e.key === "ж"));
    if (isColon && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openCli("");
    }
  });
}
