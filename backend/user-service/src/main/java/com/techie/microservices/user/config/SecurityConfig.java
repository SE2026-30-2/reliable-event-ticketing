package com.techie.microservices.user.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.user.infrastructure.security.RsaKeyProvider;
import com.techie.microservices.user.web.error.ErrorResponse;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

import lombok.RequiredArgsConstructor;

/**
 * This service is BOTH the JWT issuer and, for its own /api/user/me, /logout,
 * /email/verify/resend and /admin/** routes, an OAuth2 Resource Server validating that same JWT -
 * so the {@link JwtDecoder} is built directly from {@link RsaKeyProvider}'s in-memory
 * RSAPublicKey rather than by fetching its own /.well-known/jwks.json over HTTP (which would also
 * be a startup-order chicken-and-egg problem). Every other service instead points
 * {@code NimbusJwtDecoder.withJwkSetUri(...)} at that endpoint - see e.g. payment-service's
 * SecurityConfig - and shares the same {@code roles} claim -> {@code ROLE_*} authority mapping
 * used here, so a token issued by this service authorizes identically everywhere.
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final RsaKeyProvider rsaKeyProvider;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withPublicKey(rsaKeyProvider.getPublicKey()).build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthorityPrefix("ROLE_");
        authoritiesConverter.setAuthoritiesClaimName("roles");

        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return converter;
    }

    @Bean
    public RateLimitFilter rateLimitFilter(
            @Value("${security.rate-limit.auth-endpoints.max-requests:5}") int maxRequestsPerWindow,
            @Value("${security.rate-limit.auth-endpoints.window-seconds:60}") long windowSeconds,
            ObjectMapper objectMapper) {
        return new RateLimitFilter(maxRequestsPerWindow, windowSeconds, objectMapper);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder,
                                                     JwtAuthenticationConverter jwtAuthenticationConverter,
                                                     AuthenticationEntryPoint authenticationEntryPoint,
                                                     AccessDeniedHandler accessDeniedHandler,
                                                     RateLimitFilter rateLimitFilter,
                                                     org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/user/register", "/api/user/login", "/api/user/refresh",
                                "/api/user/email/verify", "/api/user/password/forgot", "/api/user/password/reset",
                                "/.well-known/jwks.json").permitAll()
                        .requestMatchers("/api/user/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/user/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                        .decoder(jwtDecoder)
                        .jwtAuthenticationConverter(jwtAuthenticationConverter)))
                // Runs before JWT parsing/validation - register/forgot-password are permitAll
                // anyway, and resend-verification should be rejected for spamming before we
                // bother decoding its bearer token.
                .addFilterBefore(rateLimitFilter, BearerTokenAuthenticationFilter.class);
        return http.build();
    }

    /**
     * Matches the {@link ErrorResponse} JSON shape {@code GlobalExceptionHandler} uses for every
     * other error. Spring Security's filter-chain rejections (missing/invalid/expired JWT, or a
     * valid JWT lacking ROLE_ADMIN on an admin route) happen before the request reaches the
     * DispatcherServlet, so a {@code @RestControllerAdvice} can never intercept them - this is the
     * earliest point the response body can be shaped.
     */
    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint(ObjectMapper objectMapper) {
        return (request, response, authException) ->
                writeError(response, objectMapper, HttpStatus.UNAUTHORIZED, "A valid JWT bearer token is required");
    }

    @Bean
    public AccessDeniedHandler accessDeniedHandler(ObjectMapper objectMapper) {
        return (request, response, accessDeniedException) ->
                writeError(response, objectMapper, HttpStatus.FORBIDDEN, "You do not have permission to access this resource");
    }

    private static void writeError(HttpServletResponse response, ObjectMapper objectMapper,
                                    HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(message));
    }
}
