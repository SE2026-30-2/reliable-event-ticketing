package com.techie.microservices.ticketing;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Smoke test: the full application context (JPA against an in-memory H2 DB, this service's own
 * RSA QR-signing key generation, Spring Security's OAuth2 resource server verifying user-service's
 * JWKS, Kafka autoconfiguration with listener containers not auto-started, CORS) wires up cleanly
 * end to end. See src/test/resources/application.properties for why this uses H2 rather than the
 * real Postgres Testcontainers wiring in {@link TestcontainersConfiguration} (used instead by
 * {@code TestTicketingPlatformApplication} for local dev runs) - same rationale as order-service's own
 * equivalent test.
 */
@SpringBootTest
class TicketingPlatformApplicationTests {

	@Test
	void contextLoads() {
	}

}
