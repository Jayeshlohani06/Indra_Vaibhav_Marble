package com.indravaibhavmarble.auth.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Keeps the signed-in user's roles and permissions for a few seconds so each
 * API request does not reload them from the database.
 *
 * Only token checks use this; logging in always reads the database. Any change
 * to a user clears the cache, so role changes and deactivation apply at once.
 */
@Component
public class AuthenticatedUserCache {

    private static final Duration TIME_TO_LIVE = Duration.ofSeconds(30);
    private static final int MAX_ENTRIES = 500;

    private final UserDetailsService userDetailsService;
    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    private record Entry(UserDetails user, Instant expiresAt) {
    }

    public AuthenticatedUserCache(UserDetailsService userDetailsService) {
        this.userDetailsService = userDetailsService;
    }

    public UserDetails load(String email) {
        String key = email.toLowerCase(Locale.ROOT);
        Instant now = Instant.now();
        Entry entry = entries.get(key);

        if (entry != null && entry.expiresAt().isAfter(now)) {
            return entry.user();
        }

        UserDetails user = userDetailsService.loadUserByUsername(email);
        if (entries.size() >= MAX_ENTRIES) {
            entries.clear();
        }
        entries.put(key, new Entry(user, now.plus(TIME_TO_LIVE)));
        return user;
    }

    /**
     * Clears the cache once the current transaction commits, so a request
     * running at the same time cannot cache the user's old roles again.
     */
    public void evictAllAfterCommit() {
        entries.clear();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            entries.clear();
                        }
                    });
        }
    }
}
