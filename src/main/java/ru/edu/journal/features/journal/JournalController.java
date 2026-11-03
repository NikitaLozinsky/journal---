package ru.edu.journal.features.journal;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriUtils;
import ru.edu.journal.features.journal.dto.GradeDto;
import ru.edu.journal.features.journal.dto.GradeSaveRequest;
import ru.edu.journal.features.journal.dto.JournalResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Controller
public class JournalController {

    private final JournalService journalService;
    private final JournalExportService exportService;

    public JournalController(JournalService journalService, JournalExportService exportService) {
        this.journalService = journalService;
        this.exportService = exportService;
    }

    @GetMapping("/journal")
    public String index(Model model) {
        model.addAttribute("activePage", "journal");
        return "journal/index";
    }

    @GetMapping("/api/journal")
    @ResponseBody
    public JournalResponse getJournal(@RequestParam("group_id") Long groupId) {
        return journalService.getJournal(groupId);
    }

    @GetMapping("/api/journal/export/excel")
    public ResponseEntity<byte[]> exportExcel(@RequestParam("group_id") Long groupId) throws IOException {
        JournalResponse journal = journalService.getJournal(groupId);
        byte[] bytes = exportService.exportToExcel(journal);
        String filename = "journal_" + journal.group().name() + ".xlsx";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + UriUtils.encode(filename, StandardCharsets.UTF_8))
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }

    @GetMapping("/api/journal/export/csv")
    public ResponseEntity<byte[]> exportCsv(@RequestParam("group_id") Long groupId) {
        JournalResponse journal = journalService.getJournal(groupId);
        byte[] bytes = exportService.exportToCsv(journal);
        String filename = "journal_" + journal.group().name() + ".csv";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + UriUtils.encode(filename, StandardCharsets.UTF_8))
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    @PostMapping("/api/journal/grades")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveGrade(@RequestBody(required = false) GradeSaveRequest request) {
        GradeDto item = journalService.saveGrade(request);
        return ResponseEntity.ok(Map.of("item", item));
    }

    @DeleteMapping("/api/journal/grades/{studentId}/{subjectId}")
    @ResponseBody
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGrade(@PathVariable Long studentId, @PathVariable Long subjectId) {
        journalService.deleteGrade(studentId, subjectId);
    }
}
