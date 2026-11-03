package ru.edu.journal.features.reports;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
public class ReportRepository {

    private final JdbcClient jdbcClient;

    public ReportRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<Map<String, Object>> groupReport() {
        String sql = """
                SELECT
                    g.id,
                    g.name,
                    COUNT(DISTINCT s.id) AS student_count,
                    COUNT(gr.id) AS grade_count,
                    ROUND(AVG(gr.mark), 2) AS average_mark
                FROM groups AS g
                LEFT JOIN students AS s ON s.group_id = g.id
                LEFT JOIN grades AS gr ON gr.student_id = s.id
                GROUP BY g.id, g.name
                ORDER BY g.name, g.id
                """;

        return jdbcClient.sql(sql)
                .query((rs, rowNum) -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getLong("id"));
                    map.put("name", rs.getString("name"));
                    map.put("student_count", rs.getLong("student_count"));
                    map.put("grade_count", rs.getLong("grade_count"));
                    Object avg = rs.getObject("average_mark");
                    map.put("average_mark", avg != null ? rs.getDouble("average_mark") : null);
                    return map;
                })
                .list();
    }

    public List<Map<String, Object>> noGradesReport() {
        String sql = """
                SELECT
                    s.id,
                    s.name,
                    g.name AS group_name
                FROM students AS s
                JOIN groups AS g ON g.id = s.group_id
                LEFT JOIN grades AS gr ON gr.student_id = s.id
                GROUP BY s.id, s.name, g.name
                HAVING COUNT(gr.id) = 0
                ORDER BY s.name, s.id
                """;

        return jdbcClient.sql(sql)
                .query((rs, rowNum) -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getLong("id"));
                    map.put("name", rs.getString("name"));
                    map.put("group_name", rs.getString("group_name"));
                    return map;
                })
                .list();
    }

    public List<Map<String, Object>> failingReport() {
        String sql = """
                SELECT
                    s.id,
                    s.name,
                    g.name AS group_name
                FROM students AS s
                JOIN groups AS g ON g.id = s.group_id
                JOIN grades AS gr ON gr.student_id = s.id
                GROUP BY s.id, s.name, g.name
                HAVING MIN(gr.mark) = 2
                ORDER BY s.name, s.id
                """;

        return jdbcClient.sql(sql)
                .query((rs, rowNum) -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", rs.getLong("id"));
                    map.put("name", rs.getString("name"));
                    map.put("group_name", rs.getString("group_name"));
                    return map;
                })
                .list();
    }
}
