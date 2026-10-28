package com.indravaibhavmarble.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;

/**
 * Log in with a mobile number or an email address. {@code email} is the
 * older field name and is still accepted.
 */
public record LoginRequest(
        String identifier,

        String email,

        @NotBlank(message = "Password is required")
        String password
) {

    public LoginRequest(String email, String password) {
        this(null, email, password);
    }

    /** What the person typed in the login box. */
    public String login() {
        return identifier != null && !identifier.isBlank() ? identifier.trim()
                : email == null ? "" : email.trim();
    }

    @AssertTrue(message = "Enter your mobile number or email")
    public boolean isLoginPresent() {
        return !login().isEmpty();
    }
}
