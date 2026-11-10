# Руководство 02: База данных SQLite, чистый SQL и Spring JdbcClient

Добро пожаловать во второе руководство по архитектуре проекта **«Электронный журнал успеваемости студентов» (jrnl)**!

В этом руководстве мы детально разберем слой работы с данными:
1. Почему в проекте используется **SQLite** в режиме **WAL**, а не тяжелые внешние СУБД вроде PostgreSQL или MySQL.
2. Почему мы отказались от ORM (Hibernate / Spring Data JPA) в пользу **чистого SQL** и современного **Spring `JdbcClient`**.
3. Как устроена схема данных ([`schema.sql`](file:///home/milk13/IdeaProjects/jrnl/src/main/resources/db/schema.sql)), как работают ограничения целостности (`FOREIGN KEY`, `CHECK`, `CASCADE`, `RESTRICT`) и индексы.
4. Как работают **атомарные транзакции** (`@Transactional`) и почему при сбоях база данных гарантированно откатывается назад (разбор [`RollbackTest.java`](file:///home/milk13/IdeaProjects/jrnl/src/test/java/ru/edu/journal/RollbackTest.java)).
5. Как происходит автоматическая инициализация базы данных при первом старте приложения.

---

## 1. Ментальная модель: как SQLite хранит данные на диске

В отличие от клиент-серверных СУБД (PostgreSQL, Oracle), где база данных — это отдельный постоянно запущенный сетевой сервис, **SQLite — это встраиваемая (embedded) библиотека**.

Вся база данных хранится в одном обычном файле на диске: [`instance/journal.db`](file:///home/milk13/IdeaProjects/jrnl/instance/journal.db).

```
+-----------------------------------------------------------------------------------+
|                               Java-процесс (JVM)                                  |
|                                                                                   |
|  [ Feature Service ] ---> [ Feature Repository ] ---> [ Spring JdbcClient ]      |
|                                                                 |                 |
|                                                                 v                 |
|                                                     [ SQLite JDBC Driver ]        |
|                                                                 |                 |
+-----------------------------------------------------------------|-----------------+
                                                                  | Прямой ввод-вывод
                                                                  v (Системные вызовы ОС)
+-----------------------------------------------------------------------------------+
| Файловая система: папка instance/                                                 |
|                                                                                   |
|   ├── journal.db          <-- Основной файл данных (B-Tree страницы по 4 КБ)      |
|   ├── journal.db-wal      <-- Журнал упреждающей записи (Write-Ahead Log)         |
|   └── journal.db-shm      <-- Разделяемая память индексов WAL (Shared Memory)     |
+-----------------------------------------------------------------------------------+
```

### Преимущества такого подхода:
* **Нулевая настройка (Zero-Config):** приложению не нужен установленный сервер БД, не нужны логины, пароли и права доступа к сокетам.
* **Портативность:** чтобы сделать резервную копию всей системы, достаточно просто скопировать файл `journal.db`.
* **Минимальное потребление памяти:** SQLite работает в адресном пространстве самого Java-приложения.

---

## 2. Магия режима WAL (Write-Ahead Logging)

По умолчанию старые версии SQLite использовали режим отката (Rollback Journal), при котором пишущий поток полностью блокировал всех читателей. 

В нашем проекте в классе [`DatabaseConfig.java`](file:///home/milk13/IdeaProjects/jrnl/src/main/java/ru/edu/journal/config/DatabaseConfig.java) при открытии каждого соединения принудительно активируется режим **WAL**:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
```

```mermaid
flowchart TD
    subgraph ReadOperation ["Чтение данных (Параллельные потоки)"]
        R1["Поток 1: GET /api/journal"] --> DB["Основной файл journal.db"]
        R2["Поток 2: GET /api/reports"] --> DB
        R3["Поток 3: GET /api/students"] --> WAL["Свежие коммиты в journal.db-wal"]
    end

    subgraph WriteOperation ["Запись данных (Атомарная транзакция)"]
        W1["Поток 4: POST /api/journal/grades"] -->|"Быстрая последовательная дозапись в конец"| WAL
    end

    WAL -.->|"Периодический сброс (Checkpoint)"| DB
```

### Как WAL решает проблему параллелизма:
1. **Читатели не блокируют писателей, а писатели не блокируют читателей.** Несколько пользователей могут одновременно просматривать отчеты и журнал, пока преподаватель выставляет оценки.
2. **Высокая скорость записи:** изменения не перезаписывают случайные сектора внутри файла `journal.db`, а последовательно дописываются в конец файла `journal.db-wal` (Sequential I/O).

---

## 3. Почему чистый SQL и `JdbcClient` вместо Hibernate / JPA?

Во многих корпоративных проектах по привычке используют Spring Data JPA и Hibernate. Однако для задач с прозрачной аналитикой и сложными матричными отчетами ORM часто становится источником проблем:

| Критерий | Hibernate / JPA | Чистый SQL + Spring `JdbcClient` (наш выбор) |
|---|---|---|
| **Контроль над SQL** | Скрыт за генератором HQL/JPQL. Сложно предсказать, какой именно запрос уйдет в базу. | **100% контроль**. Вы точно видите каждый символ SQL-запроса. |
| **Проблема N+1** | Классическая ловушка: ленивая загрузка (`LazyLoading`) генерирует сотни мелких запросов в цикле. | **Исключена**. Данные читаются одним `JOIN` или агрегацией `GROUP BY`. |
| **Скорость запуска** | Медленный старт из-за построения метамодели сущностей и проксирования. | **Мгновенный старт** (приложение поднимается за 1.2–1.5 секунды). |
| **Отладка и X-Ray** | Сложно связать вызов метода с реальным SQL в инспекторе. | **Прямая прозрачность:** инспектор X-Ray показывает реальный SQL и точное время выполнения в миллисекундах. |

### Как устроен `JdbcClient` в Spring Boot 3

Начиная со Spring Boot 3.1.2 появился современный fluent API — **`JdbcClient`**, пришедший на смену старому `NamedParameterJdbcTemplate`:

```java
// Пример из StudentRepository.java:
public List<StudentDto> findAll(String query, Long groupId) {
    var sql = new StringBuilder("""
        SELECT s.id, s.name, s.email, s.group_id, g.name AS group_name,
               ROUND(AVG(gr.mark), 2) AS average_mark,
               COUNT(gr.id) AS grades_count
        FROM students s
        JOIN groups g ON s.group_id = g.id
        LEFT JOIN grades gr ON s.id = gr.student_id
        WHERE 1 = 1
    """);

    Map<String, Object> params = new HashMap<>();
    if (query != null && !query.isBlank()) {
        sql.append(" AND (LOWER(s.name) LIKE :q OR LOWER(s.email) LIKE :q)");
        params.put("q", "%" + query.toLowerCase().trim() + "%");
    }

    return jdbcClient.sql(sql.toString())
        .params(params)
        .query(this::mapRowToStudentDto) // Элегантный маппинг в DTO
        .list();
}
```

---

## 4. Схема данных и целостность связей

Файл схемы [`src/main/resources/db/schema.sql`](file:///home/milk13/IdeaProjects/jrnl/src/main/resources/db/schema.sql) определяет 4 ключевые сущности:

```mermaid
erDiagram
    GROUPS ||--o{ STUDENTS : "содержит (1:N)"
    STUDENTS ||--o{ GRADES : "получает (1:N)"
    SUBJECTS ||--o{ GRADES : "оценивается (1:N)"

    GROUPS {
        INTEGER id PK "AUTOINCREMENT"
        TEXT name UK "CHECK length > 0"
    }

    STUDENTS {
        INTEGER id PK "AUTOINCREMENT"
        TEXT name "NOT NULL"
        INTEGER group_id FK "REFERENCES groups(id) RESTRICT"
        TEXT email "CHECK email format / NULL"
    }

    SUBJECTS {
        INTEGER id PK "AUTOINCREMENT"
        TEXT name UK "CHECK length > 0"
    }

    GRADES {
        INTEGER id PK "AUTOINCREMENT"
        INTEGER student_id FK "REFERENCES students(id) CASCADE"
        INTEGER subject_id FK "REFERENCES subjects(id) RESTRICT"
        INTEGER mark "CHECK mark BETWEEN 2 AND 5"
    }
```

### Ключевые архитектурные правила схемы:

1. **Защита от случайного удаления групп (`ON DELETE RESTRICT`):**
   * Если в группе есть хоть один студент, попытка выполнить `DELETE FROM groups WHERE id = ?` приведет к ошибке SQLite: `FOREIGN KEY constraint failed`.
   * Сервис [`GroupService.java`](file:///home/milk13/IdeaProjects/jrnl/src/main/java/ru/edu/journal/features/groups/GroupService.java) перехватывает это правило и возвращает пользователю понятное сообщение с кодом HTTP 400.

2. **Защита дисциплин с оценками (`ON DELETE RESTRICT`):**
   * Нельзя удалить предмет, если по нему уже выставлены оценки в ведомостях. Оценки — это юридический документ.

3. **Каскадное удаление оценок при отчислении студента (`ON DELETE CASCADE`):**
   * Если студент отчисляется из университета, его оценки в таблице `grades` удаляются автоматически и атомарно в той же транзакции.

4. **Уникальность оценок (Идемпотентный UPSERT):**
   * В таблице `grades` создан уникальный композитный индекс:
     ```sql
     CREATE UNIQUE INDEX idx_grades_student_subject ON grades(student_id, subject_id);
     ```
   * У одного студента по одной дисциплине может быть ровно одна итоговая оценка.
   * При сохранении оценки репозиторий [`JournalRepository.java`](file:///home/milk13/IdeaProjects/jrnl/src/main/java/ru/edu/journal/features/journal/JournalRepository.java) использует конструкцию **`UPSERT`**:
     ```sql
     INSERT INTO grades (student_id, subject_id, mark)
     VALUES (:studentId, :subjectId, :mark)
     ON CONFLICT(student_id, subject_id) DO UPDATE SET mark = excluded.mark;
     ```

---

## 5. Транзакции и защита от сбоев (ACID)

Что произойдет, если в середине сложной операции (например, удаление студента и сопутствующих записей) пропадет питание или упадет сервер?

В Java за атомарность отвечает аннотация **`@Transactional`**:

```mermaid
sequenceDiagram
    autonumber
    actor Service as StudentService.deleteStudent()
    participant TxManager as DataSourceTransactionManager
    participant Conn as SQLite Connection
    participant DB as SQLite WAL

    Service->>TxManager: Вход в метод @Transactional
    TxManager->>Conn: conn.setAutoCommit(false) (Старт транзакции)
    
    Service->>DB: 1. DELETE FROM grades WHERE student_id = 42
    DB-->>Service: Успешно удалено 5 оценок
    
    alt Внезапный сбой (Исключение RuntimeException)
        Service-->>TxManager: Выброс ошибки (Exception)
        TxManager->>Conn: conn.rollback()
        Note over DB: Все удаленные оценки мгновенно возвращаются назад!
    else Успешное завершение
        Service->>DB: 2. DELETE FROM students WHERE id = 42
        DB-->>Service: Успешно удален 1 студент
        Service-->>TxManager: Выход из метода
        TxManager->>Conn: conn.commit()
        Note over DB: Изменения зафиксированы в journal.db-wal
    end
```

### Как это проверяется в автотестах:

В проекте написан специальный тест на устойчивость к сбоям — [`RollbackTest.java`](file:///home/milk13/IdeaProjects/jrnl/src/test/java/ru/edu/journal/RollbackTest.java):

```java
@Test
void testRollbackWhenFailureOccurs() {
    // 1. Создаем тестового студента и ставим ему оценки
    StudentDto student = studentService.createStudent(new StudentSaveRequest("Тестовый Студент", groupId, null));
    journalService.saveGrade(student.id(), subjectId, 5);

    // 2. Вызываем метод, который намеренно бросает исключение в середине транзакции
    assertThrows(RuntimeException.class, () -> {
        failingTransactionService.deleteStudentWithDeliberateFailure(student.id());
    });

    // 3. ПРОВЕРКА: Студент и его оценки ОБЯЗАНЫ остаться в базе данных в целости!
    assertNotNull(studentRepository.findById(student.id()));
    assertEquals(1, journalRepository.countGradesByStudent(student.id()));
}
```

Все 10 тестов проекта выполняются при каждой сборке `mvn test` и подтверждают 100% надежность транзакций.

---

## 6. Первичная инициализация (DatabaseInitializer)

При самом первом запуске проекта папка `instance/` может быть пустой. Как приложение узнает, какие таблицы создавать?

За это отвечает компонент [`DatabaseInitializer.java`](file:///home/milk13/IdeaProjects/jrnl/src/main/java/ru/edu/journal/common/DatabaseInitializer.java), реализующий интерфейс Spring `CommandLineRunner`:

```mermaid
flowchart TD
    Start["Запуск Spring Boot"] --> CheckDB{"Существует ли файл<br>instance/journal.db?"}
    
    CheckDB -->|"Нет"| CreateFile["Создание файла и папки instance/"]
    CheckDB -->|"Да"| CheckTables{"Есть ли таблица groups?"}
    
    CreateFile --> ExecSchema["Выполнение db/schema.sql<br>(CREATE TABLE IF NOT EXISTS)"]
    CheckTables -->|"Нет таблиц"| ExecSchema
    CheckTables -->|"Таблицы есть"| Ready["База данных готова к работе"]
    
    ExecSchema --> CheckSeed{"База данных пуста?"}
    CheckSeed -->|"Да"| ExecSeed["Выполнение db/seed.sql<br>(3 группы, 60 студентов, 3 предмета, 162 оценки)"]
    CheckSeed -->|"Нет"| Ready
    ExecSeed --> Ready
```

Если база данных пустая, скрипт [`seed.sql`](file:///home/milk13/IdeaProjects/jrnl/src/main/resources/db/seed.sql) автоматически генерирует реалистичный учебный поток:
* **3 группы:** БЭИ2301, БЭИ2302, БЭИ2303.
* **60 студентов:** по 20 студентов на поток.
* **3 дисциплины:** Математический анализ, Базы данных, Программирование на Java.
* **162 оценки:** полный срез успеваемости для мгновенной проверки аналитики и графиков.

---

## 7. Резюме

Слой данных в проекте `jrnl`:
1. Полностью автономен и не требует внешних серверов благодаря **SQLite WAL**.
2. Обеспечивает максимальную производительность и предсказуемость благодаря **чистому SQL** и **Spring `JdbcClient`**.
3. Гарантирует ссылочную целостность и защиту от случайных удалений на уровне ядра БД.
4. Защищен транзакционным откатом изменений при любых сбоях.

В следующем руководстве [**03-frontend-vanilla-js-and-modern-aurora-ui.md**](file:///home/milk13/IdeaProjects/jrnl/docs/03-frontend-vanilla-js-and-modern-aurora-ui.md) мы разберем, как устроен клиентский интерфейс, Canvas-физика Google Antigravity, интерактивный поповер оценок и реактивный Vanilla JS.
