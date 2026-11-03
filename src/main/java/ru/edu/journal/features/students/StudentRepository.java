package ru.edu.journal.features.students;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import ru.edu.journal.features.students.dto.StudentDto;

import java.util.List;
import java.util.Optional;

@Repository
public class StudentRepository {

    private final JdbcClient jdbcClient;

    public StudentRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<StudentDto> findAll(Long groupId, String query) {
        String baseSql = """
                SELECT s.id, s.name, s.group_id, g.name AS group_name, s.email,
                       COUNT(gr.id) AS grade_count,
                       ROUND(AVG(gr.mark), 2) AS average_mark
                FROM students AS s
                JOIN groups AS g ON g.id = s.group_id
                LEFT JOIN grades AS gr ON gr.student_id = s.id
                WHERE (:groupId IS NULL OR s.group_id = :groupId)
                  AND (:query IS NULL OR LOWER(s.name) LIKE '%' || LOWER(:query) || '%')
                GROUP BY s.id, s.name, s.group_id, g.name, s.email
                ORDER BY s.name, s.id
                """;

        return jdbcClient.sql(baseSql)
                .param("groupId", groupId)
                .param("query", (query != null && !query.isBlank()) ? query.trim() : null)
                .query((rs, rowNum) -> {
                    Object avg = rs.getObject("average_mark");
                    return new StudentDto(
                            rs.getLong("id"),
                            rs.getString("name"),
                            rs.getLong("group_id"),
                            rs.getString("group_name"),
                            rs.getString("email"),
                            rs.getLong("grade_count"),
                            avg != null ? rs.getDouble("average_mark") : null
                    );
                })
                .list();
    }

    public Optional<StudentDto> findById(Long id) {
        String sql = """
                SELECT s.id, s.name, s.group_id, g.name AS group_name, s.email,
                       COUNT(gr.id) AS grade_count,
                       ROUND(AVG(gr.mark), 2) AS average_mark
                FROM students AS s
                JOIN groups AS g ON g.id = s.group_id
                LEFT JOIN grades AS gr ON gr.student_id = s.id
                WHERE s.id = ?
                GROUP BY s.id, s.name, s.group_id, g.name, s.email
                """;

        return jdbcClient.sql(sql)
                .param(id)
                .query((rs, rowNum) -> {
                    Object avg = rs.getObject("average_mark");
                    return new StudentDto(
                            rs.getLong("id"),
                            rs.getString("name"),
                            rs.getLong("group_id"),
                            rs.getString("group_name"),
                            rs.getString("email"),
                            rs.getLong("grade_count"),
                            avg != null ? rs.getDouble("average_mark") : null
                    );
                })
                .optional();
    }

    public Long insert(String name, Long groupId, String email) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("INSERT INTO students (name, group_id, email) VALUES (?, ?, ?)")
                .param(name)
                .param(groupId)
                .param(email)
                .update(keyHolder, "id");
        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    public void update(Long id, String name, Long groupId, String email) {
        jdbcClient.sql("UPDATE students SET name = ?, group_id = ?, email = ? WHERE id = ?")
                .param(name)
                .param(groupId)
                .param(email)
                .param(id)
                .update();
    }

    public void deleteGrades(Long studentId) {
        jdbcClient.sql("DELETE FROM grades WHERE student_id = ?")
                .param(studentId)
                .update();
    }

    public void delete(Long studentId) {
        jdbcClient.sql("DELETE FROM students WHERE id = ?")
                .param(studentId)
                .update();
    }
}
