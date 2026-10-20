package com.indravaibhavmarble.user.dto;

import java.time.Instant;
import java.util.List;

public record UserResponse(
        Long id,
        String fullName,
        String email,
        boolean active,
        List<String> roles,
        Instant createdAt,
        Instant updatedAt
) {}
