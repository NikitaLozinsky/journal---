import {requestJSON} from "/js/api.js";
import {message, busy, fillGroups} from "/js/ui.js";
import {createBarChart, createDoughnutChart, destroyChart} from "/js/chart-helper.js";

const GROUPS_API = "/api/groups";
const JOURNAL_API = "/api/journal";
const GRADES_API = "/api/journal/grades";
const BULK_GRADES_API = "/api/journal/grades/bulk";

const groupSelect = document.querySelector("#group-select");
const studentFilterInput = document.querySelector("#journal-student-filter");
const statusFilterSelect = document.querySelector("#journal-status-filter");
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

const bulkEditor = document.querySelector("#bulk-editor");
const bulkForm = document.querySelector("#bulk-form");
const bulkGroupSelect = document.querySelector("#bulk-group-select");
const bulkSubjectSelect = document.querySelector("#bulk-subject-select");
const bulkMarkSelect = document.querySelector("#bulk-mark-select");
const bulkOverwriteCheckbox = document.querySelector("#bulk-overwrite-checkbox");
const cancelBulkEditBtn = document.querySelector("#cancel-bulk-edit");
const btnBulkGrade = document.querySelector("#btn-bulk-grade");
const bulkActionHint = document.querySelector("#bulk-action-hint");

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
let gridMatrix = [];
let activeRow = -1, activeCol = -1;

const CHART_ICON_SVG = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;

if (toggleAnalyticsBtn && analyticsSection) {
  toggleAnalyticsBtn.addEventListener("click", () => {
    const isHidden = analyticsSection.hidden;
    analyticsSection.hidden = !isHidden;
    toggleAnalyticsBtn.setAttribute("aria-expanded", String(isHidden));
    toggleAnalyticsBtn.innerHTML = `${CHART_ICON_SVG}<span class="btn-text">${isHidden ? "Скрыть аналитику" : "Показать аналитику"}</span>`;
  });
}

if (quickEditCheckbox && quickEditHint) {
  quickEditCheckbox.addEventListener("change", () => {
    quickEditHint.hidden = !quickEditCheckbox.checked;
  });
}

if (btnExportExcel) {
  btnExportExcel.addEventListener("click", () => {
    const q = groupSelect.value ? `?group_id=${groupSelect.value}` : "";
    window.location.href = `/api/journal/export/excel${q}`;
  });
}

if (btnExportCsv) {
  btnExportCsv.addEventListener("click", () => {
    const q = groupSelect.value ? `?group_id=${groupSelect.value}` : "";
    window.location.href = `/api/journal/export/csv${q}`;
  });
}

if (btnPrint) {
  btnPrint.addEventListener("click", () => {
    if (journalData && journalData.group) {
      if (printGroupName) printGroupName.textContent = journalData.group.name;
      if (printDate) printDate.textContent = new Date().toLocaleDateString("ru-RU");
    }
    window.print();
  });
}

function updateBulkHint() {
  if (!bulkActionHint) return;
  const gVal = bulkGroupSelect ? bulkGroupSelect.value : "";
  const sVal = bulkSubjectSelect ? bulkSubjectSelect.value : "";
  const mark = bulkMarkSelect ? Number(bulkMarkSelect.value) : 5;
  const overwrite = bulkOverwriteCheckbox ? bulkOverwriteCheckbox.checked : true;

  let groupName = "ВСЕМ студентам ВСЕХ групп";
  if (gVal) {
    const grp = groups.find(g => String(g.id) === String(gVal));
    groupName = grp ? `студентам группы «${grp.name}»` : `группе ID ${gVal}`;
  }

  let subjectName = "по ВСЕМ предметам";
  if (sVal && journalData && journalData.subjects) {
    const sub = journalData.subjects.find(s => String(s.id) === String(sVal));
    subjectName = sub ? `по предмету «${sub.name}»` : `предмету ID ${sVal}`;
  }

  if (mark === 0) {
    bulkActionHint.innerHTML = `<svg class="btn-icon danger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Будут <strong>удалены все оценки</strong>: ${groupName} ${subjectName}.`;
  } else {
    const overwriteText = overwrite ? "с перезаписью существующих" : "только в незаполненные ячейки (без перезаписи)";
    bulkActionHint.innerHTML = `<svg class="btn-icon brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Будет выставлена оценка <strong>${mark}</strong>: ${groupName} ${subjectName} (${overwriteText}).`;
  }
}

