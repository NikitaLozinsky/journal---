package ru.edu.journal.features.subjects.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubjectSaveRequest(
        @NotBlank(message = "Введите название.")
        @Size(max = 100, message = "Допускается не более 100 символов.")
        String name
) {
}
