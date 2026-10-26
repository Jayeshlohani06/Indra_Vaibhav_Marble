package com.indravaibhavmarble.user.service;

import com.indravaibhavmarble.role.entity.Role;
import com.indravaibhavmarble.role.repository.RoleRepository;
import com.indravaibhavmarble.user.dto.UserRequest;
import com.indravaibhavmarble.user.dto.UserResponse;
import com.indravaibhavmarble.user.dto.DataResetRequest;
import com.indravaibhavmarble.user.dto.DataResetResponse;
import com.indravaibhavmarble.user.entity.AppUser;
import com.indravaibhavmarble.user.repository.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class UserManagementService {
    private final AppUserRepository users;
    private final RoleRepository roles;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final boolean dataResetEnabled;

    public UserManagementService(AppUserRepository users, RoleRepository roles,
            PasswordEncoder passwordEncoder, EntityManager entityManager,
            @Value("${app.data-reset.enabled:false}") boolean dataResetEnabled) {
        this.users = users;
        this.roles = roles;
        this.passwordEncoder = passwordEncoder;
        this.entityManager = entityManager;
        this.dataResetEnabled = dataResetEnabled;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsers() {
        return users.findAll().stream().map(this::toResponse).toList();
    }

    public UserResponse createUser(UserRequest request) {
        validate(request, true);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) throw new IllegalArgumentException("A user with this email already exists");
        AppUser user = AppUser.createNewUser();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.getRoles().addAll(resolveRoles(request.roles()));
        return toResponse(users.save(user));
    }

    public UserResponse updateUser(Long id, UserRequest request) {
        AppUser user = users.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        validate(request, false);
        user.setFullName(request.fullName().trim());
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (!email.equalsIgnoreCase(user.getEmail()) && users.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("A user with this email already exists");
        }
        user.setEmail(email);
        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        user.getRoles().clear();
        user.getRoles().addAll(resolveRoles(request.roles()));
        return toResponse(users.save(user));
    }

    public UserResponse setActive(Long id, boolean active, String actorEmail) {
        AppUser user = users.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!active && user.getEmail().equalsIgnoreCase(actorEmail)) {
            throw new IllegalArgumentException("You cannot deactivate your own account");
        }
        user.setActive(active);
        return toResponse(users.save(user));
    }

    public DataResetResponse resetBusinessData(DataResetRequest request, String actorEmail) {
        // Off unless the server explicitly enables it (DATA_RESET_ENABLED=true).
        if (!dataResetEnabled) {
            throw new IllegalArgumentException(
                    "Removing business data is disabled on this server");
        }
        if (request == null || request.password() == null || request.password().isBlank()) {
            throw new IllegalArgumentException("Admin password is required");
        }
        if (!"DELETE ALL BUSINESS DATA".equals(request.confirmation())) {
            throw new IllegalArgumentException(
                    "Enter the exact confirmation phrase: DELETE ALL BUSINESS DATA");
        }

        AppUser admin = users.findByEmailIgnoreCase(actorEmail)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated admin was not found"));
        if (!admin.isActive() || admin.getRoles().stream()
                .noneMatch(role -> "ADMIN".equals(role.getName()))) {
            throw new IllegalArgumentException("Only an active ADMIN can remove business data");
        }
        if (!passwordEncoder.matches(request.password(), admin.getPasswordHash())) {
            throw new IllegalArgumentException("The Admin password is incorrect");
        }

        entityManager.createNativeQuery("""
                TRUNCATE TABLE
                    expenses,
                    expense_categories,
                    purchase_payments,
                    purchase_items,
                    purchases,
                    sales_order_payments,
                    sales_order_items,
                    sales_orders,
                    stock_movements,
                    product_slabs,
                    product_stock_balances,
                    product_inventory_settings,
                    products,
                    customers,
                    suppliers,
                    product_categories,
                    measurement_units
                RESTART IDENTITY CASCADE
                """).executeUpdate();

        return new DataResetResponse(
                "All business data was removed. Users, roles, permissions, settings, and database structure were preserved.");
    }

    private HashSet<Role> resolveRoles(List<String> names) {
        if (names == null || names.isEmpty()) throw new IllegalArgumentException("At least one role is required");
        HashSet<Role> resolved = new HashSet<>();
        for (String name : names) {
            Role role = roles.findByName(name.trim().toUpperCase(Locale.ROOT))
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name));
            resolved.add(role);
        }
        return resolved;
    }

    private void validate(UserRequest request, boolean requirePassword) {
        if (request == null || request.fullName() == null || request.fullName().isBlank()
                || request.email() == null || request.email().isBlank()) {
            throw new IllegalArgumentException("Full name and email are required");
        }
        if ((requirePassword && (request.password() == null || request.password().length() < 8))
                || (!requirePassword && request.password() != null && !request.password().isBlank()
                && request.password().length() < 8)) {
            throw new IllegalArgumentException("Password must contain at least 8 characters");
        }
    }

    private UserResponse toResponse(AppUser user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.isActive(),
                user.getRoles().stream().map(Role::getName).sorted().toList(),
                user.getCreatedAt(), user.getUpdatedAt());
    }
}
