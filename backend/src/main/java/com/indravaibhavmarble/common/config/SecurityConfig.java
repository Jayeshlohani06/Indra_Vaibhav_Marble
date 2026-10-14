package com.indravaibhavmarble.common.config;

import com.indravaibhavmarble.auth.security.CustomUserDetailsService;
import com.indravaibhavmarble.auth.security.JwtAuthenticationFilter;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

    /**
     * Configure CORS to allow requests from the React frontend.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(
                List.of("http://localhost:5173"));

        configuration.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                ));

        configuration.setAllowedHeaders(
                List.of("*"));

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
                "/**",
                configuration);

        return source;
    }

    /**
     * Configure authentication using the custom user details service.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider(
            CustomUserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {

        DaoAuthenticationProvider provider =
                new DaoAuthenticationProvider(userDetailsService);

        provider.setPasswordEncoder(passwordEncoder);

        return provider;
    }

    /**
     * Expose the AuthenticationManager for login authentication.
     */
    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration configuration)
            throws Exception {

        return configuration.getAuthenticationManager();
    }

    /**
     * Configure the Spring Security filter chain.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            DaoAuthenticationProvider authenticationProvider,
            JwtAuthenticationFilter jwtAuthenticationFilter)
            throws Exception {

        http
            // Enable CORS
            .cors(Customizer.withDefaults())

            // Disable CSRF for the stateless JWT API
            .csrf(AbstractHttpConfigurer::disable)

            // Register the authentication provider
            .authenticationProvider(authenticationProvider)

            // Process JWTs before username/password authentication
            .addFilterBefore(
                    jwtAuthenticationFilter,
                    UsernamePasswordAuthenticationFilter.class)

            // Configure endpoint access
            .authorizeHttpRequests(auth -> auth

                    // Allow browser preflight requests
                    .requestMatchers(
                            HttpMethod.OPTIONS,
                            "/**"
                    ).permitAll()

                    // Public endpoints
                    .requestMatchers(
                            "/api/health",
                            "/api/auth/login"
                    ).permitAll()

                    // Require authentication for all other endpoints
                    .anyRequest().authenticated()
            )

            // Return HTTP 401 for unauthenticated requests
            .exceptionHandling(exception -> exception
                    .authenticationEntryPoint(
                            new HttpStatusEntryPoint(
                                    HttpStatus.UNAUTHORIZED
                            )
                    )
            );

        return http.build();
    }
}