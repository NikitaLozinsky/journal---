import {requestJSON} from "/js/api.js";
import {message, busy, fillGroups} from "/js/ui.js";
import {createBarChart, createDoughnutChart, destroyChart} from "/js/chart-helper.js";

const GROUPS_API = "/api/groups";
const JOURNAL_API = "/api/journal";
const GRADES_API = "/api/journal/grades";

const groupSelect = document.querySelector("#group-select");
const tableHead = document.querySelector("#table-head");
const tableBody = document.querySelector("#table-body");
const editor = document.querySelector("#editor");
const editorTitle = document.querySelector("#editor-title");
const form = document.querySelector("#edit-form");
const studentIdInput = document.querySelector("#record-student-id");
const subjectIdInput = document.querySelector("#record-subject-id");
const markSelect = document.querySelector("#record-mark");
const deleteButton = document.querySelector("#delete-grade");
const cancelButton = document.querySelector("#cancel-edit");

const toggleAnalyticsBtn = document.querySelector("#toggle-analytics");
const analyticsSection = document.querySelector("#journal-analytics");
const kpiContainer = document.querySelector("#journal-kpi");

const btnExportExcel = document.querySelector("#btn-export-excel");
const btnExportCsv = document.querySelector("#btn-export-csv");
const btnPrint = document.querySelector("#btn-print");
const quickEditCheckbox = document.querySelector("#quick-edit-mode");
const quickEditHint = document.querySelector("#quick-edit-hint");

const printGroupName = document.querySelector("#print-group-name");
const printDate = document.querySelector("#print-date");

let journalData = null, groups = [];
let gridMatrix = []; // [row][col] -> HTMLButtonElement
let activeRow = -1, activeCol = -1;

/** Переключение видимости блока аналитики */
if (toggleAnalyticsBtn && analyticsSection) {
  toggleAnalyticsBtn.addEventListener("click", () => {
    const isHidden = analyticsSection.hidden;
    analyticsSection.hidden = !isHidden;
    toggleAnalyticsBtn.setAttribute("aria-expanded", String(isHidden));
    toggleAnalyticsBtn.textContent = isHidden ? "📊 Скрыть аналитику" : "📊 Показать аналитику";
  });
}

/** Переключение подсказки быстрого ввода */
if (quickEditCheckbox && quickEditHint) {
  quickEditCheckbox.addEventListener("change", () => {
    quickEditHint.hidden = !quickEditCheckbox.checked;
  });
}

/** Экспорт в Excel (.xlsx) */
if (btnExportExcel) {
  btnExportExcel.addEventListener("click", () => {
    if (!groupSelect.value) return;
    window.location.href = `/api/journal/export/excel?group_id=${groupSelect.value}`;
  });
}

/** Экспорт в CSV (.csv) */
if (btnExportCsv) {
  btnExportCsv.addEventListener("click", () => {
    if (!groupSelect.value) return;
    window.location.href = `/api/journal/export/csv?group_id=${groupSelect.value}`;
  });
}

/** Печать ведомости */
if (btnPrint) {
  btnPrint.addEventListener("click", () => {
    if (journalData && journalData.group) {
      if (printGroupName) printGroupName.textContent = journalData.group.name;
      if (printDate) printDate.textContent = new Date().toLocaleDateString("ru-RU");
    }
    window.print();
  });
}

/** Создает карточку KPI показателя. */
function createKpiCard(title, value, subtitle = "") {
  const card = document.createElement("div");
  card.className = "kpi-card";
  const t = document.createElement("div");
  t.className = "kpi-title";
  t.textContent = title;
  const v = document.createElement("div");
  v.className = "kpi-value";
  v.textContent = value;
  card.append(t, v);
  if (subtitle) {
    const s = document.createElement("div");
    s.className = "kpi-sub";
    s.textContent = subtitle;
    card.append(s);
  }
  return card;
}

/** Загружает список групп и инициализирует выбор. */
async function init() {
  busy(true);
  try {
    const groupsResp = await requestJSON(GROUPS_API);
    groups = groupsResp.items;
    fillGroups(groupSelect, groups, false);
    if (groups.length) {
      await loadJournal(groups[0].id);
    } else {
      renderEmpty("Нет доступных групп");
      renderAnalyticsEmpty();
    }
  } catch (error) {
    message("Ошибка загрузки групп: " + error.message, true);
  } finally {
    busy(false);
  }
}

