package com.indravaibhavmarble.user.dto;

public record DataResetRequest(
        String password,
        String confirmation
) {
}
