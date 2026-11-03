package ru.edu.journal.features.journal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.edu.journal.common.exception.NotFoundException;
import ru.edu.journal.common.exception.ValidationException;
import ru.edu.journal.features.groups.GroupRepository;
import ru.edu.journal.features.groups.dto.GroupDto;
import ru.edu.journal.features.journal.dto.GradeDto;
import ru.edu.journal.features.journal.dto.GradeSaveRequest;
import ru.edu.journal.features.journal.dto.JournalResponse;
import ru.edu.journal.features.students.StudentRepository;
import ru.edu.journal.features.students.dto.StudentDto;
import ru.edu.journal.features.subjects.SubjectRepository;
import ru.edu.journal.features.subjects.dto.SubjectDto;

import java.util.List;
import java.util.Optional;

@Service
public class JournalService {

    private final JournalRepository journalRepository;
    private final GroupRepository groupRepository;
    private final StudentRepository studentRepository;
    private final SubjectRepository subjectRepository;

    public JournalService(JournalRepository journalRepository,
                          GroupRepository groupRepository,
                          StudentRepository studentRepository,
                          SubjectRepository subjectRepository) {
        this.journalRepository = journalRepository;
        this.groupRepository = groupRepository;
        this.studentRepository = studentRepository;
        this.subjectRepository = subjectRepository;
    }

    public JournalResponse getJournal(Long groupId) {
        if (groupId == null || groupId <= 0) {
            throw new ValidationException("Некорректный идентификатор группы.");
        }

        GroupDto group = groupRepository.findById(groupId)
                .orElseThrow(() -> new NotFoundException("Группа не найдена."));

        List<StudentDto> students = journalRepository.findStudentsByGroupId(groupId);
        List<SubjectDto> subjects = subjectRepository.findAll();
        List<GradeDto> grades = journalRepository.findGradesByGroupId(groupId);

        return new JournalResponse(group, students, subjects, grades);
    }

    @Transactional
    public GradeDto saveGrade(GradeSaveRequest request) {
        if (request == null) {
            throw new ValidationException("Ожидается JSON-объект.");
        }

        Long studentId = request.student_id();
        Long subjectId = request.subject_id();
        Integer mark = request.mark();

        if (studentId == null || studentId <= 0) {
            throw new ValidationException("Некорректный идентификатор студента.");
        }
        if (subjectId == null || subjectId <= 0) {
            throw new ValidationException("Некорректный идентификатор предмета.");
        }
        if (mark == null || mark < 2 || mark > 5) {
            throw new ValidationException("Оценка должна быть от 2 до 5.");
        }

        if (studentRepository.findById(studentId).isEmpty()) {
            throw new NotFoundException("Студент не найден.");
        }
        if (subjectRepository.findById(subjectId).isEmpty()) {
            throw new NotFoundException("Предмет не найден.");
        }

        Optional<GradeDto> existing = journalRepository.findGrade(studentId, subjectId);
        if (existing.isPresent()) {
            journalRepository.updateGrade(existing.get().id(), mark);
        } else {
            journalRepository.insertGrade(studentId, subjectId, mark);
        }

        return journalRepository.findGrade(studentId, subjectId)
                .orElseThrow(() -> new NotFoundException("Оценка не найдена после сохранения."));
    }

    @Transactional
    public void deleteGrade(Long studentId, Long subjectId) {
        if (studentId == null || studentId <= 0 || subjectId == null || subjectId <= 0) {
            throw new ValidationException("Некорректные параметры запроса.");
        }

        if (studentRepository.findById(studentId).isEmpty()) {
            throw new NotFoundException("Студент не найден.");
        }
        if (subjectRepository.findById(subjectId).isEmpty()) {
            throw new NotFoundException("Предмет не найден.");
        }

        journalRepository.deleteGrade(studentId, subjectId);
    }
}
