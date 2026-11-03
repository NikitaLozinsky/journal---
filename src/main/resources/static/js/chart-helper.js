// chart-helper.js - Унифицированный хелпер для интерактивных графиков и диаграмм с поддержкой тем
const activeCharts = new Map();

/**
 * Получает цветовую схему для графиков в зависимости от активной темы оформления.
 */
export function getChartThemeColors() {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  return {
    isDark,
    textColor: isDark ? "#cbd5e1" : "#475569",
    headingColor: isDark ? "#f1f5f9" : "#1e293b",
    gridColor: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
    tooltipBg: isDark ? "#1e293b" : "#0f172a",
    tooltipTitle: isDark ? "#f8fafc" : "#ffffff",
    tooltipBody: isDark ? "#e2e8f0" : "#f1f5f9",
    borderColor: isDark ? "#334155" : "#e2e8f0",
    // Стандартные палитры
    palette: [
      "#3b82f6", // синий
      "#10b981", // изумрудный
      "#f59e0b", // янтарный
      "#ef4444", // красный
      "#8b5cf6", // фиолетовый
      "#06b6d4", // бирюзовый
      "#ec4899", // розовый
      "#64748b"  // сланцевый
    ],
    // Палитра для оценок (5, 4, 3, 2)
    marks: {
      5: "#22c55e", // зеленый (отлично)
      4: "#3b82f6", // синий (хорошо)
      3: "#f59e0b", // желтый (удовл)
      2: "#ef4444"  // красный (двойка)
    }
  };
}

/**
 * Уничтожает существующий график на указанном элементе canvas.
 */
export function destroyChart(canvasOrId) {
  const canvas = typeof canvasOrId === "string" ? document.getElementById(canvasOrId) : canvasOrId;
  if (!canvas) return;
  const existing = activeCharts.get(canvas);
  if (existing) {
    existing.destroy();
    activeCharts.delete(canvas);
  }
}

/**
 * Очищает все зарегистрированные графики.
 */
export function destroyAllCharts() {
  for (const chart of activeCharts.values()) {
    chart.destroy();
  }
  activeCharts.clear();
}

/**
 * Создает столбчатую диаграмму (Bar Chart).
 */
export function createBarChart(canvasOrId, { labels, datasets, yAxisTitle = "", isHorizontal = false, yMax = null, stepSize = null }) {
  if (typeof window.Chart === "undefined") {
    console.warn("Chart.js не загружен");
    return null;
  }

  const canvas = typeof canvasOrId === "string" ? document.getElementById(canvasOrId) : canvasOrId;
  if (!canvas) return null;
  destroyChart(canvas);

  const colors = getChartThemeColors();
  const indexAxis = isHorizontal ? "y" : "x";

  const chart = new window.Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((ds, idx) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: ds.backgroundColor || colors.palette[idx % colors.palette.length],
        borderColor: ds.borderColor || (colors.isDark ? "#1e293b" : "#ffffff"),
        borderWidth: ds.borderWidth !== undefined ? ds.borderWidth : 1,
        borderRadius: 5,
        maxBarThickness: 45
      }))
    },
    options: {
      indexAxis,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: "top",
          labels: {
            color: colors.textColor,
            font: { family: "system-ui, sans-serif", size: 12 }
          }
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.borderColor,
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          cornerRadius: 6
        }
      },
      scales: {
        x: {
          grid: { color: colors.gridColor },
          ticks: { color: colors.textColor, font: { size: 12 } }
        },
        y: {
          grid: { color: colors.gridColor },
          ticks: {
            color: colors.textColor,
            font: { size: 12 },
            stepSize: stepSize || undefined
          },
          title: yAxisTitle ? {
            display: true,
            text: yAxisTitle,
            color: colors.textColor,
            font: { size: 12, weight: 600 }
          } : { display: false },
          beginAtZero: true,
          max: yMax !== null ? yMax : undefined
        }
      }
    }
  });

  activeCharts.set(canvas, chart);
  return chart;
}

/**
 * Создает круговую / пончиковую диаграмму (Doughnut Chart).
 */
export function createDoughnutChart(canvasOrId, { labels, data, backgroundColors, title = "" }) {
  if (typeof window.Chart === "undefined") {
    console.warn("Chart.js не загружен");
    return null;
  }

  const canvas = typeof canvasOrId === "string" ? document.getElementById(canvasOrId) : canvasOrId;
  if (!canvas) return null;
  destroyChart(canvas);

  const colors = getChartThemeColors();
  const bgColors = backgroundColors || labels.map((_, i) => colors.palette[i % colors.palette.length]);

  const chart = new window.Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: colors.isDark ? "#1e293b" : "#ffffff",
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: colors.textColor,
            font: { family: "system-ui, sans-serif", size: 12 },
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.borderColor,
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          cornerRadius: 6,
          callbacks: {
            label: function(context) {
              const label = context.label || "";
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return ` ${label}: ${value} (${percentage}%)`;
            }
          }
        }
      },
      cutout: "60%"
    }
  });

  activeCharts.set(canvas, chart);
  return chart;
}

/**
 * Слушатель переключения темы для динамического обновления всех активных графиков.
 */
window.addEventListener("themechange", () => {
  const colors = getChartThemeColors();
  for (const chart of activeCharts.values()) {
    // Обновляем шкалы
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.grid.color = colors.gridColor;
        chart.options.scales.x.ticks.color = colors.textColor;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.grid.color = colors.gridColor;
        chart.options.scales.y.ticks.color = colors.textColor;
        if (chart.options.scales.y.title) {
          chart.options.scales.y.title.color = colors.textColor;
        }
      }
    }
    // Обновляем легенду
    if (chart.options.plugins && chart.options.plugins.legend) {
      chart.options.plugins.legend.labels.color = colors.textColor;
    }
    // Обновляем тултипы
    if (chart.options.plugins && chart.options.plugins.tooltip) {
      chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
      chart.options.plugins.tooltip.titleColor = colors.tooltipTitle;
      chart.options.plugins.tooltip.bodyColor = colors.tooltipBody;
      chart.options.plugins.tooltip.borderColor = colors.borderColor;
    }
    // Обновляем обводку датасетов
    for (const ds of chart.data.datasets) {
      ds.borderColor = colors.isDark ? "#1e293b" : "#ffffff";
    }
    chart.update();
  }
});
