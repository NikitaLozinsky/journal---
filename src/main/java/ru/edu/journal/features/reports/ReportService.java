package ru.edu.journal.features.reports;

import org.springframework.stereotype.Service;
import ru.edu.journal.common.exception.ValidationException;

import java.util.List;
import java.util.Map;

@Service
public class ReportService {

    private final ReportRepository reportRepository;

    public ReportService(ReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    public Map<String, Object> getReport(String kind) {
        if (kind == null) {
            throw new ValidationException("Не указан вид отчёта.");
        }

        List<Map<String, Object>> items;
        switch (kind) {
            case "groups" -> items = reportRepository.groupReport();
            case "no_grades" -> items = reportRepository.noGradesReport();
            case "failing" -> items = reportRepository.failingReport();
            default -> throw new ValidationException("Неизвестный вид отчёта: " + kind);
        }

        return Map.of("kind", kind, "items", items);
    }
}
