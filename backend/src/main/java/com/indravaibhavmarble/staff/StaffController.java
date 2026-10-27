package com.indravaibhavmarble.staff;

import com.indravaibhavmarble.common.exception.ResourceNotFoundException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/staff")
public class StaffController {

    public record StaffRequest(String name, String phone, String jobTitle, Boolean active) {
    }

    private final StaffMemberRepository repository;

    public StaffController(StaffMemberRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<StaffMember> list() {
        return repository.findAllByOrderByActiveDescNameAsc();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public StaffMember create(@RequestBody StaffRequest request) {
        StaffMember staff = new StaffMember();
        apply(staff, request);
        return repository.save(staff);
    }

    @PutMapping("/{id}")
    @Transactional
    public StaffMember update(@PathVariable Long id, @RequestBody StaffRequest request) {
        StaffMember staff = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Staff member not found: " + id));
        apply(staff, request);
        return repository.save(staff);
    }

    private void apply(StaffMember staff, StaffRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("Staff name is required");
        }
        String name = request.name().trim();
        if (name.length() > 120) {
            throw new IllegalArgumentException("Staff name cannot exceed 120 characters");
        }
        repository.findByNameIgnoreCase(name)
                .filter(other -> !other.getId().equals(staff.getId()))
                .ifPresent(other -> {
                    throw new IllegalArgumentException("A staff member with this name already exists");
                });
        String phone = blankToNull(request.phone());
        if (phone != null && phone.length() > 20) {
            throw new IllegalArgumentException("Phone cannot exceed 20 characters");
        }
        String jobTitle = blankToNull(request.jobTitle());
        if (jobTitle != null && jobTitle.length() > 80) {
            throw new IllegalArgumentException("Job title cannot exceed 80 characters");
        }
        staff.setName(name);
        staff.setPhone(phone);
        staff.setJobTitle(jobTitle);
        if (request.active() != null) {
            staff.setActive(request.active());
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
