package ru.edu.journal;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import ru.edu.journal.common.DatabaseInitializer;
import ru.edu.journal.features.students.StudentService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RollbackTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private DatabaseInitializer databaseInitializer;

    @Autowired
    private StudentService studentService;

    @BeforeEach
    void setUp() {
        databaseInitializer.initializeDatabase();
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

    @Test
    void testRollbackOnSimulatedError() throws Exception {
        Long studentId;
        try (Connection con = dataSource.getConnection();
             Statement stmt = con.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT student_id FROM grades ORDER BY id LIMIT 1")) {
            assertTrue(rs.next(), "Для проверки нужен студент с оценками");
            studentId = rs.getLong(1);
        }

        Map<String, List<List<Object>>> before = snapshot();

        // 1. Попытка удаления с искусственным сбоем (simulateError = true)
        boolean caught = false;
        try {
            studentService.deleteStudent(studentId, true);
        } catch (RuntimeException ex) {
            caught = true;
            System.out.println("Учебный сбой: " + ex.getMessage());
        }

        assertTrue(caught, "Сервис должен был выбросить учебную ошибку");
        Map<String, List<List<Object>>> afterRollback = snapshot();
        assertEquals(before, afterRollback, "Откат неполный: данные изменились после исключения");
        System.out.println("PASS: студент и все оценки сохранены после отката");

        // 2. Успешное удаление без сбоя (simulateError = false)
        studentService.deleteStudent(studentId, false);
        Map<String, List<List<Object>>> afterDelete = snapshot();

        assertNotEquals(before.get("students"), afterDelete.get("students"));
        assertNotEquals(before.get("grades"), afterDelete.get("grades"));
        assertEquals(before.get("groups"), afterDelete.get("groups"));
        assertEquals(before.get("subjects"), afterDelete.get("subjects"));

        // Убеждаемся, что удален именно этот студент и его оценки
        boolean studentExists = afterDelete.get("students").stream().anyMatch(row -> row.get(0).equals(studentId));
        boolean gradesExist = afterDelete.get("grades").stream().anyMatch(row -> row.get(1).equals(studentId));
        assertFalse(studentExists, "Студент должен быть удален");
        assertFalse(gradesExist, "Оценки студента должны быть удалены");

        System.out.println("PASS: обычное удаление убрало студента и его оценки");
    }
}
