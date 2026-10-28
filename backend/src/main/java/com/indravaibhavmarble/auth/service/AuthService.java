
package com.indravaibhavmarble.auth.service;

import com.indravaibhavmarble.auth.dto.LoginRequest;
import com.indravaibhavmarble.auth.dto.LoginResponse;
import com.indravaibhavmarble.auth.security.JwtService;
import com.indravaibhavmarble.common.util.MobileNumbers;
import com.indravaibhavmarble.role.entity.Role;
import com.indravaibhavmarble.permission.entity.Permission;
import com.indravaibhavmarble.user.entity.AppUser;
import com.indravaibhavmarble.user.repository.AppUserRepository;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final AppUserRepository appUserRepository;
    private final JwtService jwtService;
    private final LoginAttemptService loginAttemptService;
    private final long expirationMs;

    public AuthService(
            AuthenticationManager authenticationManager,
            AppUserRepository appUserRepository,
            JwtService jwtService,
            LoginAttemptService loginAttemptService,
            @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.authenticationManager = authenticationManager;
        this.appUserRepository = appUserRepository;
        this.jwtService = jwtService;
        this.loginAttemptService = loginAttemptService;
        this.expirationMs = expirationMs;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {

        String email = resolveEmail(request.login());
        loginAttemptService.checkNotLocked(email);

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            email,
                            request.password()));
        } catch (AuthenticationException exception) {
            loginAttemptService.recordFailure(email);
            throw exception;
        }

        loginAttemptService.recordSuccess(email);

        AppUser user = appUserRepository
                .findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Authenticated user was not found"));

        String token = jwtService.generateToken(user);

        return new LoginResponse(
                token,
                "Bearer",
                expirationMs / 1000,
                toUserInfo(user));
    }

    /**
     * Turns what was typed in the login box into the email the account is
     * stored under. A mobile number is looked up; an unknown number is passed
     * on unchanged so it fails like a wrong email, without saying which part
     * was wrong.
     */
    private String resolveEmail(String login) {
        if (login.contains("@")) return login;
        String phone = MobileNumbers.normalize(login);
        if (phone == null) return login;
        return appUserRepository.findByPhone(phone).map(AppUser::getEmail).orElse(phone);
    }

    /**
     * Returns the signed-in user's current roles and permissions so the
     * frontend can pick up changes without logging in again.
     */
    @Transactional(readOnly = true)
    public LoginResponse.UserInfo currentUser(String email) {
        AppUser user = appUserRepository
                .findByEmailIgnoreCase(email)
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Authenticated user was not found"));

        return toUserInfo(user);
    }

    private LoginResponse.UserInfo toUserInfo(AppUser user) {
        Set<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        Set<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getCode)
                .collect(Collectors.toSet());

        return new LoginResponse.UserInfo(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                roles.stream().sorted().toList(),
                permissions.stream().sorted().toList());
    }
}
