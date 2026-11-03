package ru.edu.journal.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseInitializer.class);

    private final DataSource dataSource;

    @Value("${app.db.auto-init:true}")
    private boolean autoInit;

    public DatabaseInitializer(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(String... args) throws Exception {
        if (!autoInit) {
            return;
        }

        try (Connection con = dataSource.getConnection()) {
            boolean needsInit = false;
            try (Statement stmt = con.createStatement()) {
                ResultSet rs = stmt.executeQuery(
                        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='groups'"
                );
                if (!rs.next() || rs.getInt(1) == 0) {
                    needsInit = true;
                } else {
                    ResultSet countRs = stmt.executeQuery("SELECT COUNT(*) FROM groups");
                    if (countRs.next() && countRs.getInt(1) == 0) {
                        needsInit = true;
                    }
                }
            }

            if (needsInit) {
                log.info("Database is empty or missing. Initializing database schema and seed data...");
                initializeDatabase();
            }
        }
    }

    public Map<String, Integer> initializeDatabase() {
        try (Connection con = dataSource.getConnection()) {
            con.setAutoCommit(false);
            try (Statement stmt = con.createStatement()) {
                stmt.execute("PRAGMA foreign_keys = ON");

                ScriptUtils.executeSqlScript(con, new ClassPathResource("db/schema.sql"));
                ScriptUtils.executeSqlScript(con, new ClassPathResource("db/seed.sql"));

                Map<String, Integer> counts = new HashMap<>();
                for (String table : new String[]{"groups", "students", "subjects", "grades"}) {
                    try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + table)) {
                        if (rs.next()) {
                            counts.put(table, rs.getInt(1));
                        }
                    }
                }

                // Verify baseline counts
                if (!Integer.valueOf(3).equals(counts.get("groups")) ||
                    !Integer.valueOf(60).equals(counts.get("students")) ||
                    !Integer.valueOf(3).equals(counts.get("subjects")) ||
                    !Integer.valueOf(162).equals(counts.get("grades"))) {
                    throw new IllegalStateException("Нарушено исходное количество записей: " + counts);
                }

                try (ResultSet fkRs = stmt.executeQuery("PRAGMA foreign_key_check")) {
                    if (fkRs.next()) {
                        throw new IllegalStateException("Обнаружены нарушенные внешние ключи.");
                    }
                }

                con.commit();
                log.info("Database initialized successfully: {}", counts);
                return counts;
            } catch (Exception e) {
                con.rollback();
                throw e;
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize database: " + e.getMessage(), e);
        }
    }
}
