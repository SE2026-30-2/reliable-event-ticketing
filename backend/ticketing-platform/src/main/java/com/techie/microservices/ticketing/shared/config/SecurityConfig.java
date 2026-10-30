package com.techie.microservices.ticketing.shared.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.ticketing.shared.web.error.ErrorResponse;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

/**
 * OAuth2 Resource Server config verifying user-service's JWT (same jwk-set-uri pattern as every
 * downstream service in the original CommerceForge codebase, e.g. order-service's SecurityConfig)
 * to gate the admin-only endpoints. This is entirely separate from this service's own QR-signing
 * key ({@code infrastructure.security.RsaKeyProvider}/{@code TicketQrSigner}) - two independent
 * signing domains that happen to share the same verification *pattern* but not any key material.
 * <p>
 * Route rules (see EventController/TicketTypeController/TicketController/CheckinDeviceController/
 * CheckinDashboardController):
 * <ul>
 *   <li>{@code POST /api/event}, {@code POST /api/event/{id}/ticket-types},
 *       {@code PATCH /api/ticket/{id}/status}, {@code GET /api/event/{id}/tickets},
 *       {@code POST /api/checkin/devices}, {@code PATCH /api/checkin/devices/{id}/revoke},
 *       {@code GET /api/checkin/events/{id}/stats} - {@code ROLE_ADMIN} only;</li>
 *   <li>buyer endpoints - {@code POST /api/ticket-types/{id}/reservations}, {@code POST
 *       /api/payment/requests}, {@code GET /api/ticket/{id}}, {@code POST /api/ticket/{id}/resend},
 *       {@code /api/my/**} - need any valid user-service JWT (a buyer account). That only proves
 *       *who* is calling; the use cases then check the caller owns the specific reservation/ticket
 *       (an ADMIN may read any ticket), and "not yours" is reported as 404, never 403;</li>
 *   <li>browsing (events, ticket types) - public;</li>
 *   <li>{@code POST /api/checkin} / {@code POST /api/checkin/batch} - also public at this layer,
 *       but NOT actually unauthenticated: a scanning device is equipment, not a user-service
 *       account, so it authenticates with a symmetric {@code X-Device-Key} header instead of a
 *       JWT - checked inside {@code SubmitCheckinApplicationService}, not by this filter chain
 *       (an unrecognized/revoked key is a normal audited outcome in the response, not a 401 -
 *       see CheckinController);</li>
 *   <li>everything else (actuator, swagger/api-docs, this service's own JWKS) - public.</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${security.jwt.jwk-set-uri:http://localhost:8087/.well-known/jwks.json}")
    private String jwkSetUri;

    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
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
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder,
                                                     JwtAuthenticationConverter jwtAuthenticationConverter,
                                                     AuthenticationEntryPoint authenticationEntryPoint,
                                                     AccessDeniedHandler accessDeniedHandler,
                                                     org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Management: ADMIN (everything) or ORGANIZER (only events they created - the
                        // per-event rule is EventAccessPort, applied in each controller/use case).
                        .requestMatchers(HttpMethod.POST, "/api/event").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.PATCH, "/api/event/*").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.POST, "/api/event/*/ticket-types").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.GET, "/api/event/*/tickets").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.PATCH, "/api/ticket/*/status").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers("/api/manage/**").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.POST, "/api/checkin/devices").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.GET, "/api/checkin/devices").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.PATCH, "/api/checkin/devices/*/revoke").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.GET, "/api/checkin/events/*/stats").hasAnyRole("ADMIN", "ORGANIZER")
                        .requestMatchers(HttpMethod.GET, "/api/checkin/events/*/timeline").hasAnyRole("ADMIN", "ORGANIZER")
                        // Buyer endpoints: any logged-in user-service account. Ownership of the specific
                        // reservation/ticket is enforced in the use cases (not-yours looks like not-found).
                        .requestMatchers(HttpMethod.POST, "/api/ticket-types/*/reservations").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/payment/requests/*/refund").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/payment/requests").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/payment/requests/by-reservation/*").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/payment/vnpay/sync/*").authenticated()
                        // VNPay's IPN: unauthenticated on purpose (the provider has no JWT); the HMAC is the auth.
                        .requestMatchers(HttpMethod.GET, "/api/payment/vnpay/ipn").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/ticket/*").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/ticket/*/resend").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/ticket/*/transfer").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/ticket-types/*/waitlist").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/waitlist/*").authenticated()
                        .requestMatchers("/api/my/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                        .decoder(jwtDecoder)
                        .jwtAuthenticationConverter(jwtAuthenticationConverter)));
        return http.build();
    }

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
        objectMapper.writeValue(response.getWriter(), ErrorResponse.of(status, message));
    }
}
