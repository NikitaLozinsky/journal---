import {requestJSON} from "/js/api.js";
import {cell, message, busy, emptyRow} from "/js/ui.js";
import {createBarChart, createDoughnutChart, destroyChart, getChartThemeColors} from "/js/chart-helper.js";

const REPORTS_API = "/api/reports";
const kindSelect = document.querySelector("#kind-select");
const tableHead = document.querySelector("#table-head");
const tableBody = document.querySelector("#table-body");
const kpiContainer = document.querySelector("#kpi-container");
const chartsContainer = document.querySelector("#charts-container");
const analyticsSection = document.querySelector("#analytics-section");
const tableContainer = document.querySelector("#table-container");
const chartCard1 = document.querySelector("#chart-card-1");
const chartCard2 = document.querySelector("#chart-card-2");
const chartTitle1 = document.querySelector("#chart-title-1");
const chartTitle2 = document.querySelector("#chart-title-2");

const btnBoth = document.querySelector("#view-both");
const btnCharts = document.querySelector("#view-charts");
const btnTable = document.querySelector("#view-table");

let currentView = "both"; // "both", "charts", "table"

/** Управляет переключением режима отображения: таблица, графики или всё вместе. */
function setViewMode(mode) {
  currentView = mode;
  [btnBoth, btnCharts, btnTable].forEach(btn => btn.classList.remove("active"));

  if (mode === "both") {
    btnBoth.classList.add("active");
    analyticsSection.hidden = false;
    tableContainer.hidden = false;
  } else if (mode === "charts") {
    btnCharts.classList.add("active");
    analyticsSection.hidden = false;
    tableContainer.hidden = true;
  } else if (mode === "table") {
    btnTable.classList.add("active");
    analyticsSection.hidden = true;
    tableContainer.hidden = false;
  }
}

btnBoth.addEventListener("click", () => setViewMode("both"));
btnCharts.addEventListener("click", () => setViewMode("charts"));
btnTable.addEventListener("click", () => setViewMode("table"));

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

/** Загружает выбранный отчёт. */
async function loadReport(kind) {
  busy(true);
  message("Загрузка отчёта...");
  try {
    const data = await requestJSON(REPORTS_API + "?kind=" + encodeURIComponent(kind));
    renderReport(data.kind, data.items);
    renderAnalytics(data.kind, data.items);
    message();
  } catch (error) {
    message("Ошибка загрузки отчёта: " + error.message, true);
    tableHead.replaceChildren();
    tableBody.replaceChildren();
    kpiContainer.replaceChildren();
    destroyChart("report-canvas-1");
    destroyChart("report-canvas-2");
    emptyRow(tableBody, 4, "Данные не загружены");
  } finally {
    busy(false);
  }
}

/** Рендерит шапку и строки отчёта. */
function renderReport(kind, items) {
  tableHead.replaceChildren();
  tableBody.replaceChildren();

  const headRow = document.createElement("tr");

  if (kind === "groups") {
    for (const title of ["Группа", "Студентов", "Оценок", "Средний балл"]) {
      const th = document.createElement("th");
      th.textContent = title;
      if (title === "Студентов" || title === "Оценок" || title === "Средний балл") {
        th.className = "number";
      }
      headRow.append(th);
    }
    tableHead.append(headRow);

    if (!items.length) {
      emptyRow(tableBody, 4);
      return;
    }

    for (const item of items) {
      const row = document.createElement("tr");
      row.append(cell(item.name));
      row.append(cell(item.student_count, "number"));
      row.append(cell(item.grade_count, "number"));
      const avg = item.average_mark !== null && item.average_mark !== undefined
        ? Number(item.average_mark).toFixed(2)
        : null;
      row.append(cell(avg, "number"));
      tableBody.append(row);
    }
  } else {
    // no_grades или failing
    for (const title of ["Студент", "Группа"]) {
      const th = document.createElement("th");
      th.textContent = title;
      headRow.append(th);
    }
    tableHead.append(headRow);

    if (!items.length) {
      emptyRow(tableBody, 2);
      return;
    }

    for (const item of items) {
      const row = document.createElement("tr");
      row.append(cell(item.name));
      row.append(cell(item.group_name));
      tableBody.append(row);
    }
  }
}

