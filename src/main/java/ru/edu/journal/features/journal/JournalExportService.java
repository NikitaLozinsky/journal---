package ru.edu.journal.features.journal;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import ru.edu.journal.features.journal.dto.GradeDto;
import ru.edu.journal.features.journal.dto.JournalResponse;
import ru.edu.journal.features.students.dto.StudentDto;
import ru.edu.journal.features.subjects.dto.SubjectDto;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class JournalExportService {

    /**
     * Генерирует стилизованный файл Excel (.xlsx) с ведомостью оценок группы.
     */
    public byte[] exportToExcel(JournalResponse data) throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Ведомость " + data.group().name());
            sheet.setDisplayGridlines(true);

            // Шрифты и стили
            Font titleFont = workbook.createFont();
            titleFont.setFontName("Arial");
            titleFont.setFontHeightInPoints((short) 14);
            titleFont.setBold(true);

            CellStyle titleStyle = workbook.createCellStyle();
            titleStyle.setFont(titleFont);

            Font subFont = workbook.createFont();
            subFont.setFontName("Arial");
            subFont.setFontHeightInPoints((short) 10);
            subFont.setItalic(true);

            CellStyle subStyle = workbook.createCellStyle();
            subStyle.setFont(subFont);

            Font headerFont = workbook.createFont();
            headerFont.setFontName("Arial");
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setBold(true);
            headerFont.setColor(IndexedColors.WHITE.getIndex());

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setVerticalAlignment(VerticalAlignment.CENTER);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setBorderTop(BorderStyle.THIN);
            textStyle.setBorderBottom(BorderStyle.THIN);
            textStyle.setBorderLeft(BorderStyle.THIN);
            textStyle.setBorderRight(BorderStyle.THIN);

            CellStyle centerStyle = workbook.createCellStyle();
            centerStyle.cloneStyleFrom(textStyle);
            centerStyle.setAlignment(HorizontalAlignment.CENTER);

            CellStyle numberStyle = workbook.createCellStyle();
            numberStyle.cloneStyleFrom(textStyle);
            numberStyle.setAlignment(HorizontalAlignment.RIGHT);

            CellStyle failingStyle = workbook.createCellStyle();
            failingStyle.cloneStyleFrom(centerStyle);
            failingStyle.setFillForegroundColor(IndexedColors.ROSE.getIndex());
            failingStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            Font failingFont = workbook.createFont();
            failingFont.setColor(IndexedColors.DARK_RED.getIndex());
            failingFont.setBold(true);
            failingStyle.setFont(failingFont);

            // 1. Заголовок
            Row titleRow = sheet.createRow(0);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("ЭЛЕКТРОННЫЙ ЖУРНАЛ УСПЕВАЕМОСТИ");
            titleCell.setCellStyle(titleStyle);

            Row infoRow = sheet.createRow(1);
            Cell infoCell = infoRow.createCell(0);
            String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy"));
            infoCell.setCellValue("Учебная группа: " + data.group().name() + " | Дата выгрузки: " + dateStr);
            infoCell.setCellStyle(subStyle);

            // 2. Шапка таблицы (Row 3)
            int headerRowNum = 3;
            Row headerRow = sheet.createRow(headerRowNum);
            headerRow.setHeightInPoints(26);

            int colIdx = 0;
            Cell c = headerRow.createCell(colIdx++);
            c.setCellValue("№");
            c.setCellStyle(headerStyle);

            c = headerRow.createCell(colIdx++);
            c.setCellValue("ФИО Студента");
            c.setCellStyle(headerStyle);

            c = headerRow.createCell(colIdx++);
            c.setCellValue("Email");
            c.setCellStyle(headerStyle);

            for (SubjectDto subject : data.subjects()) {
                c = headerRow.createCell(colIdx++);
                c.setCellValue(subject.name());
                c.setCellStyle(headerStyle);
            }

            c = headerRow.createCell(colIdx++);
            c.setCellValue("Оценок");
            c.setCellStyle(headerStyle);

            c = headerRow.createCell(colIdx++);
            c.setCellValue("Средний балл");
            c.setCellStyle(headerStyle);

            c = headerRow.createCell(colIdx++);
            c.setCellValue("Академический статус");
            c.setCellStyle(headerStyle);

            // 3. Данные студентов
            Map<String, GradeDto> gradeMap = new HashMap<>();
            for (GradeDto g : data.grades()) {
                gradeMap.put(g.student_id() + ":" + g.subject_id(), g);
            }

            int rowNum = 4;
            int studentNum = 1;

            for (StudentDto student : data.students()) {
                Row row = sheet.createRow(rowNum++);
                colIdx = 0;

                // №
                c = row.createCell(colIdx++);
                c.setCellValue(studentNum++);
                c.setCellStyle(centerStyle);

                // ФИО
                c = row.createCell(colIdx++);
                c.setCellValue(student.name());
                c.setCellStyle(textStyle);

                // Email
                c = row.createCell(colIdx++);
                c.setCellValue(student.email() != null ? student.email() : "—");
                c.setCellStyle(textStyle);

                // Оценки по предметам
                int marksCount = 0;
                int sumMarks = 0;
                boolean hasTwo = false;
                boolean allFive = true;
                boolean onlyFourOrFive = true;

                for (SubjectDto subject : data.subjects()) {
                    c = row.createCell(colIdx++);
                    GradeDto grade = gradeMap.get(student.id() + ":" + subject.id());
                    if (grade != null) {
                        int m = grade.mark();
                        c.setCellValue(m);
                        if (m == 2) {
                            c.setCellStyle(failingStyle);
                            hasTwo = true;
                        } else {
                            c.setCellStyle(centerStyle);
                        }
                        marksCount++;
                        sumMarks += m;
                        if (m < 5) allFive = false;
                        if (m < 4) onlyFourOrFive = false;
                    } else {
                        c.setCellValue("—");
                        c.setCellStyle(centerStyle);
                        allFive = false;
                        onlyFourOrFive = false;
                    }
                }

                // Количество оценок
                c = row.createCell(colIdx++);
                c.setCellValue(marksCount);
                c.setCellStyle(numberStyle);

                // Средний балл
                c = row.createCell(colIdx++);
                if (marksCount > 0) {
                    double avg = Math.round((double) sumMarks / marksCount * 100.0) / 100.0;
                    c.setCellValue(avg);
                } else {
                    c.setCellValue("—");
                }
                c.setCellStyle(numberStyle);

                // Статус
                c = row.createCell(colIdx++);
                String status;
                if (marksCount == 0) {
                    status = "Нет оценок";
                } else if (hasTwo) {
                    status = "Академическая задолженность";
                } else if (allFive && marksCount == data.subjects().size()) {
                    status = "Отличник";
                } else if (onlyFourOrFive && marksCount == data.subjects().size()) {
                    status = "Хорошист";
                } else {
                    status = "Успевает";
                }
                c.setCellValue(status);
                c.setCellStyle(textStyle);
            }

            // Авторазмер колонок
            int totalCols = colIdx;
            for (int i = 0; i < totalCols; i++) {
                sheet.autoSizeColumn(i);
                // Минимальная ширина для эстетичности
                if (sheet.getColumnWidth(i) < 3000) {
                    sheet.setColumnWidth(i, 3500);
                }
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    /**
     * Генерирует CSV с BOM (UTF-8) для совместимости с Excel.
     */
    public byte[] exportToCsv(JournalResponse data) {
        StringBuilder sb = new StringBuilder();
        // UTF-8 BOM
        sb.append('\uFEFF');

        // Шапка
        sb.append("№;ФИО;Email;Группа");
        for (SubjectDto sub : data.subjects()) {
            sb.append(';').append(sub.name());
        }
        sb.append(";Оценок;Средний балл;Статус\n");

        Map<String, GradeDto> gradeMap = new HashMap<>();
        for (GradeDto g : data.grades()) {
            gradeMap.put(g.student_id() + ":" + g.subject_id(), g);
        }

        int idx = 1;
        for (StudentDto s : data.students()) {
            sb.append(idx++).append(';')
              .append('"').append(s.name().replace("\"", "\"\"")).append('"').append(';')
              .append(s.email() != null ? s.email() : "").append(';')
              .append(s.group_name() != null ? s.group_name() : data.group().name());

            int marksCount = 0;
            int sumMarks = 0;
            boolean hasTwo = false;
            boolean allFive = true;
            boolean onlyFourOrFive = true;

            for (SubjectDto sub : data.subjects()) {
                sb.append(';');
                GradeDto g = gradeMap.get(s.id() + ":" + sub.id());
                if (g != null) {
                    sb.append(g.mark());
                    marksCount++;
                    sumMarks += g.mark();
                    if (g.mark() == 2) hasTwo = true;
                    if (g.mark() < 5) allFive = false;
                    if (g.mark() < 4) onlyFourOrFive = false;
                } else {
                    sb.append("—");
                    allFive = false;
                    onlyFourOrFive = false;
                }
            }

            sb.append(';').append(marksCount).append(';');
            if (marksCount > 0) {
                double avg = Math.round((double) sumMarks / marksCount * 100.0) / 100.0;
                sb.append(String.format(Locale.US, "%.2f", avg));
            } else {
                sb.append("—");
            }
            sb.append(';');

            if (marksCount == 0) sb.append("Нет оценок");
            else if (hasTwo) sb.append("Академическая задолженность");
            else if (allFive && marksCount == data.subjects().size()) sb.append("Отличник");
            else if (onlyFourOrFive && marksCount == data.subjects().size()) sb.append("Хорошист");
            else sb.append("Успевает");

            sb.append('\n');
        }

        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }
}
