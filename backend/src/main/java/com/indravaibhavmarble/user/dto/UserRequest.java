package com.indravaibhavmarble.user.dto;

import java.util.List;

public record UserRequest(
        String fullName,
        String email,
        String password,
        List<String> roles
) {}
