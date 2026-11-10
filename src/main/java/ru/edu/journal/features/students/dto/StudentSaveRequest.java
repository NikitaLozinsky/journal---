package ru.edu.journal.features.students.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record StudentSaveRequest(
        @NotBlank(message = "Введите имя.")
        @Size(max = 50, message = "Допускается не более 50 символов.")
        String name,

        @NotNull(message = "Выберите существующую группу.")
        Long group_id,

        @Size(max = 100, message = "Email не должен превышать 100 символов.")
        String email
) {
    public StudentSaveRequest {
        if (name != null) name = name.strip();
        if (email != null) {
            email = email.strip();
            if (email.isEmpty()) email = null;
        }
    }
}
