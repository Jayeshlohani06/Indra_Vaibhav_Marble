
package com.indravaibhavmarble.auth.service;

import com.indravaibhavmarble.role.entity.Role;
import com.indravaibhavmarble.role.repository.RoleRepository;
import com.indravaibhavmarble.user.entity.AppUser;
import com.indravaibhavmarble.user.repository.AppUserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(
        name = "app.bootstrap-admin.enabled",
        havingValue = "true")
public class BootstrapAdminRunner implements ApplicationRunner {

    private final AppUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${BOOTSTRAP_ADMIN_NAME}")
    private String adminName;

    @Value("${BOOTSTRAP_ADMIN_EMAIL}")
    private String adminEmail;

    @Value("${BOOTSTRAP_ADMIN_PASSWORD}")
    private String adminPassword;

    public BootstrapAdminRunner(
            AppUserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            throw new IllegalStateException(
                    "Admin bootstrap refused: users already exist. "
                    + "Disable app.bootstrap-admin.enabled.");
        }

        if (adminName == null || adminName.isBlank()
                || adminEmail == null || adminEmail.isBlank()
                || adminPassword == null || adminPassword.length() < 12) {
            throw new IllegalStateException(
                    "Provide an admin name, email, and password "
                    + "of at least 12 characters.");
        }

        if (userRepository.existsByEmailIgnoreCase(adminEmail.trim())) {
            throw new IllegalStateException(
                    "The admin email is already registered.");
        }

        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseThrow(() -> new IllegalStateException(
                        "ADMIN role is missing from the database."));

        AppUser user = AppUser.createNewUser();
        user.setFullName(adminName.trim());
        user.setEmail(adminEmail.trim().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(adminPassword));
        user.setActive(true);
        user.getRoles().add(adminRole);

        userRepository.save(user);

        System.out.println(
                "Initial administrator created successfully.");
    }
}