/** Загружает данные журнала для выбранной группы. */
async function loadJournal(groupId, successText = "") {
  busy(true); message("Загрузка журнала...");
  try {
    journalData = await requestJSON(JOURNAL_API + "?group_id=" + groupId);
    render();
    renderAnalytics();
    if (printGroupName && journalData.group) {
      printGroupName.textContent = journalData.group.name;
    }
    if (printDate) {
      printDate.textContent = new Date().toLocaleDateString("ru-RU");
    }
    message(successText);
  } catch (error) {
    message((successText ? successText + " " : "") + error.message, true);
    renderEmpty("Данные журнала не загружены");
    renderAnalyticsEmpty();
  } finally {
    busy(false);
  }
}

/** Отображает пустое состояние журнала. */
function renderEmpty(text) {
  tableHead.replaceChildren();
  tableBody.replaceChildren();
  gridMatrix = [];
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 5;
  td.className = "empty-row";
  td.textContent = text;
  tr.append(td);
  tableBody.append(tr);
}

function renderAnalyticsEmpty() {
  kpiContainer.replaceChildren();
  destroyChart("journal-canvas-marks");
  destroyChart("journal-canvas-subjects");
}

/** Рендерит аналитику и графики группы. */
function renderAnalytics() {
  kpiContainer.replaceChildren();
  destroyChart("journal-canvas-marks");
  destroyChart("journal-canvas-subjects");

  if (!journalData) return;
  const { students, subjects, grades } = journalData;

  const totalStudents = students.length;
  const totalGrades = grades.length;

  let sumMarks = 0;
  const markCounts = { 5: 0, 4: 0, 3: 0, 2: 0 };

  for (const g of grades) {
    sumMarks += g.mark;
    if (markCounts[g.mark] !== undefined) {
      markCounts[g.mark]++;
    }
  }

  const avgMark = totalGrades > 0 ? (sumMarks / totalGrades).toFixed(2) : "—";
  const quality = totalGrades > 0 ? Math.round(((markCounts[5] + markCounts[4]) / totalGrades) * 100) + "%" : "—";
  const passRate = totalGrades > 0 ? Math.round(((totalGrades - markCounts[2]) / totalGrades) * 100) + "%" : "—";

  kpiContainer.append(
    createKpiCard("Студентов", totalStudents, "В составе группы"),
    createKpiCard("Оценок", totalGrades, "Всего в журнале"),
    createKpiCard("Средний балл", avgMark, "Успеваемость группы"),
    createKpiCard("Качество знаний", quality, "Доля оценок 4 и 5"),
    createKpiCard("Успеваемость", passRate, "Доля без двоек")
  );

  if (totalGrades === 0) {
    return;
  }

  // 1. Диаграмма распределения оценок
  const markLabels = ["Отлично (5)", "Хорошо (4)", "Удовл. (3)", "Неуд. (2)"];
  const markData = [markCounts[5], markCounts[4], markCounts[3], markCounts[2]];
  const markColors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

  createDoughnutChart("journal-canvas-marks", {
    labels: markLabels,
    data: markData,
    backgroundColors: markColors
  });

  // 2. Диаграмма среднего балла по предметам
  const subjLabels = [];
  const subjAverages = [];
  const subjBarColors = [];

  for (const sub of subjects) {
    subjLabels.push(sub.name);
    const subGrades = grades.filter(g => g.subject_id === sub.id);
    if (subGrades.length > 0) {
      const avg = Number((subGrades.reduce((sum, g) => sum + g.mark, 0) / subGrades.length).toFixed(2));
      subjAverages.push(avg);
      if (avg >= 4.5) subjBarColors.push("#10b981");
      else if (avg >= 3.8) subjBarColors.push("#3b82f6");
      else if (avg >= 3.0) subjBarColors.push("#f59e0b");
      else subjBarColors.push("#ef4444");
    } else {
      subjAverages.push(0);
      subjBarColors.push("#94a3b8");
    }
  }

  createBarChart("journal-canvas-subjects", {
    labels: subjLabels,
    datasets: [{
      label: "Средний балл",
      data: subjAverages,
      backgroundColor: subjBarColors
    }],
    yAxisTitle: "Балл (от 2 до 5)",
    yMax: 5,
    stepSize: 1
  });
}

