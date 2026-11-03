package ru.edu.journal.features.subjects;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import ru.edu.journal.features.subjects.dto.SubjectDto;

import java.util.List;
import java.util.Optional;

@Repository
public class SubjectRepository {

    private final JdbcClient jdbcClient;

    public SubjectRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<SubjectDto> findAll() {
        return jdbcClient.sql("SELECT id, name FROM subjects ORDER BY name, id")
                .query((rs, rowNum) -> new SubjectDto(
                        rs.getLong("id"),
                        rs.getString("name")
                ))
                .list();
    }

    public Optional<SubjectDto> findById(Long id) {
        return jdbcClient.sql("SELECT id, name FROM subjects WHERE id = ?")
                .param(id)
                .query((rs, rowNum) -> new SubjectDto(
                        rs.getLong("id"),
                        rs.getString("name")
                ))
                .optional();
    }

    public Long insert(String name) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("INSERT INTO subjects (name) VALUES (?)")
                .param(name)
                .update(keyHolder, "id");
        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    public void update(Long id, String name) {
        jdbcClient.sql("UPDATE subjects SET name = ? WHERE id = ?")
                .param(name)
                .param(id)
                .update();
    }

    public void delete(Long id) {
        jdbcClient.sql("DELETE FROM subjects WHERE id = ?")
                .param(id)
                .update();
    }

    public long countGrades(Long subjectId) {
        return jdbcClient.sql("SELECT COUNT(*) FROM grades WHERE subject_id = ?")
                .param(subjectId)
                .query(Long.class)
                .single();
    }
}
