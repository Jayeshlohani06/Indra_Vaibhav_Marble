package com.indravaibhavmarble.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.indravaibhavmarble.auth.dto.LoginRequest;
import com.indravaibhavmarble.auth.service.AuthService;
import com.indravaibhavmarble.common.util.MobileNumbers;
import com.indravaibhavmarble.user.dto.UserRequest;
import com.indravaibhavmarble.user.dto.UserResponse;
import com.indravaibhavmarble.user.service.UserManagementService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.AuthenticationException;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class MobileLoginTest {

    private static final String PASSWORD = "counter-pass-1";

    @Autowired
    private UserManagementService userService;

    @Autowired
    private AuthService authService;

    private UserResponse createStaff(String email, String phone) {
        return userService.createUser(new UserRequest("Counter Staff", email, phone, PASSWORD, List.of("VIEWER")));
    }

    @Test
    void mobileNumbersAreStoredAsTenDigits() {
        assertThat(MobileNumbers.normalize("98765 43210")).isEqualTo("9876543210");
        assertThat(MobileNumbers.normalize("+91-98765-43210")).isEqualTo("9876543210");
        assertThat(MobileNumbers.normalize("09876543210")).isEqualTo("9876543210");
        assertThat(MobileNumbers.normalize("12345")).isNull();
        assertThat(MobileNumbers.normalize("5876543210")).isNull();
        assertThat(MobileNumbers.normalize("staff@example.com")).isNull();
    }

    @Test
    void staffCanLogInWithMobileNumberOrEmail() {
        UserResponse staff = createStaff("mobile.login@example.com", "+91 98765 01234");
        assertThat(staff.phone()).isEqualTo("9876501234");

        var byPhone = authService.login(new LoginRequest("98765 01234", null, PASSWORD));
        assertThat(byPhone.user().email()).isEqualTo("mobile.login@example.com");

        var byEmail = authService.login(new LoginRequest("Mobile.Login@example.com", PASSWORD));
        assertThat(byEmail.user().id()).isEqualTo(staff.id());
    }

    @Test
    void wrongPasswordOrUnknownNumberIsRefused() {
        createStaff("mobile.refuse@example.com", "9876501235");

        assertThatThrownBy(() -> authService.login(new LoginRequest("9876501235", null, "wrong-password")))
                .isInstanceOf(AuthenticationException.class);
        assertThatThrownBy(() -> authService.login(new LoginRequest("9000000001", null, PASSWORD)))
                .isInstanceOf(AuthenticationException.class);
    }

    @Test
    void mobileNumberMustBeValidAndUnique() {
        UserResponse first = createStaff("mobile.first@example.com", "9876501236");

        assertThatThrownBy(() -> createStaff("mobile.second@example.com", "98765-01236"))
                .hasMessageContaining("already has this mobile number");
        assertThatThrownBy(() -> createStaff("mobile.third@example.com", "12345"))
                .hasMessageContaining("10-digit mobile number");

        // Saving the same user with its own number is fine; clearing it removes it.
        UserResponse kept = userService.updateUser(first.id(),
                new UserRequest("Counter Staff", "mobile.first@example.com", "9876501236", null, List.of("VIEWER")));
        assertThat(kept.phone()).isEqualTo("9876501236");
        UserResponse cleared = userService.updateUser(first.id(),
                new UserRequest("Counter Staff", "mobile.first@example.com", "", null, List.of("VIEWER")));
        assertThat(cleared.phone()).isNull();
    }
}
