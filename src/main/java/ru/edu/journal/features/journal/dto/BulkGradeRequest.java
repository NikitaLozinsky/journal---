package ru.edu.journal.features.journal.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record BulkGradeRequest(
        Long group_id,

        Long subject_id,

        @NotNull(message = "Оценка должна быть от 2 до 5 (или 0 для удаления).")
        @Min(value = 0, message = "Оценка должна быть от 2 до 5 (или 0 для удаления).")
        @Max(value = 5, message = "Оценка должна быть от 2 до 5 (или 0 для удаления).")
        Integer mark,

        Boolean overwrite_existing
) {
}