if (bulkGroupSelect) bulkGroupSelect.addEventListener("change", updateBulkHint);
if (bulkSubjectSelect) bulkSubjectSelect.addEventListener("change", updateBulkHint);
if (bulkMarkSelect) bulkMarkSelect.addEventListener("change", updateBulkHint);
if (bulkOverwriteCheckbox) bulkOverwriteCheckbox.addEventListener("change", updateBulkHint);

if (btnBulkGrade) {
  btnBulkGrade.addEventListener("click", () => {
    openBulkEditor();
  });
}

if (cancelBulkEditBtn) {
  cancelBulkEditBtn.addEventListener("click", () => {
    if (bulkEditor) bulkEditor.hidden = true;
    message();
  });
}

if (bulkForm) {
  bulkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    busy(true);
    try {
      const gId = bulkGroupSelect && bulkGroupSelect.value ? Number(bulkGroupSelect.value) : null;
      const sId = bulkSubjectSelect && bulkSubjectSelect.value ? Number(bulkSubjectSelect.value) : null;
      const mark = Number(bulkMarkSelect.value);
      const overwrite = bulkOverwriteCheckbox.checked;

      const res = await requestJSON(BULK_GRADES_API, "POST", {
        group_id: gId,
        subject_id: sId,
        mark: mark,
        overwrite_existing: overwrite
      });
      if (bulkEditor) bulkEditor.hidden = true;
      const count = res.count !== undefined ? res.count : 0;
      await loadJournal(groupSelect.value, `Массовое действие выполнено: обновлено записей — ${count}.`);
    } catch (err) {
      message("Ошибка массового оценивания: " + err.message, true);
    } finally {
      busy(false);
    }
  });
}

function openBulkEditor(preselectedSubjectId = null, preselectedGroupId = null) {
  if (editor) editor.hidden = true;

  // Заполняем список групп
  if (bulkGroupSelect) {
    bulkGroupSelect.replaceChildren();
    const optAllG = document.createElement("option");
    optAllG.value = "";
    optAllG.textContent = "Все группы";
    bulkGroupSelect.append(optAllG);

    for (const g of groups) {
      const opt = document.createElement("option");
      opt.value = String(g.id);
      opt.textContent = g.name;
      bulkGroupSelect.append(opt);
    }

    if (preselectedGroupId !== null && preselectedGroupId !== undefined) {
      bulkGroupSelect.value = String(preselectedGroupId);
    } else if (groupSelect && groupSelect.value) {
      bulkGroupSelect.value = groupSelect.value;
    } else {
      bulkGroupSelect.value = "";
    }
  }

  // Заполняем список предметов
  if (bulkSubjectSelect) {
    bulkSubjectSelect.replaceChildren();
    const optAllS = document.createElement("option");
    optAllS.value = "";
    optAllS.textContent = "Все предметы";
    bulkSubjectSelect.append(optAllS);

    if (journalData && journalData.subjects) {
      for (const s of journalData.subjects) {
        const opt = document.createElement("option");
        opt.value = String(s.id);
        opt.textContent = s.name;
        bulkSubjectSelect.append(opt);
      }
    }

    if (preselectedSubjectId !== null && preselectedSubjectId !== undefined) {
      bulkSubjectSelect.value = String(preselectedSubjectId);
    } else {
      bulkSubjectSelect.value = "";
    }
  }

  updateBulkHint();
  bulkEditor.hidden = false;
  bulkEditor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  bulkMarkSelect.focus();
}

if (studentFilterInput) studentFilterInput.addEventListener("input", render);
if (statusFilterSelect) statusFilterSelect.addEventListener("change", render);

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

async function init() {
  busy(true);
  try {
    const groupsResp = await requestJSON(GROUPS_API);
    groups = groupsResp.items;
    fillGroups(groupSelect, groups, true);
    if (groups.length) {
      groupSelect.value = String(groups[0].id);
      await loadJournal(groups[0].id);
    } else {
      groupSelect.value = "";
      await loadJournal("");
    }
  } catch (error) {
    message("Ошибка загрузки групп: " + error.message, true);
  } finally {
    busy(false);
  }
}

async function loadJournal(groupId = "", successText = "") {
  busy(true);
  message("Загрузка журнала...");
  try {
    const url = groupId ? (JOURNAL_API + "?group_id=" + groupId) : JOURNAL_API;
    journalData = await requestJSON(url);
    render();
    renderAnalytics();
    if (printGroupName && journalData.group) printGroupName.textContent = journalData.group.name;
    if (printDate) printDate.textContent = new Date().toLocaleDateString("ru-RU");
    message(successText);
  } catch (error) {
    message((successText ? successText + " " : "") + error.message, true);
    renderEmpty("Данные журнала не загружены");
    renderAnalyticsEmpty();
  } finally {
    busy(false);
  }
}

