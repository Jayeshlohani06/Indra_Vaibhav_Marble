package com.indravaibhavmarble.user.controller;

import com.indravaibhavmarble.user.dto.UserRequest;
import com.indravaibhavmarble.user.dto.UserResponse;
import com.indravaibhavmarble.user.dto.DataResetRequest;
import com.indravaibhavmarble.user.dto.DataResetResponse;
import com.indravaibhavmarble.user.service.UserManagementService;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasAuthority('USER_READ')")
public class UserManagementController {
    private final UserManagementService service;

    public UserManagementController(UserManagementService service) {
        this.service = service;
    }

    @GetMapping
    public List<UserResponse> getUsers() {
        return service.getUsers();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse createUser(@RequestBody UserRequest request) {
        return service.createUser(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserResponse updateUser(@PathVariable Long id, @RequestBody UserRequest request) {
        return service.updateUser(id, request);
    }

    @PostMapping("/{id}/status")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public UserResponse setActive(@PathVariable Long id, @RequestParam boolean active,
            Authentication authentication) {
        return service.setActive(id, active, authentication.getName());
    }

    @PostMapping("/data-reset")
    @PreAuthorize("hasRole('ADMIN')")
    public DataResetResponse resetBusinessData(@RequestBody DataResetRequest request,
            Authentication authentication) {
        return service.resetBusinessData(request, authentication.getName());
    }
}
