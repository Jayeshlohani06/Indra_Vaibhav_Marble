
package com.indravaibhavmarble.auth.service;

import com.indravaibhavmarble.auth.dto.LoginRequest;
import com.indravaibhavmarble.auth.dto.LoginResponse;
import com.indravaibhavmarble.auth.security.JwtService;
import com.indravaibhavmarble.role.entity.Role;
import com.indravaibhavmarble.permission.entity.Permission;
import com.indravaibhavmarble.user.entity.AppUser;
import com.indravaibhavmarble.user.repository.AppUserRepository;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final AppUserRepository appUserRepository;
    private final JwtService jwtService;

    public AuthService(
            AuthenticationManager authenticationManager,
            AppUserRepository appUserRepository,
            JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.appUserRepository = appUserRepository;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {

        Authentication authentication =
                authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(
                                request.email().trim(),
                                request.password()));

        AppUser user = appUserRepository
                .findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() ->
                        new IllegalStateException(
                                "Authenticated user was not found"));

        Set<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toSet());

        Set<String> permissions = user.getRoles().stream()
                .flatMap(role -> role.getPermissions().stream())
                .map(Permission::getCode)
                .collect(Collectors.toSet());

        String token = jwtService.generateToken(user);

        LoginResponse.UserInfo userInfo =
                new LoginResponse.UserInfo(
                        user.getId(),
                        user.getFullName(),
                        user.getEmail(),
                        roles.stream().sorted().toList(),
                        permissions.stream().sorted().toList());

        return new LoginResponse(
                token,
                "Bearer",
                28800,
                userInfo);
    }
}