function renderEmpty(text) {
  tableHead.replaceChildren();
  tableBody.replaceChildren();
  gridMatrix = [];
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
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
    if (markCounts[g.mark] !== undefined) markCounts[g.mark]++;
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

  if (totalGrades === 0) return;

  createDoughnutChart("journal-canvas-marks", {
    labels: ["Отлично (5)", "Хорошо (4)", "Удовл. (3)", "Неуд. (2)"],
    data: [markCounts[5], markCounts[4], markCounts[3], markCounts[2]],
    backgroundColors: ["#22c55e", "#a78bfa", "#f59e0b", "#ef4444"]
  });

  const subjLabels = [];
  const subjAverages = [];
  const subjBarColors = [];

  for (const sub of subjects) {
    subjLabels.push(sub.name);
    const subGrades = grades.filter(g => g.subject_id === sub.id);
    if (subGrades.length > 0) {
      const avg = Number((subGrades.reduce((sum, g) => sum + g.mark, 0) / subGrades.length).toFixed(2));
      subjAverages.push(avg);
      if (avg >= 4.5) subjBarColors.push("#22c55e");
      else if (avg >= 3.8) subjBarColors.push("#a78bfa");
      else if (avg >= 3.0) subjBarColors.push("#f59e0b");
      else subjBarColors.push("#ef4444");
    } else {
      subjAverages.push(0);
      subjBarColors.push("#64748b");
    }
  }

  createBarChart("journal-canvas-subjects", {
    labels: subjLabels,
    datasets: [{ label: "Средний балл", data: subjAverages, backgroundColor: subjBarColors }],
    yAxisTitle: "Балл (от 2 до 5)",
    yMax: 5,
    stepSize: 1
  });
}

/** Обновляет бейдж среднего балла в строке студента на лету */
function updateStudentRowAverage(studentId) {
  const badge = tableBody.querySelector(`span[data-avg-for="${studentId}"]`);
  if (!badge || !journalData) return;
  const studentGrades = journalData.grades.filter(g => g.student_id === studentId);
  badge.className = "mark-badge";
  if (!studentGrades.length) {
    badge.classList.add("empty");
    badge.textContent = "—";
    return;
  }
  const avg = studentGrades.reduce((s, g) => s + g.mark, 0) / studentGrades.length;
  badge.textContent = avg.toFixed(2);
  if (avg >= 4.5) badge.classList.add("excellent");
  else if (avg >= 3.8) badge.classList.add("good");
  else if (avg >= 3.0) badge.classList.add("fair");
  else badge.classList.add("failing");
}

function setActiveCell(r, c) {
  if (!gridMatrix.length) return;
  if (activeRow >= 0 && activeCol >= 0 && gridMatrix[activeRow] && gridMatrix[activeRow][activeCol]) {
    gridMatrix[activeRow][activeCol].classList.remove("cell-active");
  }
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

async function quickSaveGrade(btn, r, c, mark) {
  const studentId = Number(btn.dataset.studentId);
  const subjectId = Number(btn.dataset.subjectId);

  btn.textContent = String(mark);
  btn.dataset.hasGrade = "true";
  btn.dataset.mark = String(mark);
  btn.classList.remove("empty");
  btn.classList.toggle("failing", mark === 2);
  btn.classList.add("cell-saving");

  try {
    const res = await requestJSON(GRADES_API, "POST", {
      student_id: studentId,
      subject_id: subjectId,
      mark: mark
    });

    if (journalData && journalData.grades) {
      const existingIdx = journalData.grades.findIndex(
        g => g.student_id === studentId && g.subject_id === subjectId
      );
      const gradeObj = res.item || { id: Date.now(), student_id: studentId, subject_id: subjectId, mark: mark };
      if (existingIdx >= 0) journalData.grades[existingIdx] = gradeObj;
      else journalData.grades.push(gradeObj);
    }

    updateStudentRowAverage(studentId);
    renderAnalytics();
  } catch (error) {
    message("Ошибка сохранения оценки: " + error.message, true);
  } finally {
    btn.classList.remove("cell-saving");
  }
}

async function quickDeleteGrade(btn) {
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
    updateStudentRowAverage(studentId);
    renderAnalytics();
  } catch (error) {
    message("Ошибка удаления оценки: " + error.message, true);
  } finally {
    btn.classList.remove("cell-saving");
  }
}

