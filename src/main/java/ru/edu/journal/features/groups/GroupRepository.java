package ru.edu.journal.features.groups;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;
import ru.edu.journal.features.groups.dto.GroupDto;

import java.util.List;
import java.util.Optional;

@Repository
public class GroupRepository {

    private final JdbcClient jdbcClient;

    public GroupRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<GroupDto> findAllWithStudentCount() {
        return jdbcClient.sql("""
                SELECT g.id, g.name, COUNT(s.id) AS student_count
                FROM groups AS g
                LEFT JOIN students AS s ON s.group_id = g.id
                GROUP BY g.id, g.name
                ORDER BY g.name, g.id
                """)
                .query((rs, rowNum) -> new GroupDto(
                        rs.getLong("id"),
                        rs.getString("name"),
                        rs.getLong("student_count")
                ))
                .list();
    }

    public Optional<GroupDto> findById(Long id) {
        return jdbcClient.sql("SELECT id, name FROM groups WHERE id = ?")
                .param(id)
                .query((rs, rowNum) -> new GroupDto(
                        rs.getLong("id"),
                        rs.getString("name"),
                        null
                ))
                .optional();
    }

    public Long insert(String name) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcClient.sql("INSERT INTO groups (name) VALUES (?)")
                .param(name)
                .update(keyHolder, "id");
        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    public void update(Long id, String name) {
        jdbcClient.sql("UPDATE groups SET name = ? WHERE id = ?")
                .param(name)
                .param(id)
                .update();
    }

    public void delete(Long id) {
        jdbcClient.sql("DELETE FROM groups WHERE id = ?")
                .param(id)
                .update();
    }

    public long countStudents(Long groupId) {
        return jdbcClient.sql("SELECT COUNT(*) FROM students WHERE group_id = ?")
                .param(groupId)
                .query(Long.class)
                .single();
    }
}
