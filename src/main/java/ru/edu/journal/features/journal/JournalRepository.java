package ru.edu.journal.features.journal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import ru.edu.journal.features.journal.dto.GradeDto;
import ru.edu.journal.features.students.dto.StudentDto;

import java.util.List;
import java.util.Optional;

@Repository
public class JournalRepository {

    private final JdbcClient jdbcClient;

    public JournalRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<StudentDto> findStudentsByGroupId(Long groupId) {
        return jdbcClient.sql("""
                SELECT s.id, s.name, s.group_id, g.name AS group_name, s.email,
                       COUNT(gr.id) AS grade_count,
                       ROUND(AVG(gr.mark), 2) AS average_mark
                FROM students AS s
                JOIN groups AS g ON g.id = s.group_id
                LEFT JOIN grades AS gr ON gr.student_id = s.id
                WHERE s.group_id = ?
                GROUP BY s.id, s.name, s.group_id, g.name, s.email
                ORDER BY s.name, s.id
                """)
                .param(groupId)
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

    public List<GradeDto> findGradesByGroupId(Long groupId) {
        return jdbcClient.sql("""
                SELECT gr.id, gr.student_id, gr.subject_id, gr.mark
                FROM grades AS gr
                JOIN students AS s ON s.id = gr.student_id
                WHERE s.group_id = ?
                ORDER BY gr.id
                """)
                .param(groupId)
                .query((rs, rowNum) -> new GradeDto(
                        rs.getLong("id"),
                        rs.getLong("student_id"),
                        rs.getLong("subject_id"),
                        rs.getInt("mark")
                ))
                .list();
    }

    public Optional<GradeDto> findGrade(Long studentId, Long subjectId) {
        return jdbcClient.sql("""
                SELECT id, student_id, subject_id, mark
                FROM grades
                WHERE student_id = ? AND subject_id = ?
                """)
                .param(studentId)
                .param(subjectId)
                .query((rs, rowNum) -> new GradeDto(
                        rs.getLong("id"),
                        rs.getLong("student_id"),
                        rs.getLong("subject_id"),
                        rs.getInt("mark")
                ))
                .optional();
    }

    public Long insertGrade(Long studentId, Long subjectId, int mark) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("INSERT INTO grades (student_id, subject_id, mark) VALUES (?, ?, ?)")
                .param(studentId)
                .param(subjectId)
                .param(mark)
                .update(keyHolder, "id");
        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    public void updateGrade(Long id, int mark) {
        jdbcClient.sql("UPDATE grades SET mark = ? WHERE id = ?")
                .param(mark)
                .param(id)
                .update();
    }

    public void deleteGrade(Long studentId, Long subjectId) {
        jdbcClient.sql("DELETE FROM grades WHERE student_id = ? AND subject_id = ?")
                .param(studentId)
                .param(subjectId)
                .update();
    }
}
