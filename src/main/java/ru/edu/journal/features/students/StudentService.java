package ru.edu.journal.features.students;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.edu.journal.common.exception.NotFoundException;
import ru.edu.journal.common.exception.ValidationException;
import ru.edu.journal.features.groups.GroupRepository;
import ru.edu.journal.features.students.dto.StudentDto;
import ru.edu.journal.features.students.dto.StudentSaveRequest;

import java.util.List;

@Service
public class StudentService {

    private final StudentRepository studentRepository;
    private final GroupRepository groupRepository;

    public StudentService(StudentRepository studentRepository, GroupRepository groupRepository) {
        this.studentRepository = studentRepository;
        this.groupRepository = groupRepository;
    }

    public List<StudentDto> listStudents(Long groupId, String query) {
        return studentRepository.findAll(groupId, query);
    }

    @Transactional
    public StudentDto saveStudent(StudentSaveRequest request, Long id) {
        if (request == null) {
            throw new ValidationException("Ожидается JSON-объект.");
        }

        String name = request.name();
        if (name == null || name.strip().isEmpty()) {
            throw new ValidationException("Введите имя.");
        }
        name = name.strip();
        if (name.length() > 50) {
            throw new ValidationException("Допускается не более 50 символов.");
        }

        Long groupId = request.group_id();
        if (groupId == null || groupRepository.findById(groupId).isEmpty()) {
            throw new ValidationException("Выберите существующую группу.");
        }

        String email = request.email();
        if (email != null) {
            email = email.strip();
            if (email.isEmpty()) {
                email = null;
            }
        }

        if (id != null && studentRepository.findById(id).isEmpty()) {
            throw new NotFoundException("Студент не найден.");
        }

        if (id == null) {
            id = studentRepository.insert(name, groupId, email);
        } else {
            studentRepository.update(id, name, groupId, email);
        }

        return studentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Студент не найден."));
    }

    @Transactional
    public void deleteStudent(Long id, boolean simulateError) {
        if (studentRepository.findById(id).isEmpty()) {
            throw new NotFoundException("Студент не найден.");
        }

        studentRepository.deleteGrades(id);

        if (simulateError) {
            throw new RuntimeException("Учебная ошибка после удаления оценок.");
        }

        studentRepository.delete(id);
    }
}
