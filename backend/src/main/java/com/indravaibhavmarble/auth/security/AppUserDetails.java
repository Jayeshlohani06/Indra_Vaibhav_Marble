
package com.indravaibhavmarble.auth.security;

import java.time.Instant;
import java.util.Collection;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

/**
 * Spring Security user that also carries when the password last changed,
 * so tokens issued before that moment can be rejected.
 */
public class AppUserDetails extends User {

    private final Instant passwordChangedAt;

    public AppUserDetails(
            String username,
            String password,
            boolean enabled,
            Collection<? extends GrantedAuthority> authorities,
            Instant passwordChangedAt) {
        super(username, password, enabled, true, true, true, authorities);
        this.passwordChangedAt = passwordChangedAt;
    }

    public Instant getPasswordChangedAt() {
        return passwordChangedAt;
    }
}
