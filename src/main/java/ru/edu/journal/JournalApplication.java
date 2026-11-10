package ru.edu.journal;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.EventListener;
import ru.edu.journal.common.DatabaseInitializer;
import ru.edu.journal.features.students.StudentService;

import javax.sql.DataSource;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;

@SpringBootApplication
public class JournalApplication implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(JournalApplication.class);

    private final ApplicationContext context;
    private final DatabaseInitializer databaseInitializer;
    private final DataSource dataSource;

    @org.springframework.beans.factory.annotation.Value("${app.public-url:http://journal.edu.local}")
    private String publicUrl;

    public JournalApplication(ApplicationContext context,
                              DatabaseInitializer databaseInitializer,
                              DataSource dataSource) {
        this.context = context;
        this.databaseInitializer = databaseInitializer;
        this.dataSource = dataSource;
    }

    public static void main(String[] args) {
        SpringApplication.run(JournalApplication.class, args);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady(ApplicationReadyEvent event) {
        if (event.getApplicationContext() instanceof ServletWebServerApplicationContext webContext) {
            int port = webContext.getWebServer().getPort();
            String contextPath = webContext.getServletContext().getContextPath();
            String path = (contextPath == null || contextPath.isBlank()) ? "/" : (contextPath.endsWith("/") ? contextPath : contextPath + "/");

            log.info("""
                
                ==========================================================
                  ЭЛЕКТРОННЫЙ ЖУРНАЛ УСПЕВАЕМОСТИ ГОТОВ К РАБОТЕ
                  Домен:       {}
                  Локальный:   http://127.0.0.1:{}{}
                  Режим БД:    SQLite WAL (Foreign Keys = ON)
                ==========================================================""",
                publicUrl, port, path
            );
        }
    }

    @Override
    public void run(String... args) throws Exception {
        Set<String> argSet = new HashSet<>(Arrays.asList(args));

        if (argSet.contains("--prepare")) {
            System.out.println("Восстановление базы данных...");
            Map<String, Integer> counts = databaseInitializer.initializeDatabase();
            System.out.println("База восстановлена: instance/journal.db");
            for (Map.Entry<String, Integer> entry : counts.entrySet()) {
                System.out.println(entry.getKey() + ": " + entry.getValue());
            }
            System.exit(0);
        }

        if (argSet.contains("--check-baseline") || argSet.contains("--check")) {
            boolean requireBaseline = argSet.contains("--check-baseline");
            checkDatabase(requireBaseline);
            System.exit(0);
        }

        if (argSet.contains("--check-rollback")) {
            checkRollback();
            System.exit(0);
        }
    }

    private void checkDatabase(boolean requireBaseline) throws Exception {
        try (Connection con = dataSource.getConnection();
             Statement stmt = con.createStatement()) {
            int enabled = 0;
            try (ResultSet rs = stmt.executeQuery("PRAGMA foreign_keys")) {
                if (rs.next()) enabled = rs.getInt(1);
            }
            int violations = 0;
            try (ResultSet rs = stmt.executeQuery("PRAGMA foreign_key_check")) {
                while (rs.next()) violations++;
            }

            System.out.println("foreign_keys: " + enabled);
            System.out.println("foreign_key_check: " + violations);

            Map<String, Integer> counts = new HashMap<>();
            for (String table : new String[]{"groups", "students", "subjects", "grades"}) {
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + table)) {
                    if (rs.next()) {
                        int c = rs.getInt(1);
                        counts.put(table, c);
                        System.out.println(table + ": " + c);
                    }
                }
            }

            int noGrades = 0;
            try (ResultSet rs = stmt.executeQuery("""
                    SELECT COUNT(*)
                    FROM students AS s
                    LEFT JOIN grades AS gr ON gr.student_id = s.id
                    WHERE gr.id IS NULL
                    """)) {
                if (rs.next()) noGrades = rs.getInt(1);
            }
            System.out.println("students_without_grades: " + noGrades);

            if (enabled != 1) {
                System.err.println("FAIL: Проверка внешних ключей выключена");
                System.exit(1);
            }
            if (violations != 0) {
                System.err.println("FAIL: Нарушены внешние ключи");
                System.exit(1);
            }
            if (requireBaseline) {
                if (!Integer.valueOf(3).equals(counts.get("groups")) ||
                    !Integer.valueOf(60).equals(counts.get("students")) ||
                    !Integer.valueOf(3).equals(counts.get("subjects")) ||
                    !Integer.valueOf(162).equals(counts.get("grades"))) {
                    System.err.println("FAIL: Сначала восстановите исходные данные");
                    System.exit(1);
                }
                if (noGrades != 6) {
                    System.err.println("FAIL: Ожидалось шесть студентов без оценок");
                    System.exit(1);
                }
            }
            System.out.println("PASS: база прошла проверку");
        }
    }

    private void checkRollback() throws Exception {
        StudentService studentService = context.getBean(StudentService.class);
        Long studentId;
        try (Connection con = dataSource.getConnection();
             Statement stmt = con.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT student_id FROM grades ORDER BY id LIMIT 1")) {
            if (!rs.next()) {
                System.err.println("Для проверки нужен студент с оценками");
                System.exit(1);
                return;
            }
            studentId = rs.getLong(1);
        }

        Map<String, List<List<Object>>> before = snapshot();

        boolean caught = false;
        try {
            studentService.deleteStudent(studentId, true);
        } catch (RuntimeException ex) {
            caught = true;
            System.out.println("Учебный сбой: " + ex.getMessage());
        }

        if (!caught) {
            System.err.println("FAIL: Сервис не вызвал учебную ошибку");
            System.exit(1);
        }

        Map<String, List<List<Object>>> afterRollback = snapshot();
        if (!before.equals(afterRollback)) {
            System.err.println("FAIL: Откат неполный: данные изменились");
            System.exit(1);
        }
        System.out.println("PASS: студент и все оценки сохранены после отката");

        studentService.deleteStudent(studentId, false);
        Map<String, List<List<Object>>> after = snapshot();
        boolean studentExists = after.get("students").stream().anyMatch(row -> row.get(0).equals(studentId));
        boolean gradesExist = after.get("grades").stream().anyMatch(row -> row.get(1).equals(studentId));

        if (studentExists || gradesExist) {
            System.err.println("FAIL: Удаление не убрало студента или его оценки");
            System.exit(1);
        }

        System.out.println("PASS: обычное удаление убрало студента и его оценки");

        // Восстановление удаленного студента и его оценок из снимка before для сохранения рабочей базы
        try (Connection con = dataSource.getConnection()) {
            con.setAutoCommit(false);
            try {
                List<Object> studentRow = before.get("students").stream()
                        .filter(r -> r.get(0).equals(studentId))
                        .findFirst()
                        .orElse(null);
                if (studentRow != null) {
                    try (var ps = con.prepareStatement("INSERT INTO students (id, name, group_id, email) VALUES (?, ?, ?, ?)")) {
                        ps.setObject(1, studentRow.get(0));
                        ps.setObject(2, studentRow.get(1));
                        ps.setObject(3, studentRow.get(2));
                        ps.setObject(4, studentRow.get(3));
                        ps.executeUpdate();
                    }
                }

                List<List<Object>> studentGrades = before.get("grades").stream()
                        .filter(r -> r.get(1).equals(studentId))
                        .toList();
                for (List<Object> gRow : studentGrades) {
                    try (var ps = con.prepareStatement("INSERT INTO grades (id, student_id, subject_id, mark) VALUES (?, ?, ?, ?)")) {
                        ps.setObject(1, gRow.get(0));
                        ps.setObject(2, gRow.get(1));
                        ps.setObject(3, gRow.get(2));
                        ps.setObject(4, gRow.get(3));
                        ps.executeUpdate();
                    }
                }
                con.commit();
            } catch (Exception ex) {
                con.rollback();
                throw ex;
            } finally {
                con.setAutoCommit(true);
            }
        }

        Map<String, List<List<Object>>> finalSnapshot = snapshot();
        if (!before.equals(finalSnapshot)) {
            System.err.println("FAIL: Рабочая база не была восстановлена до исходного состояния");
            System.exit(1);
        }

        System.out.println("PASS: рабочая база не изменена проверкой");
    }

    private Map<String, List<List<Object>>> snapshot() throws Exception {
        Map<String, List<List<Object>>> result = new HashMap<>();
        try (Connection con = dataSource.getConnection();
             Statement stmt = con.createStatement()) {
            for (String table : new String[]{"groups", "students", "subjects", "grades"}) {
                List<List<Object>> rows = new ArrayList<>();
                try (ResultSet rs = stmt.executeQuery("SELECT * FROM " + table + " ORDER BY id")) {
                    int colCount = rs.getMetaData().getColumnCount();
                    while (rs.next()) {
                        List<Object> row = new ArrayList<>();
                        for (int i = 1; i <= colCount; i++) {
                            row.add(rs.getObject(i));
                        }
                        rows.add(row);
                    }
                }
                result.put(table, rows);
            }
        }
        return result;
    }
}
