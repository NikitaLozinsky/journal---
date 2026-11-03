package ru.edu.journal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import ru.edu.journal.common.DatabaseInitializer;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class DatabaseBaselineTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private DatabaseInitializer databaseInitializer;

    @BeforeEach
    void setUp() {
        databaseInitializer.initializeDatabase();
    }

    @Test
    void testBaselineDatabase() throws Exception {
        try (Connection con = dataSource.getConnection();
             Statement stmt = con.createStatement()) {

            // foreign_keys enabled
            try (ResultSet rs = stmt.executeQuery("PRAGMA foreign_keys")) {
                assertTrue(rs.next());
                assertEquals(1, rs.getInt(1), "Проверка внешних ключей выключена");
            }

            // foreign_key_check is empty
            try (ResultSet rs = stmt.executeQuery("PRAGMA foreign_key_check")) {
                boolean hasViolations = rs.next();
                assertTrue(!hasViolations, "Нарушены внешние ключи");
            }

            // table counts
            Map<String, Integer> counts = new HashMap<>();
            for (String table : new String[]{"groups", "students", "subjects", "grades"}) {
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + table)) {
                    assertTrue(rs.next());
                    counts.put(table, rs.getInt(1));
                }
            }

            assertEquals(3, counts.get("groups"), "Ожидалось 3 группы");
            assertEquals(60, counts.get("students"), "Ожидалось 60 студентов");
            assertEquals(3, counts.get("subjects"), "Ожидалось 3 предмета");
            assertEquals(162, counts.get("grades"), "Ожидалось 162 оценки");

            // students without grades
            try (ResultSet rs = stmt.executeQuery("""
                    SELECT COUNT(*)
                    FROM students AS s
                    LEFT JOIN grades AS gr ON gr.student_id = s.id
                    WHERE gr.id IS NULL
                    """)) {
                assertTrue(rs.next());
                assertEquals(6, rs.getInt(1), "Ожидалось шесть студентов без оценок");
            }
        }
    }
}
