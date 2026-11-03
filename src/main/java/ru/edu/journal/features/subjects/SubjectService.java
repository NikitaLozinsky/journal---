package ru.edu.journal.features.subjects;

import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.edu.journal.common.exception.NotFoundException;
import ru.edu.journal.common.exception.ValidationException;
import ru.edu.journal.features.subjects.dto.SubjectDto;

import java.util.List;

@Service
public class SubjectService {

    private final SubjectRepository subjectRepository;

    public SubjectService(SubjectRepository subjectRepository) {
        this.subjectRepository = subjectRepository;
    }

    public List<SubjectDto> listSubjects() {
        return subjectRepository.findAll();
    }

    @Transactional
    public SubjectDto saveSubject(String name, Long id) {
        if (name == null || name.strip().isEmpty()) {
            throw new ValidationException("Введите название.");
        }
        name = name.strip();

        if (id != null && subjectRepository.findById(id).isEmpty()) {
            throw new NotFoundException("Предмет не найден.");
        }

        try {
            if (id == null) {
                id = subjectRepository.insert(name);
            } else {
                subjectRepository.update(id, name);
            }
            return subjectRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Предмет не найден."));
        } catch (DataAccessException ex) {
            throw new ValidationException("Такое название уже существует.");
        }
    }

    @Transactional
    public void deleteSubject(Long id) {
        if (subjectRepository.findById(id).isEmpty()) {
            throw new NotFoundException("Предмет не найден.");
        }
        if (subjectRepository.countGrades(id) > 0) {
            throw new ValidationException("По предмету выставлены оценки. Сначала удалите их.");
        }
        try {
            subjectRepository.delete(id);
        } catch (DataAccessException ex) {
            throw new ValidationException("По предмету выставлены оценки. Сначала удалите их.");
        }
    }
}
