package com.indravaibhavmarble.user.dto;

import java.util.List;

public record UserRequest(
        String fullName,
        String email,
        String phone,
        String password,
        List<String> roles
) {

    public UserRequest(String fullName, String email, String password, List<String> roles) {
        this(fullName, email, null, password, roles);
    }
}
