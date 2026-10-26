
package com.indravaibhavmarble.auth.service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

/**
 * Limits repeated failed logins per email address to slow down password
 * guessing. State is kept in memory, which is sufficient for a single
 * application instance.
 */
@Service
public class LoginAttemptService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(15);

    private final Map<String, Attempts> attemptsByEmail =
            new ConcurrentHashMap<>();

    public void checkNotLocked(String email) {
        Attempts attempts = attemptsByEmail.get(key(email));

        if (attempts != null
                && attempts.lockedUntil() != null
                && attempts.lockedUntil().isAfter(Instant.now())) {
            throw new LoginLockedException();
        }
    }

    public void recordFailure(String email) {
        attemptsByEmail.compute(key(email), (key, attempts) -> {
            Instant now = Instant.now();

            // Start counting again once an earlier lock has expired.
            int failures = attempts == null
                    || (attempts.lockedUntil() != null
                    && !attempts.lockedUntil().isAfter(now))
                    ? 1
                    : attempts.failures() + 1;

            Instant lockedUntil = failures >= MAX_FAILED_ATTEMPTS
                    ? now.plus(LOCK_DURATION)
                    : null;

            return new Attempts(failures, lockedUntil);
        });
    }

    public void recordSuccess(String email) {
        attemptsByEmail.remove(key(email));
    }

    private String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private record Attempts(int failures, Instant lockedUntil) {
    }

    public static class LoginLockedException extends RuntimeException {
        public LoginLockedException() {
            super("Too many failed login attempts. "
                    + "Please try again in 15 minutes.");
        }
    }
}
