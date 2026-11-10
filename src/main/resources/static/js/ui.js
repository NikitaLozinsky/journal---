export function cell(value, className = "") {
  const td = document.createElement("td");
  td.textContent = value === null || value === undefined ? "—" : String(value);
  td.className = className;
  return td;
}

function getToastStack() {
  let stack = document.querySelector(".toast-Stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-Stack";
    document.body.append(stack);
  }
  return stack;
}

/** Показывает сообщение в статус-блоке и выводит плавающий Toast. */
export function message(text = "", error = false) {
  const box = document.querySelector("#status");
  if (box) {
    box.textContent = text;
    box.hidden = !text;
    box.classList.toggle("error", error);
    box.setAttribute("role", error ? "alert" : "status");
  }

  if (text && !text.startsWith("Загрузка")) {
    const stack = getToastStack();
    const toast = document.createElement("div");
    toast.className = "toast-item" + (error ? " error" : "");

    const iconSvg = error
      ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
      : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;

    toast.innerHTML = `
      <div class="toast-content">
        ${iconSvg}
        <span class="toast-text">${text}</span>
      </div>
      <div class="toast-timer"></div>
    `;
    stack.append(toast);
    setTimeout(() => {
      toast.classList.add("toast-leaving");
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  if (error) {
    const activeForm = document.querySelector("#editor:not([hidden]), #confirmation:not([hidden]), #bulk-editor:not([hidden])");
    if (activeForm) {
      activeForm.classList.remove("shake-error");
      void activeForm.offsetWidth;
      activeForm.classList.add("shake-error");
      setTimeout(() => activeForm.classList.remove("shake-error"), 400);
    }
  }
}

export function busy(value) {
  document.querySelector("main").setAttribute("aria-busy", String(value));
  document.querySelectorAll("main button, main input, main select").forEach(function(control) {
    control.disabled = value;
  });
}

export function actions(id) {
  const box = document.createElement("div");
  box.className = "row-actions";
  for (const action of ["edit", "delete"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.dataset.id = String(id);
    button.textContent = action === "edit" ? "Изменить" : "Удалить";
    if (action === "delete") button.className = "button-danger";
    box.append(button);
  }
  return box;
}

export function emptyRow(body, columns, text = "Записей нет") {
  body.replaceChildren();
  const row = document.createElement("tr");
  const td = cell(text, "empty-row");
  td.colSpan = columns;
  row.append(td);
  body.append(row);
}

export function fillGroups(select, groups, includeAll = false) {
  const previous = select.value;
  select.replaceChildren();
  if (includeAll) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Все группы";
    select.append(option);
  }
  for (const group of groups) {
    const option = document.createElement("option");
    option.value = String(group.id);
    option.textContent = group.name;
    select.append(option);
  }
  if (Array.from(select.options).some(option => option.value === previous)) {
    select.value = previous;
  } else if (includeAll) {
    select.value = "";
  }
}
