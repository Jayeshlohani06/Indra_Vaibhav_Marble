package com.indravaibhavmarble.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.indravaibhavmarble.auth.security.AuthenticatedUserCache;
import com.indravaibhavmarble.role.entity.Role;
import com.indravaibhavmarble.role.repository.RoleRepository;
import com.indravaibhavmarble.user.dto.UserRequest;
import com.indravaibhavmarble.user.entity.AppUser;
import com.indravaibhavmarble.user.repository.AppUserRepository;

import jakarta.persistence.EntityManager;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class UserManagementServiceTest {

    private AppUserRepository users;
    private RoleRepository roles;
    private UserManagementService service;
    private Role adminRole;
    private Role viewerRole;

    @BeforeEach
    void setUp() {
        users = mock(AppUserRepository.class);
        roles = mock(RoleRepository.class);
        service = new UserManagementService(users, roles,
                mock(PasswordEncoder.class), mock(EntityManager.class),
                mock(AuthenticatedUserCache.class), false);

        adminRole = role("ADMIN");
        viewerRole = role("VIEWER");
        when(roles.findByName("ADMIN")).thenReturn(Optional.of(adminRole));
        when(roles.findByName("VIEWER")).thenReturn(Optional.of(viewerRole));
        when(users.save(any(AppUser.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void lastActiveAdminCannotLoseAdminRole() {
        AppUser admin = user(1L, "admin@example.com", adminRole);
        when(users.countByActiveTrueAndRolesName("ADMIN")).thenReturn(1L);

        assertThatThrownBy(() -> service.updateUser(1L, request("VIEWER")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("At least one active ADMIN");
        assertThat(admin.getRoles()).containsExactly(adminRole);
        verify(users, never()).save(any());
    }

    @Test
    void adminRoleCanBeRemovedWhenAnotherAdminExists() {
        AppUser admin = user(1L, "admin@example.com", adminRole);
        when(users.countByActiveTrueAndRolesName("ADMIN")).thenReturn(2L);

        service.updateUser(1L, request("VIEWER"));

        assertThat(admin.getRoles()).containsExactly(viewerRole);
    }

    @Test
    void lastActiveAdminCannotBeDeactivated() {
        AppUser admin = user(1L, "admin@example.com", adminRole);
        when(users.countByActiveTrueAndRolesName("ADMIN")).thenReturn(1L);

        assertThatThrownBy(() -> service.setActive(1L, false, "owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("At least one active ADMIN");
        assertThat(admin.isActive()).isTrue();
    }

    @Test
    void nonAdminCanBeDeactivated() {
        AppUser viewer = user(2L, "viewer@example.com", viewerRole);

        service.setActive(2L, false, "admin@example.com");

        assertThat(viewer.isActive()).isFalse();
    }

    @Test
    void emptyRoleNameIsRejected() {
        user(2L, "viewer@example.com", viewerRole);

        assertThatThrownBy(() -> service.updateUser(2L, request("VIEWER", null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Role names cannot be empty");
    }

    private Role role(String name) {
        Role role = mock(Role.class);
        when(role.getName()).thenReturn(name);
        return role;
    }

    private AppUser user(Long id, String email, Role role) {
        AppUser user = AppUser.createNewUser();
        user.setFullName("Test User");
        user.setEmail(email);
        user.setActive(true);
        user.getRoles().add(role);
        when(users.findById(id)).thenReturn(Optional.of(user));
        return user;
    }

    private UserRequest request(String... roleNames) {
        List<String> names = Arrays.asList(roleNames);
        return new UserRequest("Test User", "admin@example.com", null, names);
    }
}
