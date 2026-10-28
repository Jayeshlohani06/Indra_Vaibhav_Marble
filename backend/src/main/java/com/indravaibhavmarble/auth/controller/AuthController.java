
package com.indravaibhavmarble.auth.controller;

import com.indravaibhavmarble.auth.dto.LoginRequest;
import com.indravaibhavmarble.auth.dto.LoginResponse;
import com.indravaibhavmarble.auth.service.AuthService;
import com.indravaibhavmarble.auth.service.LoginAttemptService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request) {

        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public LoginResponse.UserInfo currentUser(Authentication authentication) {
        return authService.currentUser(authentication.getName());
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthenticationException(
            AuthenticationException exception) {

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("Wrong mobile number, email or password"));
    }

    @ExceptionHandler(LoginAttemptService.LoginLockedException.class)
    public ResponseEntity<ApiError> handleLoginLocked(
            LoginAttemptService.LoginLockedException exception) {

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new ApiError(exception.getMessage()));
    }

    public record ApiError(String message) {
    }
}
