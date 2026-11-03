package ru.edu.journal.features.groups;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import ru.edu.journal.features.groups.dto.GroupDto;
import ru.edu.journal.features.groups.dto.GroupSaveRequest;

import java.util.Map;

@Controller
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping("/groups")
    public String index(Model model) {
        model.addAttribute("activePage", "groups");
        return "groups/index";
    }

    @GetMapping("/api/groups")
    @ResponseBody
    public Map<String, Object> listGroups() {
        return Map.of("items", groupService.listGroups());
    }

    @PostMapping("/api/groups")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> createGroup(@RequestBody(required = false) GroupSaveRequest request) {
        String name = request != null ? request.name() : null;
        GroupDto item = groupService.saveGroup(name, null);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("item", item));
    }

    @PostMapping("/api/groups/{id}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateGroup(@PathVariable Long id,
                                                           @RequestBody(required = false) GroupSaveRequest request) {
        String name = request != null ? request.name() : null;
        GroupDto item = groupService.saveGroup(name, id);
        return ResponseEntity.ok(Map.of("item", item));
    }

    @DeleteMapping("/api/groups/{id}")
    @ResponseBody
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGroup(@PathVariable Long id) {
        groupService.deleteGroup(id);
    }
}
