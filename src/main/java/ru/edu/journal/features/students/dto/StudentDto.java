package ru.edu.journal.features.students.dto;

public record StudentDto(
        Long id,
        String name,
        Long group_id,
        String group_name,
        String email,
        Long grade_count,
        Double average_mark
) {
    public StudentDto(Long id, String name, Long group_id, String group_name, String email, Long grade_count) {
        this(id, name, group_id, group_name, email, grade_count, null);
    }
}
