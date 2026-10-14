
package com.indravaibhavmarble.auth.security;

import com.indravaibhavmarble.permission.entity.Permission;
import com.indravaibhavmarble.role.entity.Role;
import com.indravaibhavmarble.user.entity.AppUser;
import com.indravaibhavmarble.user.repository.AppUserRepository;

import java.util.HashSet;
import java.util.Set;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final AppUserRepository appUserRepository;

    public CustomUserDetailsService(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        AppUser appUser = appUserRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "User not found"));

        Set<GrantedAuthority> authorities = new HashSet<>();

        for (Role role : appUser.getRoles()) {
            authorities.add(
                    new SimpleGrantedAuthority("ROLE_" + role.getName()));

            for (Permission permission : role.getPermissions()) {
                authorities.add(
                        new SimpleGrantedAuthority(permission.getCode()));
            }
        }

        return org.springframework.security.core.userdetails.User
                .withUsername(appUser.getEmail())
                .password(appUser.getPasswordHash())
                .authorities(authorities)
                .disabled(!appUser.isActive())
                .build();
    }
}