/** Рендерит графики и сводные показатели KPI. */
function renderAnalytics(kind, items) {
  kpiContainer.replaceChildren();
  destroyChart("report-canvas-1");
  destroyChart("report-canvas-2");

  if (!items || !items.length) {
    chartCard1.hidden = true;
    chartCard2.hidden = true;
    kpiContainer.append(createKpiCard("Статус", "Нет данных", "В выборке пусто"));
    return;
  }

  chartCard1.hidden = false;

  if (kind === "groups") {
    chartCard2.hidden = false;

    // Подсчет KPI
    const totalGroups = items.length;
    const totalStudents = items.reduce((sum, g) => sum + (Number(g.student_count) || 0), 0);
    const totalGrades = items.reduce((sum, g) => sum + (Number(g.grade_count) || 0), 0);

    let sumWeightedAvg = 0, countGradesForAvg = 0;
    for (const g of items) {
      if (g.average_mark !== null && g.average_mark !== undefined && g.grade_count > 0) {
        sumWeightedAvg += Number(g.average_mark) * Number(g.grade_count);
        countGradesForAvg += Number(g.grade_count);
      }
    }
    const overallAvg = countGradesForAvg > 0 ? (sumWeightedAvg / countGradesForAvg).toFixed(2) : "—";

    kpiContainer.append(
      createKpiCard("Учебных групп", totalGroups, "Активные группы"),
      createKpiCard("Всего студентов", totalStudents, "Числится в базе"),
      createKpiCard("Всего оценок", totalGrades, "Внесено в журнал"),
      createKpiCard("Средний балл вуза", overallAvg, "Общая успеваемость")
    );

    // График 1: Средний академический балл по группам
    chartTitle1.textContent = "Средний балл по учебным группам";
    const groupLabels = items.map(g => g.name);
    const avgMarks = items.map(g => g.average_mark !== null ? Number(g.average_mark) : 0);

    const colors = getChartThemeColors();
    const barColors = avgMarks.map(m => {
      if (m >= 4.5) return "#10b981"; // Отлично
      if (m >= 3.8) return "#3b82f6"; // Хорошо
      if (m >= 3.0) return "#f59e0b"; // Удовлетворительно
      if (m > 0) return "#ef4444";    // Низкий балл
      return colors.isDark ? "#334155" : "#cbd5e1"; // Нет оценок
    });

    createBarChart("report-canvas-1", {
      labels: groupLabels,
      datasets: [{
        label: "Средний балл",
        data: avgMarks,
        backgroundColor: barColors
      }],
      yAxisTitle: "Балл (от 2 до 5)",
      yMax: 5,
      stepSize: 1
    });

    // График 2: Количество студентов и оценок
    chartTitle2.textContent = "Студенты и оценки по группам";
    createBarChart("report-canvas-2", {
      labels: groupLabels,
      datasets: [
        {
          label: "Студентов",
          data: items.map(g => Number(g.student_count) || 0),
          backgroundColor: "#3b82f6"
        },
        {
          label: "Оценок",
          data: items.map(g => Number(g.grade_count) || 0),
          backgroundColor: "#10b981"
        }
      ],
      yAxisTitle: "Количество"
    });

  } else if (kind === "no_grades") {
    chartCard2.hidden = true;

    // Группировка должников по учебным группам
    const groupMap = new Map();
    for (const item of items) {
      const gName = item.group_name || "Неизвестная";
      groupMap.set(gName, (groupMap.get(gName) || 0) + 1);
    }

    kpiContainer.append(
      createKpiCard("Без единой оценки", items.length, "Студентов в списке"),
      createKpiCard("Затронуто групп", groupMap.size, "Группы с долгами"),
      createKpiCard("Статус аттестации", "Требуется контроль", "Оценки отсутствуют")
    );

    chartTitle1.textContent = "Распределение студентов без оценок по группам";
    const labels = Array.from(groupMap.keys());
    const data = Array.from(groupMap.values());

    createDoughnutChart("report-canvas-1", {
      labels,
      data
    });

  } else if (kind === "failing") {
    chartCard2.hidden = true;

    // Группировка неуспевающих по учебным группам
    const groupMap = new Map();
    for (const item of items) {
      const gName = item.group_name || "Неизвестная";
      groupMap.set(gName, (groupMap.get(gName) || 0) + 1);
    }

    kpiContainer.append(
      createKpiCard("Студентов с двойками", items.length, "Имеют оценку 2"),
      createKpiCard("Групп с задолженностями", groupMap.size, "Академические долги"),
      createKpiCard("Рекомендация", "На пересдачу", "Требуется исправление")
    );

    chartTitle1.textContent = "Распределение студентов с двойками по группам";
    const labels = Array.from(groupMap.keys());
    const data = Array.from(groupMap.values());

    const alertColors = ["#ef4444", "#f97316", "#f59e0b", "#e11d48", "#b91c1c"];
    createDoughnutChart("report-canvas-1", {
      labels,
      data,
      backgroundColors: labels.map((_, i) => alertColors[i % alertColors.length])
    });
  }
}

kindSelect.addEventListener("change", function() {
  loadReport(kindSelect.value);
});

loadReport(kindSelect.value);
