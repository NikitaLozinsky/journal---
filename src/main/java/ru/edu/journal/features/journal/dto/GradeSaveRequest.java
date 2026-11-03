package ru.edu.journal.features.journal.dto;

public record GradeSaveRequest(Long student_id, Long subject_id, Integer mark) {
}
