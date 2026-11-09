package ru.edu.journal;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import ru.edu.journal.common.DatabaseInitializer;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class JournalIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DatabaseInitializer databaseInitializer;

    @BeforeEach
    void setUp() {
        databaseInitializer.initializeDatabase();
    }

    // --- ЛАБ 1: ГРУППЫ ---
    @Test
    void testGroupsApi() throws Exception {
        // Список
        mockMvc.perform(get("/api/groups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].name", is("БЭИ2301")))
                .andExpect(jsonPath("$.items[0].student_count", is(20)));

        // Создание группы
        mockMvc.perform(post("/api/groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Учебная группа"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.item.name", is("Учебная группа")));

        // Ошибка дубликата
        mockMvc.perform(post("/api/groups")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Учебная группа"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("уже существует")));

        // Запрет удаления непустой группы
        mockMvc.perform(delete("/api/groups/1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("есть студенты")));
    }

    // --- ЛАБ 2: ПРЕДМЕТЫ ---
    @Test
    void testSubjectsApi() throws Exception {
        // Список
        mockMvc.perform(get("/api/subjects"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(3)));

        // Создание
        mockMvc.perform(post("/api/subjects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Алгоритмы"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.item.name", is("Алгоритмы")));

        // Запрет удаления предмета с оценками
        mockMvc.perform(delete("/api/subjects/1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("выставлены оценки")));
    }

    // --- ЛАБ 3: СТУДЕНТЫ И ПЕРЕВОД ---
    @Test
    void testStudentsApiAndTransfer() throws Exception {
        // Список
        mockMvc.perform(get("/api/students"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(60)));

        // Создание студента
        mockMvc.perform(post("/api/students")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Тестовый Студент",
                                "group_id", 1,
                                "email", "test@edu.ru"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.item.name", is("Тестовый Студент")))
                .andExpect(jsonPath("$.item.group_name", is("БЭИ2301")));

        // Перевод студента ID 1 в группу 2 (сохраняет оценки и меняет группу)
        mockMvc.perform(post("/api/students/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "name", "Иванов Алексей",
                                "group_id", 2,
                                "email", "student01@example.edu"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.group_id", is(2)))
                .andExpect(jsonPath("$.item.group_name", is("БЭИ2302")))
                .andExpect(jsonPath("$.item.grade_count", greaterThan(0)));
    }

    @Test
    void testStudentsSearchAndAverageMark() throws Exception {
        // Поиск по подстроке имени
        mockMvc.perform(get("/api/students?q=Иванов"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", not(empty())))
                .andExpect(jsonPath("$.items[0].name", containsString("Иванов")));

        // Проверка наличия поля average_mark у студентов
        mockMvc.perform(get("/api/students"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].average_mark", notNullValue()));
    }

    // --- ЛАБ 4: ЖУРНАЛ ОЦЕНОК ---
    @Test
    void testJournalApi() throws Exception {
        // Чтение журнала всех групп (без group_id)
        mockMvc.perform(get("/api/journal"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group.name", is("Все группы")))
                .andExpect(jsonPath("$.students", hasSize(60)))
                .andExpect(jsonPath("$.subjects", hasSize(3)))
                .andExpect(jsonPath("$.grades", hasSize(162)));

        // Чтение журнала группы 1
        mockMvc.perform(get("/api/journal?group_id=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group.name", is("БЭИ2301")))
                .andExpect(jsonPath("$.students", hasSize(20)))
                .andExpect(jsonPath("$.subjects", hasSize(3)))
                .andExpect(jsonPath("$.grades", hasSize(54)));

        // У студента 10 изначально нет оценок
        // Ставим оценку 4 по предмету 1
        mockMvc.perform(post("/api/journal/grades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "student_id", 10,
                                "subject_id", 1,
                                "mark", 4
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.mark", is(4)));

        // Обновляем оценку на 5
        mockMvc.perform(post("/api/journal/grades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "student_id", 10,
                                "subject_id", 1,
                                "mark", 5
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.mark", is(5)));

        // Удаляем оценку
        mockMvc.perform(delete("/api/journal/grades/10/1"))
                .andExpect(status().isNoContent());

        // Невалидная оценка (например, 6)
        mockMvc.perform(post("/api/journal/grades")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "student_id", 10,
                                "subject_id", 1,
                                "mark", 6
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("от 2 до 5")));
    }

    // --- МАССОВОЕ ВЫСТАВЛЕНИЕ ОЦЕНОК (BULK GRADING) ---
    @Test
    void testBulkGradesApi() throws Exception {
        // Выставляем 5 всей группе 1 по предмету 1 с перезаписью
        mockMvc.perform(post("/api/journal/grades/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "group_id", 1,
                                "subject_id", 1,
                                "mark", 5,
                                "overwrite_existing", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.count", is(20)));

        // Очищаем оценки всей группе 1 по предмету 1 (mark = 0)
        mockMvc.perform(post("/api/journal/grades/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "group_id", 1,
                                "subject_id", 1,
                                "mark", 0
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count", is(20)));

        // Выставляем 4 ВСЕМ студентам ВСЕХ групп по ВСЕМ предметам (60 студентов * 3 предмета = 180 записей)
        mockMvc.perform(post("/api/journal/grades/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "mark", 4,
                                "overwrite_existing", true
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.count", is(180)));

        // Невалидный запрос (mark = 9)
        mockMvc.perform(post("/api/journal/grades/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "group_id", 1,
                                "subject_id", 1,
                                "mark", 9
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", containsString("от 2 до 5")));
    }

    // --- ЭКСПОРТ ЖУРНАЛА (EXCEL & CSV) ---
    @Test
    void testJournalExportExcelAndCsv() throws Exception {
        // Экспорт в Excel (.xlsx)
        byte[] excelBytes = mockMvc.perform(get("/api/journal/export/excel?group_id=1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")))
                .andExpect(header().string("Content-Disposition", containsString("journal_БЭИ2301.xlsx")))
                .andReturn()
                .getResponse()
                .getContentAsByteArray();

        org.junit.jupiter.api.Assertions.assertTrue(excelBytes.length > 1000, "Excel file should not be empty");

        // Экспорт в CSV (.csv)
        String csvContent = mockMvc.perform(get("/api/journal/export/csv?group_id=1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("text/csv")))
                .andExpect(header().string("Content-Disposition", containsString("journal_БЭИ2301.csv")))
                .andReturn()
                .getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        org.junit.jupiter.api.Assertions.assertTrue(csvContent.contains("ФИО;Email;Группа"), "CSV must contain header");
        org.junit.jupiter.api.Assertions.assertTrue(csvContent.contains("БЭИ2301"), "CSV must contain group name");

        // Экспорт всех групп в Excel (.xlsx) без group_id
        mockMvc.perform(get("/api/journal/export/excel"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("journal_Все_группы.xlsx")));

        // Экспорт всех групп в CSV (.csv) без group_id
        mockMvc.perform(get("/api/journal/export/csv"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("journal_Все_группы.csv")));

        // Журнал без group_id (сводная ведомость всех групп)
        mockMvc.perform(get("/api/journal"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.group.name", is("Все группы")))
                .andExpect(jsonPath("$.students", hasSize(60)));
    }

    // --- ЛАБ 5: ОТЧЕТЫ ---
    @Test
    void testReportsApi() throws Exception {
        // 1. Отчет групп
        mockMvc.perform(get("/api/reports?kind=groups"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind", is("groups")))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].student_count", is(20)))
                .andExpect(jsonPath("$.items[0].grade_count", is(54)))
                .andExpect(jsonPath("$.items[0].average_mark", notNullValue()));

        // 2. Отчет студентов без оценок (ровно 6 человек в исходных данных)
        mockMvc.perform(get("/api/reports?kind=no_grades"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind", is("no_grades")))
                .andExpect(jsonPath("$.items", hasSize(6)));

        // 3. Отчет студентов с хотя бы одной двойкой
        mockMvc.perform(get("/api/reports?kind=failing"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind", is("failing")))
                .andExpect(jsonPath("$.items", not(empty())));
    }
}
