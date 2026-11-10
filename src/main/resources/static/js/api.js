/** Сопоставление REST-маршрутов с архитектурой классов и SQL-запросами проекта */
function buildArchitectureTrace(url, method, reqData, status, serverMs, controllerHeader) {
  const cleanUrl = url.split("?")[0];
  const params = new URLSearchParams(url.split("?")[1] || "");

  let controller = controllerHeader || "DispatcherServlet";
  let service = "";
  let repo = "";
  let tx = false;
  let sql = "";

  // 1. Учебные группы
  if (cleanUrl === "/api/groups" && method === "GET") {
    controller = controllerHeader || "GroupController.listGroups()";
    service = "GroupService.listGroups()";
    repo = "GroupRepository.findAllWithStudentCount()";
    sql = `SELECT g.id, g.name, COUNT(s.id) AS student_count\nFROM groups AS g\nLEFT JOIN students AS s ON s.group_id = g.id\nGROUP BY g.id, g.name\nORDER BY g.name, g.id;`;
  } else if (cleanUrl === "/api/groups" && method === "POST") {
    const name = reqData?.name || "";
    controller = controllerHeader || "GroupController.createGroup()";
    service = "GroupService.saveGroup(name, null)";
    repo = "GroupRepository.insert(name)";
    tx = true;
    sql = `INSERT INTO groups (name) VALUES ('${name}');\nSELECT id, name FROM groups WHERE id = last_insert_rowid();`;
  } else if (cleanUrl.startsWith("/api/groups/") && method === "POST") {
    const id = cleanUrl.split("/").pop();
    const name = reqData?.name || "";
    controller = controllerHeader || "GroupController.updateGroup()";
    service = `GroupService.saveGroup('${name}', ${id})`;
    repo = "GroupRepository.update(id, name)";
    tx = true;
    sql = `UPDATE groups SET name = '${name}' WHERE id = ${id};`;
  } else if (cleanUrl.startsWith("/api/groups/") && method === "DELETE") {
    const id = cleanUrl.split("/").pop();
    controller = controllerHeader || "GroupController.deleteGroup()";
    service = `GroupService.deleteGroup(${id})`;
    repo = "GroupRepository.countStudents() → delete()";
    tx = true;
    sql = `SELECT COUNT(*) FROM students WHERE group_id = ${id};\nDELETE FROM groups WHERE id = ${id};`;
  }

  // 2. Предметы
  else if (cleanUrl === "/api/subjects" && method === "GET") {
    controller = controllerHeader || "SubjectController.listSubjects()";
    service = "SubjectService.listSubjects()";
    repo = "SubjectRepository.findAll()";
    sql = `SELECT id, name FROM subjects ORDER BY name, id;`;
  } else if (cleanUrl.startsWith("/api/subjects") && method === "POST") {
    const id = cleanUrl.split("/")[3] || null;
    const name = reqData?.name || "";
    controller = controllerHeader || (id ? "SubjectController.updateSubject()" : "SubjectController.createSubject()");
    service = `SubjectService.saveSubject('${name}', ${id})`;
    repo = id ? "SubjectRepository.update()" : "SubjectRepository.insert()";
    tx = true;
    sql = id
      ? `UPDATE subjects SET name = '${name}' WHERE id = ${id};`
      : `INSERT INTO subjects (name) VALUES ('${name}');`;
  } else if (cleanUrl.startsWith("/api/subjects/") && method === "DELETE") {
    const id = cleanUrl.split("/").pop();
    controller = controllerHeader || "SubjectController.deleteSubject()";
    service = `SubjectService.deleteSubject(${id})`;
    repo = "SubjectRepository.countGrades() → delete()";
    tx = true;
    sql = `SELECT COUNT(*) FROM grades WHERE subject_id = ${id};\nDELETE FROM subjects WHERE id = ${id};`;
  }

  // 3. Студенты
  else if (cleanUrl === "/api/students" && method === "GET") {
    const gId = params.get("group_id") || "NULL";
    const q = params.get("q") ? `'${params.get("q")}'` : "NULL";
    controller = controllerHeader || "StudentController.listStudents()";
    service = "StudentService.listStudents(groupId, query)";
    repo = "StudentRepository.findAll()";
    sql = `SELECT s.id, s.name, s.group_id, g.name AS group_name, s.email,\n       COUNT(gr.id) AS grade_count, ROUND(AVG(gr.mark), 2) AS average_mark\nFROM students AS s\nJOIN groups AS g ON g.id = s.group_id\nLEFT JOIN grades AS gr ON gr.student_id = s.id\nWHERE (${gId} IS NULL OR s.group_id = ${gId})\n  AND (${q} IS NULL OR LOWER(s.name) LIKE '%' || LOWER(${q}) || '%')\nGROUP BY s.id, s.name, s.group_id, g.name, s.email\nORDER BY s.name, s.id;`;
  } else if (cleanUrl.startsWith("/api/students") && method === "POST") {
    const id = cleanUrl.split("/")[3] || null;
    const n = reqData?.name || "";
    const g = reqData?.group_id || "NULL";
    const em = reqData?.email ? `'${reqData.email}'` : "NULL";
    controller = controllerHeader || (id ? "StudentController.updateStudent()" : "StudentController.createStudent()");
    service = `StudentService.saveStudent(req, ${id})`;
    repo = id ? "StudentRepository.update()" : "StudentRepository.insert()";
    tx = true;
    sql = id
      ? `UPDATE students SET name = '${n}', group_id = ${g}, email = ${em} WHERE id = ${id};`
      : `INSERT INTO students (name, group_id, email) VALUES ('${n}', ${g}, ${em});`;
  } else if (cleanUrl.startsWith("/api/students/") && method === "DELETE") {
    const id = cleanUrl.split("/").pop();
    controller = controllerHeader || "StudentController.deleteStudent()";
    service = `StudentService.deleteStudent(${id}, false)`;
    repo = "StudentRepository.deleteGrades() → delete()";
    tx = true;
    sql = `BEGIN TRANSACTION;\nDELETE FROM grades WHERE student_id = ${id};\nDELETE FROM students WHERE id = ${id};\nCOMMIT;`;
  }

  // 4. Журнал и оценки
  else if (cleanUrl === "/api/journal" && method === "GET") {
    const gId = params.get("group_id") || 1;
    controller = controllerHeader || "JournalController.getJournal()";
    service = `JournalService.getJournal(${gId})`;
    repo = "GroupRepository + JournalRepository + SubjectRepository";
    if (gId === "all") {
      sql = `SELECT * FROM groups ORDER BY name;\nSELECT s.*, ROUND(AVG(gr.mark), 2) FROM students s LEFT JOIN grades gr ON gr.student_id = s.id GROUP BY s.id;\nSELECT gr.id, gr.student_id, gr.subject_id, gr.mark FROM grades gr;`;
    } else {
      sql = `SELECT id, name FROM groups WHERE id = ${gId};\nSELECT s.*, COUNT(gr.id), ROUND(AVG(gr.mark), 2) FROM students s LEFT JOIN grades gr ON gr.student_id = s.id WHERE s.group_id = ${gId} GROUP BY s.id;\nSELECT gr.id, gr.student_id, gr.subject_id, gr.mark FROM grades gr JOIN students s ON s.id = gr.student_id WHERE s.group_id = ${gId};`;
    }
  } else if (cleanUrl === "/api/journal/grades" && method === "POST") {
    const sId = reqData?.student_id;
    const subId = reqData?.subject_id;
    const m = reqData?.mark;
    controller = controllerHeader || "JournalController.saveGrade()";
    service = `JournalService.saveGrade(student=${sId}, subject=${subId}, mark=${m})`;
    repo = "JournalRepository.findGrade() → insertGrade() / updateGrade()";
    tx = true;
    sql = `SELECT id FROM grades WHERE student_id = ${sId} AND subject_id = ${subId};\n-- Upsert (INSERT или UPDATE в рамках @Transactional):\nINSERT INTO grades (student_id, subject_id, mark) VALUES (${sId}, ${subId}, ${m})\n  ON CONFLICT(student_id, subject_id) DO UPDATE SET mark = ${m};`;
  } else if (cleanUrl === "/api/journal/grades/bulk" && method === "POST") {
    const gId = reqData?.group_id;
    const subId = reqData?.subject_id;
    const m = reqData?.mark;
    controller = controllerHeader || "JournalController.saveBulkGrades()";
    service = `JournalService.saveBulkGrades(group=${gId || 'ALL'}, subject=${subId || 'ALL'}, mark=${m})`;
    repo = "JournalRepository.bulkInsert()";
    tx = true;
    sql = `-- Массовое выставление оценок (ON CONFLICT DO UPDATE):\nINSERT INTO grades (student_id, subject_id, mark)\nSELECT s.id, sub.id, ${m}\nFROM students s, subjects sub\nWHERE (${gId ? `s.group_id = ${gId}` : '1=1'}) AND (${subId ? `sub.id = ${subId}` : '1=1'})\nON CONFLICT(student_id, subject_id) DO UPDATE SET mark = excluded.mark;`;
  } else if (cleanUrl.startsWith("/api/journal/grades/") && method === "DELETE") {
    const parts = cleanUrl.split("/");
    const subId = parts.pop();
    const sId = parts.pop();
    controller = controllerHeader || "JournalController.deleteGrade()";
    service = `JournalService.deleteGrade(${sId}, ${subId})`;
    repo = "JournalRepository.deleteGrade()";
    tx = true;
    sql = `DELETE FROM grades WHERE student_id = ${sId} AND subject_id = ${subId};`;
  }

  // 5. Отчёты
  else if (cleanUrl === "/api/reports" && method === "GET") {
    const kind = params.get("kind") || "groups";
    controller = controllerHeader || "ReportController.getReport()";
    service = `ReportService.getReport('${kind}')`;
    repo = `ReportRepository.${kind === "groups" ? "groupReport" : kind === "no_grades" ? "noGradesReport" : "failingReport"}()`;
    if (kind === "groups") {
      sql = `SELECT g.id, g.name, COUNT(DISTINCT s.id) AS student_count,\n       COUNT(gr.id) AS grade_count, ROUND(AVG(gr.mark), 2) AS average_mark\nFROM groups g LEFT JOIN students s ON s.group_id = g.id\nLEFT JOIN grades gr ON gr.student_id = s.id\nGROUP BY g.id, g.name ORDER BY g.name;`;
    } else if (kind === "no_grades") {
      sql = `SELECT s.id, s.name, g.name AS group_name\nFROM students s JOIN groups g ON g.id = s.group_id\nLEFT JOIN grades gr ON gr.student_id = s.id\nGROUP BY s.id HAVING COUNT(gr.id) = 0;`;
    } else {
      sql = `SELECT s.id, s.name, g.name AS group_name\nFROM students s JOIN groups g ON g.id = s.group_id\nJOIN grades gr ON gr.student_id = s.id\nGROUP BY s.id HAVING MIN(gr.mark) = 2;`;
    }
  }

  return {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString("ru-RU", { hour12: false }),
    method,
    url,
    status,
    durationMs: serverMs,
    controller,
    service,
    repo,
    tx,
    sql,
    payload: reqData
  };
}

/** Выполняет JSON-запрос, отдельно обрабатывая сеть, HTTP, 204 и телеметрию для шторки. */
export async function requestJSON(url, method = "GET", data = null) {
  const options = { method, headers: {} };
  if (data !== null) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(data);
  }
  const t0 = performance.now();
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error("Нет связи с сервером. Проверьте его запуск.");
  }

  const clientMs = (performance.now() - t0).toFixed(1);
  const serverMs = response.headers.get("X-Exec-Time-Ms") || clientMs;
  const controllerHeader = response.headers.get("X-Java-Controller");

  // Отправляем событие в шторку «Рентген логики»
  try {
    const trace = buildArchitectureTrace(url, method, data, response.status, serverMs, controllerHeader);
    window.dispatchEvent(new CustomEvent("journal:apicall", { detail: trace }));
  } catch ( ignored ) {}

  if (response.status === 204) return null;
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Сервер вернул ответ не в формате JSON.");
  }
  if (!response.ok) throw new Error(payload.error || "Ошибка HTTP " + response.status);
  return payload;
}