/** Устанавливает активную ячейку в матрице по координатам (row, col). */
function setActiveCell(r, c) {
  if (!gridMatrix.length) return;
  // Снимаем активность с предыдущей
  if (activeRow >= 0 && activeCol >= 0 && gridMatrix[activeRow] && gridMatrix[activeRow][activeCol]) {
    gridMatrix[activeRow][activeCol].classList.remove("cell-active");
  }

  // Ограничиваем границы
  const maxR = gridMatrix.length - 1;
  const maxC = gridMatrix[0] ? gridMatrix[0].length - 1 : 0;
  activeRow = Math.max(0, Math.min(r, maxR));
  activeCol = Math.max(0, Math.min(c, maxC));

  const targetBtn = gridMatrix[activeRow][activeCol];
  if (targetBtn) {
    targetBtn.classList.add("cell-active");
    targetBtn.focus();
  }
}

/** Моментальное сохранение оценки с клавиатуры (Excel mode). */
async function quickSaveGrade(btn, r, c, mark) {
  const studentId = Number(btn.dataset.studentId);
  const subjectId = Number(btn.dataset.subjectId);

  // Мгновенная визуальная реакция
  btn.textContent = String(mark);
  btn.dataset.hasGrade = "true";
  btn.dataset.mark = String(mark);
  btn.classList.remove("empty");
  if (mark === 2) {
    btn.classList.add("failing");
  } else {
    btn.classList.remove("failing");
  }
  btn.classList.add("cell-saving");

  try {
    const res = await requestJSON(GRADES_API, "POST", {
      student_id: studentId,
      subject_id: subjectId,
      mark: mark
    });

    // Обновляем локальные данные в памяти
    if (journalData && journalData.grades) {
      const existingIdx = journalData.grades.findIndex(
        g => g.student_id === studentId && g.subject_id === subjectId
      );
      const gradeObj = res.item || { id: Date.now(), student_id: studentId, subject_id: subjectId, mark: mark };
      if (existingIdx >= 0) {
        journalData.grades[existingIdx] = gradeObj;
      } else {
        journalData.grades.push(gradeObj);
      }
    }

    renderAnalytics();
  } catch (error) {
    message("Ошибка сохранения оценки: " + error.message, true);
  } finally {
    btn.classList.remove("cell-saving");
  }
}

/** Быстрое удаление оценки с клавиатуры (Del/Backspace). */
async function quickDeleteGrade(btn, r, c) {
  const studentId = Number(btn.dataset.studentId);
  const subjectId = Number(btn.dataset.subjectId);
  if (btn.dataset.hasGrade !== "true") return;

  btn.textContent = "—";
  btn.dataset.hasGrade = "false";
  delete btn.dataset.mark;
  btn.classList.add("empty");
  btn.classList.remove("failing");
  btn.classList.add("cell-saving");

  try {
    await requestJSON(GRADES_API + "/" + studentId + "/" + subjectId, "DELETE");

    if (journalData && journalData.grades) {
      journalData.grades = journalData.grades.filter(
        g => !(g.student_id === studentId && g.subject_id === subjectId)
      );
    }
    renderAnalytics();
  } catch (error) {
    message("Ошибка удаления оценки: " + error.message, true);
  } finally {
    btn.classList.remove("cell-saving");
  }
}

/** Рендерит матрицу оценок. */
function render() {
  tableHead.replaceChildren();
  tableBody.replaceChildren();
  gridMatrix = [];
  activeRow = -1;
  activeCol = -1;

  if (!journalData) return;
  const { students, subjects, grades } = journalData;

  // Шапка таблицы
  const headRow = document.createElement("tr");
  const thStudent = document.createElement("th");
  thStudent.textContent = "Студент";
  headRow.append(thStudent);

  for (const subject of subjects) {
    const th = document.createElement("th");
    th.textContent = subject.name;
    headRow.append(th);
  }
  tableHead.append(headRow);

  if (!students.length) {
    renderEmpty("В группе пока нет студентов");
    return;
  }

  // Создаем быстрый поиск оценок по ключу "studentId:subjectId"
  const gradesMap = new Map();
  for (const g of grades) {
    gradesMap.set(g.student_id + ":" + g.subject_id, g);
  }

  // Тело таблицы
  students.forEach((student, rIdx) => {
    const row = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = student.name;
    row.append(tdName);

    const rowButtons = [];

    subjects.forEach((subject, cIdx) => {
      const td = document.createElement("td");
      td.className = "grade-cell";

      const key = student.id + ":" + subject.id;
      const grade = gradesMap.get(key);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "grade-button";
      btn.dataset.studentId = String(student.id);
      btn.dataset.subjectId = String(subject.id);
      btn.dataset.studentName = student.name;
      btn.dataset.subjectName = subject.name;
      btn.dataset.row = String(rIdx);
      btn.dataset.col = String(cIdx);

      if (grade) {
        btn.textContent = String(grade.mark);
        btn.dataset.hasGrade = "true";
        btn.dataset.mark = String(grade.mark);
        if (grade.mark === 2) {
          btn.classList.add("failing");
        }
      } else {
        btn.textContent = "—";
        btn.dataset.hasGrade = "false";
        btn.classList.add("empty");
      }

      rowButtons.push(btn);
      td.append(btn);
      row.append(td);
    });

    gridMatrix.push(rowButtons);
    tableBody.append(row);
  });
}

