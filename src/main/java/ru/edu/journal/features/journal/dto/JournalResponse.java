package ru.edu.journal.features.journal.dto;

import ru.edu.journal.features.groups.dto.GroupDto;
import ru.edu.journal.features.students.dto.StudentDto;
import ru.edu.journal.features.subjects.dto.SubjectDto;

import java.util.List;

public record JournalResponse(
        GroupDto group,
        List<StudentDto> students,
        List<SubjectDto> subjects,
        List<GradeDto> grades
) {
}
