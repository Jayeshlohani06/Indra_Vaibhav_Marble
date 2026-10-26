package com.indravaibhavmarble.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;

class AuthenticatedUserCacheTest {

    @Test
    void repeatedRequestsReuseTheLoadedUser() {
        UserDetailsService service = mock(UserDetailsService.class);
        UserDetails user = User.withUsername("a@shop.in").password("x").authorities("SALES_READ").build();
        when(service.loadUserByUsername("a@shop.in")).thenReturn(user);
        AuthenticatedUserCache cache = new AuthenticatedUserCache(service);

        assertThat(cache.load("a@shop.in")).isSameAs(user);
        assertThat(cache.load("A@Shop.in".toLowerCase())).isSameAs(user);

        verify(service, times(1)).loadUserByUsername("a@shop.in");
    }

    @Test
    void clearingTheCacheLoadsTheUsersLatestRoles() {
        UserDetailsService service = mock(UserDetailsService.class);
        UserDetails before = User.withUsername("a@shop.in").password("x").authorities("SALES_READ").build();
        UserDetails after = User.withUsername("a@shop.in").password("x").disabled(true).authorities("SALES_READ").build();
        when(service.loadUserByUsername("a@shop.in")).thenReturn(before, after);
        AuthenticatedUserCache cache = new AuthenticatedUserCache(service);

        assertThat(cache.load("a@shop.in").isEnabled()).isTrue();
        cache.evictAllAfterCommit();

        assertThat(cache.load("a@shop.in").isEnabled()).isFalse();
    }
}
