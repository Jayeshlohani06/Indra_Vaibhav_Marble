package com.indravaibhavmarble.common.config;

import com.indravaibhavmarble.auth.security.CustomUserDetailsService;
import com.indravaibhavmarble.auth.security.JwtAuthenticationFilter;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
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
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${app.cors.allowed-origins}")
    private String allowedOrigins;

    /**
     * Configure CORS to allow requests from the React frontend.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(
                Arrays.stream(allowedOrigins.split(","))
                        .map(String::trim)
                        .filter(origin -> !origin.isEmpty())
                        .collect(Collectors.toList()));

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

                    // Payment rules must precede the broader purchase and
                    // sales-order rules because the first matching rule wins.
                    .requestMatchers(
                            HttpMethod.GET,
                            "/api/purchases/*/payments/**",
                            "/api/sales-orders/*/payments/**")
                    .hasAuthority("PAYMENT_READ")
                    .requestMatchers(
                            HttpMethod.POST,
                            "/api/purchases/*/payments/**",
                            "/api/sales-orders/*/payments/**")
                    .hasAuthority("PAYMENT_MANAGE")

                    // Reports and read-only workspace access.
                    .requestMatchers(HttpMethod.GET, "/api/reports/**")
                    .hasAuthority("REPORT_READ")
                    .requestMatchers(HttpMethod.GET, "/api/products/**")
                    .hasAuthority("PRODUCT_READ")
                    .requestMatchers(HttpMethod.GET, "/api/categories/**", "/api/units/**")
                    .hasAuthority("MASTER_DATA_READ")
                    .requestMatchers(HttpMethod.GET, "/api/inventory/settings/**")
                    .hasAuthority("PRODUCT_READ")
                    .requestMatchers(HttpMethod.GET, "/api/inventory/slabs/**")
                    .hasAuthority("INVENTORY_READ")
                    .requestMatchers(HttpMethod.GET, "/api/customers/**")
                    .hasAuthority("CUSTOMER_READ")
                    .requestMatchers(HttpMethod.GET, "/api/suppliers/**")
                    .hasAuthority("SUPPLIER_READ")
                    .requestMatchers(HttpMethod.GET, "/api/purchases/**")
                    .hasAuthority("PURCHASE_READ")
                    .requestMatchers(HttpMethod.GET, "/api/sales-orders/**")
                    .hasAuthority("SALES_READ")
                    .requestMatchers(HttpMethod.GET, "/api/stock-movements/**")
                    .hasAuthority("INVENTORY_READ")
                    .requestMatchers(HttpMethod.GET, "/api/expenses/**")
                    .hasAuthority("EXPENSE_READ")
                    .requestMatchers(HttpMethod.GET, "/api/expense-categories/**")
                    .hasAuthority("MASTER_DATA_READ")
                    .requestMatchers(HttpMethod.GET, "/api/users/**")
                    .hasAuthority("USER_READ")

                    // Master-data and product mutations.
                    .requestMatchers(HttpMethod.POST, "/api/categories/**", "/api/units/**", "/api/expense-categories/**")
                    .hasAuthority("MASTER_DATA_MANAGE")
                    .requestMatchers(HttpMethod.POST, "/api/products/**")
                    .hasAuthority("PRODUCT_MANAGE")
                    .requestMatchers(HttpMethod.PUT, "/api/products/**")
                    .hasAuthority("PRODUCT_MANAGE")
                    .requestMatchers(HttpMethod.DELETE, "/api/products/**")
                    .hasAuthority("PRODUCT_MANAGE")

                    // Customer and supplier mutations.
                    .requestMatchers(HttpMethod.POST, "/api/customers/**")
                    .hasAuthority("CUSTOMER_MANAGE")
                    .requestMatchers(HttpMethod.PUT, "/api/customers/**")
                    .hasAuthority("CUSTOMER_MANAGE")
                    .requestMatchers(HttpMethod.DELETE, "/api/customers/**")
                    .hasAuthority("CUSTOMER_MANAGE")
                    .requestMatchers(HttpMethod.POST, "/api/suppliers/**")
                    .hasAuthority("SUPPLIER_MANAGE")
                    .requestMatchers(HttpMethod.PUT, "/api/suppliers/**")
                    .hasAuthority("SUPPLIER_MANAGE")
                    .requestMatchers(HttpMethod.DELETE, "/api/suppliers/**")
                    .hasAuthority("SUPPLIER_MANAGE")

                    // Sales, purchasing, inventory, and expense mutations.
                    .requestMatchers(HttpMethod.POST, "/api/sales-orders/**")
                    .hasAuthority("SALES_MANAGE")
                    .requestMatchers(HttpMethod.POST, "/api/purchases/**")
                    .hasAuthority("PURCHASE_MANAGE")
                    .requestMatchers(HttpMethod.PUT, "/api/purchases/**")
                    .hasAuthority("PURCHASE_MANAGE")
                    .requestMatchers(HttpMethod.POST, "/api/stock-movements/**")
                    .hasAuthority("INVENTORY_MANAGE")
                    .requestMatchers(HttpMethod.POST, "/api/inventory/slabs/**")
                    .hasAuthority("INVENTORY_MANAGE")
                    .requestMatchers(HttpMethod.PUT, "/api/inventory/settings/**")
                    .hasAuthority("INVENTORY_MANAGE")
                    .requestMatchers(HttpMethod.POST, "/api/expenses/**")
                    .hasAuthority("EXPENSE_MANAGE")
                    .requestMatchers(HttpMethod.PUT, "/api/expenses/**")
                    .hasAuthority("EXPENSE_MANAGE")
                    .requestMatchers(HttpMethod.POST, "/api/users/**")
                    .hasAuthority("USER_MANAGE")
                    .requestMatchers(HttpMethod.PUT, "/api/users/**")
                    .hasAuthority("USER_MANAGE")

                    // Require authentication for endpoints not yet classified.
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