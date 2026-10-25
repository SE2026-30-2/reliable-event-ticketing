package com.techie.microservices.ticketing;

import com.techie.microservices.ticketing.catalog.application.port.CreateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeUseCase;
import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.exception.ReservationNotPayableException;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.catalog.infrastructure.scheduling.ExpireReservationsJob;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestCommand;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestUseCase;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.shared.infrastructure.messaging.OutboxCleanupJob;
import org.apache.kafka.clients.admin.NewTopic;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/**
 * The flow everything else depends on, end to end through REAL Postgres and REAL Kafka (outbox row
 * -> relay -> broker -> @KafkaListener -> state change): paid reservations become ISSUED tickets
 * with a signed QR and moved quota; failed/expired ones are cancelled and their quota released.
 * Needs Docker, so - like CheckinRecordConcurrencyIT - it is not in the default {@code mvn test}
 * run: {@code mvn test -Dtest=ReservationPaymentFlowIT}.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, ReservationPaymentFlowIT.KafkaTestConfig.class})
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.kafka.listener.auto-startup=true",
        // A listener that subscribes a moment after the first event must still see it.
        "spring.kafka.consumer.auto-offset-reset=earliest",
        "ticketing.payment.allow-force-outcome=true",
        "ticketing.payment.success-rate=1.0"
})
class ReservationPaymentFlowIT {

    @TestConfiguration(proxyBeanMethods = false)
    static class KafkaTestConfig {
        @Bean
        @ServiceConnection
        KafkaContainer kafka() {
            return new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));
        }

        // Pre-created so listeners never wait on a metadata refresh to discover a new topic.
        @Bean
        NewTopic paymentCompleted() { return new NewTopic("payment-completed", 1, (short) 1); }
        @Bean
        NewTopic paymentFailed() { return new NewTopic("payment-failed", 1, (short) 1); }
        @Bean
        NewTopic paymentRefunded() { return new NewTopic("payment-refunded", 1, (short) 1); }
        @Bean
        NewTopic ticketIssued() { return new NewTopic("ticket-issued", 1, (short) 1); }
        @Bean
        NewTopic ticketVoided() { return new NewTopic("ticket-voided", 1, (short) 1); }
        @Bean
        NewTopic ticketReserved() { return new NewTopic("ticket-reserved", 1, (short) 1); }
        @Bean
        NewTopic ticketResend() { return new NewTopic("ticket-resend-requested", 1, (short) 1); }
        @Bean
        NewTopic emailVerification() { return new NewTopic("email-verification-requested", 1, (short) 1); }
        @Bean
        NewTopic passwordReset() { return new NewTopic("password-reset-requested", 1, (short) 1); }
    }

    private static final String BUYER = "it-buyer@example.com";

    @Autowired CreateEventUseCase createEvent;
    @Autowired CreateTicketTypeUseCase createTicketType;
    @Autowired ReserveTicketUseCase reserveTickets;
    @Autowired CreatePaymentRequestUseCase createPayment;
    @Autowired GetTicketUseCase getTicket;
    @Autowired TicketTypeRepositoryPort ticketTypes;
    @Autowired ExpireReservationsJob expireJob;
    @Autowired OutboxCleanupJob outboxCleanup;
    @Autowired JdbcTemplate jdbc;

    private TicketType newTicketType(int quota, long priceCents) {
        var event = createEvent.createEvent(new CreateEventCommand(
                "IT event " + UUID.randomUUID(), "Venue", Instant.now().plus(Duration.ofDays(30)), Instant.now().plus(Duration.ofDays(31))));
        return createTicketType.createTicketType(new CreateTicketTypeCommand(
                event.getEventId(), "GA", priceCents, quota, Instant.now().minusSeconds(60), Instant.now().plus(Duration.ofDays(31))));
    }

    private ReservationResult reserve(TicketType type, int quantity) {
        return reserveTickets.reserveTickets(new ReserveTicketCommand(BUYER, type.getTicketTypeId(), quantity, "Buyer", "it-" + UUID.randomUUID() + "@example.com"));
    }

    private TicketType reload(TicketType type) {
        return ticketTypes.findByTicketTypeId(type.getTicketTypeId()).orElseThrow();
    }

    @Test
    void aPaidReservationBecomesIssuedTicketsWithSignedQrAndMovedQuota() {
        TicketType type = newTicketType(5, 25_000);
        ReservationResult reservation = reserve(type, 2);

        assertThat(reload(type).getReservedCount()).isEqualTo(2);
        var payment = createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), "COMPLETED"));
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(payment.getAmountCents()).isEqualTo(50_000); // price x quantity, computed by the server

        await().atMost(Duration.ofSeconds(45)).untilAsserted(() ->
                reservation.tickets().forEach(t -> assertThat(getTicket.getTicket(t.getTicketId()).getStatus()).isEqualTo(TicketStatus.ISSUED)));

        reservation.tickets().forEach(t -> {
            var issued = getTicket.getTicket(t.getTicketId());
            assertThat(issued.getQrPayload()).isNotBlank();
            assertThat(issued.getIssuedAt()).isNotNull();
        });
        TicketType after = reload(type);
        assertThat(after.getReservedCount()).isZero();
        assertThat(after.getIssuedCount()).isEqualTo(2);
    }

    @Test
    void aFailedPaymentCancelsTheReservationAndReleasesItsQuota() {
        TicketType type = newTicketType(3, 1_000);
        ReservationResult reservation = reserve(type, 3);

        createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), "FAILED"));

        await().atMost(Duration.ofSeconds(45)).untilAsserted(() ->
                assertThat(getTicket.getTicket(reservation.tickets().get(0).getTicketId()).getStatus()).isEqualTo(TicketStatus.CANCELLED));
        TicketType after = reload(type);
        assertThat(after.getReservedCount()).isZero();
        assertThat(after.getIssuedCount()).isZero();
        assertThat(after.hasRemainingQuota(3)).isTrue(); // the whole quota is buyable again
    }

    @Test
    void anExpiredReservationCannotBePaidAndTheSweeperReleasesItsQuota() {
        TicketType type = newTicketType(2, 1_000);
        ReservationResult reservation = reserve(type, 2);
        jdbc.update("UPDATE tickets SET reservation_expires_at = now() - interval '1 minute' WHERE reservation_id = ?",
                reservation.reservationId());

        assertThatThrownBy(() -> createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), null)))
                .isInstanceOf(ReservationNotPayableException.class);

        expireJob.expireStaleReservations();

        assertThat(getTicket.getTicket(reservation.tickets().get(0).getTicketId()).getStatus()).isEqualTo(TicketStatus.CANCELLED);
        assertThat(reload(type).getReservedCount()).isZero();
    }

    @Test
    void outboxCleanupDeletesOldPublishedRowsButNeverUnpublishedOnes() {
        UUID oldPublished = UUID.randomUUID();
        UUID oldUnpublished = UUID.randomUUID();
        for (UUID id : new UUID[]{oldPublished, oldUnpublished}) {
            jdbc.update("INSERT INTO outbox_events (event_id, aggregate_id, event_type, topic, payload) VALUES (?, 'x', 'test', 'test-topic', '{}')", id);
        }
        jdbc.update("UPDATE outbox_events SET published_at = now() - interval '30 days' WHERE event_id = ?", oldPublished);

        outboxCleanup.deleteOldPublishedEvents();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE event_id = ?", Integer.class, oldPublished)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM outbox_events WHERE event_id = ?", Integer.class, oldUnpublished)).isEqualTo(1);
    }
}