function render() {
  tableHead.replaceChildren();
  tableBody.replaceChildren();
  gridMatrix = [];
  activeRow = -1;
  activeCol = -1;

  if (!journalData) return;
  const { students, subjects, grades } = journalData;

  const headRow = document.createElement("tr");
  const thStudent = document.createElement("th");
  thStudent.textContent = "Студент";
  headRow.append(thStudent);

  for (const subject of subjects) {
    const th = document.createElement("th");
    th.style.textAlign = "center";

    const wrap = document.createElement("div");
    wrap.className = "th-subject-header";

    const span = document.createElement("span");
    span.textContent = subject.name;

    const bulkBtn = document.createElement("button");
    bulkBtn.type = "button";
    bulkBtn.className = "th-bulk-btn";
    bulkBtn.innerHTML = `<svg class="th-bulk-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
    bulkBtn.title = `Заполнить предмет «${subject.name}» для всей группы`;
    bulkBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openBulkEditor(subject.id, groupSelect.value ? Number(groupSelect.value) : null);
    });

    wrap.append(span, bulkBtn);
    th.append(wrap);
    headRow.append(th);
  }

  const thAvg = document.createElement("th");
  thAvg.textContent = "Ср. балл";
  thAvg.className = "number";
  headRow.append(thAvg);
  tableHead.append(headRow);

  if (!students.length) {
    renderEmpty("В группе пока нет студентов");
    return;
  }

  const gradesMap = new Map();
  for (const g of grades) {
    gradesMap.set(g.student_id + ":" + g.subject_id, g);
  }

  const q = studentFilterInput ? studentFilterInput.value.trim().toLowerCase() : "";
  const statusFilter = statusFilterSelect ? statusFilterSelect.value : "all";

  const filteredStudents = students.filter(st => {
    if (q && !st.name.toLowerCase().includes(q)) return false;
    if (statusFilter === "all") return true;
    const stGrades = grades.filter(g => g.student_id === st.id);
    if (statusFilter === "no_grades") return stGrades.length === 0;
    if (statusFilter === "failing") return stGrades.some(g => g.mark === 2);
    if (statusFilter === "excellent") return stGrades.length > 0 && stGrades.every(g => g.mark === 5);
    return true;
  });

  if (!filteredStudents.length) {
    renderEmpty("Нет студентов по выбранному фильтру");
    return;
  }

  const isMultiGroup = !journalData.group || journalData.group.id === 0;
  let currentGroupId = null;

  filteredStudents.forEach((student, rIdx) => {
    if (isMultiGroup && student.group_id !== currentGroupId) {
      currentGroupId = student.group_id;
      const groupName = student.group_name || `Группа ${currentGroupId}`;
      const groupStudents = students.filter(st => st.group_id === currentGroupId);
      const groupGrades = grades.filter(g => groupStudents.some(st => st.id === g.student_id));
      const groupAvg = groupGrades.length > 0
        ? (groupGrades.reduce((sum, g) => sum + g.mark, 0) / groupGrades.length).toFixed(2)
        : "—";

      const dividerRow = document.createElement("tr");
      dividerRow.className = "group-divider-row";
      dividerRow.dataset.groupId = String(currentGroupId);

      const tdDivider = document.createElement("td");
      tdDivider.colSpan = subjects.length + 2;

      const dividerWrap = document.createElement("div");
      dividerWrap.className = "group-divider-content";

      const infoBox = document.createElement("div");
      infoBox.className = "group-divider-info";

      const iconSpan = document.createElement("span");
      iconSpan.className = "group-divider-icon";
      iconSpan.innerHTML = `<svg class="btn-icon brand-icon no-margin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

      const nameSpan = document.createElement("span");
      nameSpan.className = "group-divider-name";
      nameSpan.textContent = `Группа: ${groupName}`;

      const countPill = document.createElement("span");
      countPill.className = "group-divider-pill";
      countPill.textContent = `${groupStudents.length} студ.`;

      const avgPill = document.createElement("span");
      avgPill.className = "group-divider-pill avg";
      avgPill.textContent = `Ср. балл: ${groupAvg}`;

      infoBox.append(iconSpan, nameSpan, countPill, avgPill);

      const groupActionBtn = document.createElement("button");
      groupActionBtn.type = "button";
      groupActionBtn.className = "button-secondary button-small";
      groupActionBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>Оценить группу</span>`;
      groupActionBtn.title = `Массовое оценивание для группы «${groupName}»`;
      groupActionBtn.addEventListener("click", () => {
        openBulkEditor(null, currentGroupId);
      });

      dividerWrap.append(infoBox, groupActionBtn);
      tdDivider.append(dividerWrap);
      dividerRow.append(tdDivider);
      tableBody.append(dividerRow);
    }

    const row = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = student.name;
    row.append(tdName);

    const rowButtons = [];

    subjects.forEach((subject, cIdx) => {
      const td = document.createElement("td");
      td.className = "grade-cell";

      const grade = gradesMap.get(student.id + ":" + subject.id);
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
        if (grade.mark === 2) btn.classList.add("failing");
      } else {
        btn.textContent = "—";
        btn.dataset.hasGrade = "false";
        btn.classList.add("empty");
      }

      rowButtons.push(btn);
      td.append(btn);
      row.append(td);
    });

    const tdAvg = document.createElement("td");
    tdAvg.className = "number";
    const avgBadge = document.createElement("span");
    avgBadge.dataset.avgFor = String(student.id);
    tdAvg.append(avgBadge);
    row.append(tdAvg);

    gridMatrix.push(rowButtons);
    tableBody.append(row);
    updateStudentRowAverage(student.id);
  });
}

function openGradeEditor(btn) {
  const hasGrade = btn.dataset.hasGrade === "true";
  if (bulkEditor) bulkEditor.hidden = true;
  form.reset();
  studentIdInput.value = btn.dataset.studentId;
  subjectIdInput.value = btn.dataset.subjectId;
  markSelect.value = hasGrade ? btn.dataset.mark : "5";
  deleteButton.hidden = !hasGrade;

  editorTitle.textContent = "Оценка: " + btn.dataset.studentName + " — " + btn.dataset.subjectName;
  editor.hidden = false;
  message();
  markSelect.focus();
}

groupSelect.addEventListener("change", function() {
  if (editor) editor.hidden = true;
  if (bulkEditor) bulkEditor.hidden = true;
  loadJournal(groupSelect.value);
});

tableBody.addEventListener("click", function(event) {
  const btn = event.target.closest("button.grade-button");
  if (!btn) return;
  const isQuick = quickEditCheckbox ? quickEditCheckbox.checked : false;
  if (isQuick) setActiveCell(Number(btn.dataset.row), Number(btn.dataset.col));
  else openGradeEditor(btn);
});

tableBody.addEventListener("dblclick", function(event) {
  const btn = event.target.closest("button.grade-button");
  if (!btn) return;
  openGradeEditor(btn);
});

// Обработка клавиатурной навигации по матрице (Стрелки + Vim HJKL + Цифры 2..5)
tableBody.addEventListener("keydown", function(event) {
  const isQuick = quickEditCheckbox ? quickEditCheckbox.checked : true;
  if (!isQuick) return;

  const btn = event.target.closest("button.grade-button");
  if (!btn) return;

  const r = Number(btn.dataset.row);
  const c = Number(btn.dataset.col);

  switch (event.key) {
    case "ArrowDown":
    case "j":
    case "J":
    case "Enter":
      event.preventDefault();
      setActiveCell(r + 1, c);
      break;
    case "ArrowUp":
    case "k":
    case "K":
      event.preventDefault();
      setActiveCell(r - 1, c);
      break;
    case "ArrowRight":
    case "l":
    case "L":
      event.preventDefault();
      setActiveCell(r, c + 1);
      break;
    case "ArrowLeft":
    case "h":
    case "H":
      event.preventDefault();
      setActiveCell(r, c - 1);
      break;
    case " ":
    case "e":
    case "E":
      event.preventDefault();
      openGradeEditor(btn);
      break;
    case "2":
    case "3":
    case "4":
    case "5":
      event.preventDefault();
      quickSaveGrade(btn, r, c, Number(event.key));
      setActiveCell(r + 1, c);
      break;
    case "Delete":
    case "Backspace":
    case "x":
    case "X":
      event.preventDefault();
      quickDeleteGrade(btn);
      break;
  }
});

cancelButton.addEventListener("click", function() { editor.hidden = true; message(); });

form.addEventListener("submit", async function(event) {
  event.preventDefault();
  busy(true);
  try {
    await requestJSON(GRADES_API, "POST", {
      student_id: Number(studentIdInput.value),
      subject_id: Number(subjectIdInput.value),
      mark: Number(markSelect.value)
    });
    editor.hidden = true;
    await loadJournal(groupSelect.value, "Оценка сохранена.");
  } catch (error) {
    message(error.message, true);
  } finally {
    busy(false);
  }
});

deleteButton.addEventListener("click", async function() {
  busy(true);
  try {
    await requestJSON(GRADES_API + "/" + Number(studentIdInput.value) + "/" + Number(subjectIdInput.value), "DELETE");
    editor.hidden = true;
    await loadJournal(groupSelect.value, "Оценка удалена.");
  } catch (error) {
    message(error.message, true);
  } finally {
    busy(false);
  }
});

init();
