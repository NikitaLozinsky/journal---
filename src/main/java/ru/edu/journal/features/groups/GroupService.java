package ru.edu.journal.features.groups;

import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.edu.journal.common.exception.NotFoundException;
import ru.edu.journal.common.exception.ValidationException;
import ru.edu.journal.features.groups.dto.GroupDto;

import java.util.List;

@Service
public class GroupService {

    private final GroupRepository groupRepository;

    public GroupService(GroupRepository groupRepository) {
        this.groupRepository = groupRepository;
    }

    public List<GroupDto> listGroups() {
        return groupRepository.findAllWithStudentCount();
    }

    @Transactional
    public GroupDto saveGroup(String name, Long id) {
        if (name == null || name.strip().isEmpty()) {
            throw new ValidationException("Введите название.");
        }
        name = name.strip();
        if (name.length() > 50) {
            throw new ValidationException("Допускается не более 50 символов.");
        }

        if (id != null && groupRepository.findById(id).isEmpty()) {
            throw new NotFoundException("Группа не найдена.");
        }

        try {
            if (id == null) {
                id = groupRepository.insert(name);
            } else {
                groupRepository.update(id, name);
            }
            return groupRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Группа не найдена."));
        } catch (DataAccessException ex) {
            throw new ValidationException("Такое название уже существует.");
        }
    }

    @Transactional
    public void deleteGroup(Long id) {
        if (groupRepository.findById(id).isEmpty()) {
            throw new NotFoundException("Группа не найдена.");
        }
        if (groupRepository.countStudents(id) > 0) {
            throw new ValidationException("В группе есть студенты. Сначала переведите или удалите их.");
        }
        try {
            groupRepository.delete(id);
        } catch (DataAccessException ex) {
            throw new ValidationException("В группе есть студенты. Сначала переведите или удалите их.");
        }
    }
}
