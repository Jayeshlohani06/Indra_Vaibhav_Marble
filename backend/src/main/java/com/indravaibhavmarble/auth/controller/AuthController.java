
package com.indravaibhavmarble.auth.controller;

import com.indravaibhavmarble.auth.dto.LoginRequest;
import com.indravaibhavmarble.auth.dto.LoginResponse;
import com.indravaibhavmarble.auth.service.AuthService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
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

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuthenticationException(
            AuthenticationException exception) {

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("Invalid email or password"));
    }

    public record ApiError(String message) {
    }
}
