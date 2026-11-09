package ru.edu.journal.features.journal.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record GradeSaveRequest(
        @NotNull(message = "Некорректный идентификатор студента.")
        @Min(value = 1, message = "Некорректный идентификатор студента.")
        Long student_id,

        @NotNull(message = "Некорректный идентификатор предмета.")
        @Min(value = 1, message = "Некорректный идентификатор предмета.")
        Long subject_id,

        @NotNull(message = "Оценка должна быть от 2 до 5.")
        @Min(value = 2, message = "Оценка должна быть от 2 до 5.")
        @Max(value = 5, message = "Оценка должна быть от 2 до 5.")
        Integer mark
) {
}