/** Открывает форму выставления/изменения оценки. */
function openGradeEditor(btn) {
  const studentId = btn.dataset.studentId;
  const subjectId = btn.dataset.subjectId;
  const studentName = btn.dataset.studentName;
  const subjectName = btn.dataset.subjectName;
  const hasGrade = btn.dataset.hasGrade === "true";
  const currentMark = btn.dataset.mark;

  form.reset();
  studentIdInput.value = studentId;
  subjectIdInput.value = subjectId;
  markSelect.value = hasGrade ? currentMark : "5";
  deleteButton.hidden = !hasGrade;

  editorTitle.textContent = "Оценка: " + studentName + " — " + subjectName;
  editor.hidden = false;
  message();
  markSelect.focus();
}

groupSelect.addEventListener("change", function() {
  editor.hidden = true;
  if (groupSelect.value) {
    loadJournal(Number(groupSelect.value));
  }
});

// Клик по ячейке
tableBody.addEventListener("click", function(event) {
  const btn = event.target.closest("button.grade-button");
  if (!btn) return;
  const isQuick = quickEditCheckbox ? quickEditCheckbox.checked : false;

  const r = Number(btn.dataset.row);
  const c = Number(btn.dataset.col);

  if (isQuick) {
    setActiveCell(r, c);
  } else {
    openGradeEditor(btn);
  }
});

// Двойной клик всегда открывает подробную форму
tableBody.addEventListener("dblclick", function(event) {
  const btn = event.target.closest("button.grade-button");
  if (!btn) return;
  openGradeEditor(btn);
});

// Обработка клавиатурной навигации и быстрого ввода (Excel-режим)
tableBody.addEventListener("keydown", function(event) {
  const isQuick = quickEditCheckbox ? quickEditCheckbox.checked : false;
  if (!isQuick) return;

  const btn = event.target.closest("button.grade-button");
  if (!btn) return;

  const r = Number(btn.dataset.row);
  const c = Number(btn.dataset.col);

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      setActiveCell(r + 1, c);
      break;
    case "ArrowUp":
      event.preventDefault();
      setActiveCell(r - 1, c);
      break;
    case "ArrowRight":
      event.preventDefault();
      setActiveCell(r, c + 1);
      break;
    case "ArrowLeft":
      event.preventDefault();
      setActiveCell(r, c - 1);
      break;
    case "Enter":
      event.preventDefault();
      // Enter смещает вниз
      setActiveCell(r + 1, c);
      break;
    case "2":
    case "3":
    case "4":
    case "5":
      event.preventDefault();
      quickSaveGrade(btn, r, c, Number(event.key));
      // Автопереход вниз как в Excel
      setActiveCell(r + 1, c);
      break;
    case "Delete":
    case "Backspace":
      event.preventDefault();
      quickDeleteGrade(btn, r, c);
      break;
  }
});

cancelButton.addEventListener("click", function() {
  editor.hidden = true;
  message();
});

form.addEventListener("submit", async function(event) {
  event.preventDefault();
  const studentId = Number(studentIdInput.value);
  const subjectId = Number(subjectIdInput.value);
  const mark = Number(markSelect.value);

  busy(true);
  try {
    await requestJSON(GRADES_API, "POST", {
      student_id: studentId,
      subject_id: subjectId,
      mark: mark
    });
    editor.hidden = true;
    await loadJournal(Number(groupSelect.value), "Оценка сохранена.");
  } catch (error) {
    message(error.message, true);
  } finally {
    busy(false);
  }
});

deleteButton.addEventListener("click", async function() {
  const studentId = Number(studentIdInput.value);
  const subjectId = Number(subjectIdInput.value);

  busy(true);
  try {
    await requestJSON(GRADES_API + "/" + studentId + "/" + subjectId, "DELETE");
    editor.hidden = true;
    await loadJournal(Number(groupSelect.value), "Оценка удалена.");
  } catch (error) {
    message(error.message, true);
  } finally {
    busy(false);
  }
});

init();
