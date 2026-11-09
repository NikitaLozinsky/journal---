package ru.edu.journal.features.groups.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GroupSaveRequest(
        @NotBlank(message = "Введите название.")
        @Size(max = 50, message = "Допускается не более 50 символов.")
        String name
) {
}
