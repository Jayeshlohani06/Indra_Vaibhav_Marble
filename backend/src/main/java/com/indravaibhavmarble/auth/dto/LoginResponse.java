
package com.indravaibhavmarble.auth.dto;

import java.util.List;

public record LoginResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        UserInfo user
) {
    public record UserInfo(
            Long id,
            String fullName,
            String email,
            List<String> roles,
            List<String> permissions
    ) {
    }
}
