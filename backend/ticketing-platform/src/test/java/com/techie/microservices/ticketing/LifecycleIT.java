package com.techie.microservices.ticketing;

import com.techie.microservices.ticketing.catalog.application.port.CreateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeUseCase;
import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase.Guest;
import com.techie.microservices.ticketing.catalog.application.port.InviteGuestsUseCase.InviteGuestsCommand;
import com.techie.microservices.ticketing.catalog.application.port.ManageCouponsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TransferTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.TransferTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistUseCase;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketNotTransferableException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.domain.model.CouponType;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistStatus;
import com.techie.microservices.ticketing.catalog.infrastructure.scheduling.ExpireReservationsJob;
import com.techie.microservices.ticketing.catalog.infrastructure.scheduling.WaitlistPromotionJob;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceCommand;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceUseCase;
import com.techie.microservices.ticketing.checkin.application.port.SubmitCheckinCommand;
import com.techie.microservices.ticketing.checkin.application.port.SubmitCheckinUseCase;
import com.techie.microservices.ticketing.checkin.domain.model.CheckinOutcome;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestCommand;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestUseCase;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.reporting.application.EventReportService;
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

import java.io.StringWriter;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/**
 * The features layered on the core flow, through real Postgres + Kafka: coupons/bundles/free orders,
 * transfers vs the gate, the waitlist, guests, and the organizer report. Needs Docker:
 * {@code mvn test -Dtest=LifecycleIT}.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, LifecycleIT.KafkaTestConfig.class})
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.kafka.listener.auto-startup=true",
        "spring.kafka.consumer.auto-offset-reset=earliest",
        "ticketing.payment.allow-force-outcome=true",
        "ticketing.transfer.cutoff-minutes-before-start=0"
})
class LifecycleIT {

    @TestConfiguration(proxyBeanMethods = false)
    static class KafkaTestConfig {
        @Bean
        @ServiceConnection
        KafkaContainer kafka() {
            return new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));
        }

        @Bean NewTopic t1() { return new NewTopic("payment-completed", 1, (short) 1); }
        @Bean NewTopic t2() { return new NewTopic("payment-failed", 1, (short) 1); }
        @Bean NewTopic t3() { return new NewTopic("payment-refunded", 1, (short) 1); }
        @Bean NewTopic t4() { return new NewTopic("ticket-issued", 1, (short) 1); }
        @Bean NewTopic t5() { return new NewTopic("ticket-voided", 1, (short) 1); }
        @Bean NewTopic t6() { return new NewTopic("ticket-reserved", 1, (short) 1); }
        @Bean NewTopic t7() { return new NewTopic("ticket-resend-requested", 1, (short) 1); }
        @Bean NewTopic t8() { return new NewTopic("waitlist-offered", 1, (short) 1); }
        @Bean NewTopic t9() { return new NewTopic("email-verification-requested", 1, (short) 1); }
        @Bean NewTopic t10() { return new NewTopic("password-reset-requested", 1, (short) 1); }
    }

    private static final String ORG = "organizer@example.com";

    @Autowired CreateEventUseCase createEvent;
    @Autowired CreateTicketTypeUseCase createTicketType;
    @Autowired ReserveTicketUseCase reserve;
    @Autowired CreatePaymentRequestUseCase pay;
    @Autowired GetTicketUseCase getTicket;
    @Autowired TicketTypeRepositoryPort types;
    @Autowired ManageCouponsUseCase coupons;
    @Autowired TransferTicketUseCase transfer;
    @Autowired WaitlistUseCase waitlist;
    @Autowired WaitlistPromotionJob waitlistJob;
    @Autowired ExpireReservationsJob expireJob;
    @Autowired InviteGuestsUseCase invite;
    @Autowired RegisterDeviceUseCase registerDevice;
    @Autowired SubmitCheckinUseCase submitCheckin;
    @Autowired EventReportService report;
    @Autowired JdbcTemplate jdbc;

    private UUID newEvent() {
        return createEvent.createEvent(new CreateEventCommand("LC event " + UUID.randomUUID(), "Venue",
                Instant.now().plus(Duration.ofDays(30)), Instant.now().plus(Duration.ofDays(31)),
                ORG, "d", null, null)).getEventId();
    }

    private TicketType newType(UUID eventId, int quota, long price, int maxEntries, int bundle) {
        return createTicketType.createTicketType(new CreateTicketTypeCommand(eventId, "T-" + UUID.randomUUID(), price, quota,
                Instant.now().minusSeconds(60), Instant.now().plus(Duration.ofDays(31)), maxEntries, bundle));
    }

    private ReservationResult reserve(UUID typeId, String owner, int qty, String coupon) {
        return reserve.reserveTickets(new ReserveTicketCommand(owner, typeId, qty, "Holder", owner, coupon));
    }

    private void payAndWaitIssued(ReservationResult r, String owner) {
        pay.createPaymentRequest(new CreatePaymentRequestCommand(owner, r.reservationId(), "COMPLETED"));
        await().atMost(Duration.ofSeconds(45)).untilAsserted(() ->
                r.tickets().forEach(t -> assertThat(getTicket.getTicket(t.getTicketId()).getStatus()).isEqualTo(TicketStatus.ISSUED)));
    }

    private String deviceKeyFor(UUID eventId) {
        return registerDevice.registerDevice(new RegisterDeviceCommand("gate", eventId, ORG)).plaintextApiKey();
    }

    private CheckinOutcome scan(String key, String qr) {
        return submitCheckin.submitCheckin(new SubmitCheckinCommand(key, qr, UUID.randomUUID(), Instant.now())).getOutcome();
    }

    @Test
    void aFullyDiscountedBundleOrderCompletesWithoutAProviderAndIssuesEveryTicket() {
        UUID eventId = newEvent();
        TicketType type = newType(eventId, 10, 1_000_000, 1, 2); // a pack of 2
        coupons.createCoupon(new ManageCouponsUseCase.CreateCouponCommand(eventId, "FREE100", CouponType.PERCENT, 100, null, 1, null, null, ORG));

        ReservationResult r = reserve(type.getTicketTypeId(), "buyer@example.com", 1, "free100");
        assertThat(r.tickets()).hasSize(2);
        assertThat(r.totalCents()).isZero();
        assertThat(r.discountCents()).isEqualTo(1_000_000);

        var payment = pay.createPaymentRequest(new CreatePaymentRequestCommand("buyer@example.com", r.reservationId(), null));
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(payment.getProvider()).isEqualTo("FREE");
        await().atMost(Duration.ofSeconds(45)).untilAsserted(() ->
                r.tickets().forEach(t -> assertThat(getTicket.getTicket(t.getTicketId()).getStatus()).isEqualTo(TicketStatus.ISSUED)));

        // the single redemption is used up: a second buyer is refused with a reason
        assertThatThrownBy(() -> reserve(type.getTicketTypeId(), "other@example.com", 1, "FREE100"))
                .hasMessageContaining("fully redeemed");
        assertThat(types.findByTicketTypeId(type.getTicketTypeId()).orElseThrow().getIssuedCount()).isEqualTo(2);
    }

    @Test
    void aTransferKillsTheOldQrAtTheGateAndTheNewOneWorksAndAScannedTicketCannotBeTransferred() {
        UUID eventId = newEvent();
        TicketType type = newType(eventId, 5, 100_000, 1, 1);
        String key = deviceKeyFor(eventId);

        ReservationResult r = reserve(type.getTicketTypeId(), "alice@example.com", 1, null);
        payAndWaitIssued(r, "alice@example.com");
        Ticket original = getTicket.getTicket(r.tickets().get(0).getTicketId());

        Ticket moved = transfer.transferTicket(new TransferTicketCommand(original.getTicketId(), "alice@example.com", "bob@example.com", "Bob"));

        assertThat(scan(key, original.getQrPayload())).isEqualTo(CheckinOutcome.TICKET_VOIDED); // takes effect at once, no Kafka lag
        assertThat(scan(key, moved.getQrPayload())).isEqualTo(CheckinOutcome.ACCEPTED);
        assertThat(types.findByTicketTypeId(type.getTicketTypeId()).orElseThrow().getIssuedCount()).isEqualTo(1); // quota unchanged

        // a ticket already used at the gate cannot be moved
        ReservationResult r2 = reserve(type.getTicketTypeId(), "carol@example.com", 1, null);
        payAndWaitIssued(r2, "carol@example.com");
        Ticket used = getTicket.getTicket(r2.tickets().get(0).getTicketId());
        assertThat(scan(key, used.getQrPayload())).isEqualTo(CheckinOutcome.ACCEPTED);
        assertThatThrownBy(() -> transfer.transferTicket(new TransferTicketCommand(used.getTicketId(), "carol@example.com", "dave@example.com", null)))
                .isInstanceOf(TicketNotTransferableException.class).hasMessageContaining("already been used");
    }

    @Test
    void aMultiEntryPassAdmitsItsEntriesThenReportsAllUsed() {
        UUID eventId = newEvent();
        TicketType type = newType(eventId, 5, 0, 2, 1);
        String key = deviceKeyFor(eventId);
        var tickets = invite.inviteGuests(new InviteGuestsCommand(eventId, type.getTicketTypeId(), List.of(new Guest("VIP", "vip@example.com")), ORG));
        String qr = tickets.get(0).getQrPayload();

        assertThat(scan(key, qr)).isEqualTo(CheckinOutcome.ACCEPTED);
        assertThat(scan(key, qr)).isEqualTo(CheckinOutcome.ACCEPTED);
        assertThat(scan(key, qr)).isEqualTo(CheckinOutcome.DUPLICATE);
    }

    @Test
    void theWaitlistOffersFreedQuotaToThePersonInLineAndKeepsOtherBuyersFromSnipingIt() {
        UUID eventId = newEvent();
        TicketType type = newType(eventId, 1, 100_000, 1, 1);
        ReservationResult holder = reserve(type.getTicketTypeId(), "a@example.com", 1, null);

        assertThatThrownBy(() -> reserve(type.getTicketTypeId(), "b@example.com", 1, null)).isInstanceOf(TicketTypeSoldOutException.class);
        var entry = waitlist.join(new WaitlistUseCase.JoinWaitlistCommand("b@example.com", type.getTicketTypeId(), 1, "B", "b@example.com"));
        assertThat(entry.getStatus()).isEqualTo(WaitlistStatus.WAITING);

        // A's hold lapses; the quota is freed
        jdbc.update("UPDATE tickets SET reservation_expires_at = now() - interval '1 minute' WHERE reservation_id = ?", holder.reservationId());
        expireJob.expireStaleReservations();

        // before the waitlist job runs, a stranger cannot grab what B is queued for
        assertThatThrownBy(() -> reserve(type.getTicketTypeId(), "sniper@example.com", 1, null)).isInstanceOf(TicketTypeSoldOutException.class);

        waitlistJob.run();
        var offered = waitlist.listMine("b@example.com").get(0);
        assertThat(offered.getStatus()).isEqualTo(WaitlistStatus.OFFERED);
        assertThat(jdbc.queryForObject("SELECT status FROM tickets WHERE reservation_id = ? LIMIT 1", String.class, offered.getReservationId())).isEqualTo("RESERVED");

        payAndWaitIssued(new ReservationResult(offered.getReservationId(),
                jdbc.queryForList("SELECT ticket_id FROM tickets WHERE reservation_id = ?", UUID.class, offered.getReservationId()).stream()
                        .map(id -> Ticket.builder().ticketId(id).build()).toList()), "b@example.com");
        waitlistJob.run();
        assertThat(waitlist.listMine("b@example.com").get(0).getStatus()).isEqualTo(WaitlistStatus.CONVERTED);
    }

    @Test
    void theOrganizerReportAddsUpPaymentsGuestsAndCheckInsAndTheCsvDefusesFormulas() {
        UUID eventId = newEvent();
        TicketType type = newType(eventId, 10, 200_000, 1, 1);
        String key = deviceKeyFor(eventId);

        ReservationResult r = reserve.reserveTickets(new ReserveTicketCommand("buyer@example.com", type.getTicketTypeId(), 2, "=cmd|' /C calc'!A0", "buyer@example.com"));
        payAndWaitIssued(r, "buyer@example.com");
        var guests = invite.inviteGuests(new InviteGuestsCommand(eventId, type.getTicketTypeId(), List.of(new Guest("Guest One", "g1@example.com")), ORG));
        scan(key, getTicket.getTicket(r.tickets().get(0).getTicketId()).getQrPayload());
        scan(key, guests.get(0).getQrPayload());

        var rep = report.report(eventId);
        assertThat(rep.totals().ticketsIssued()).isEqualTo(3);
        assertThat(rep.totals().guestTickets()).isEqualTo(1);
        assertThat(rep.totals().checkedIn()).isEqualTo(2);
        assertThat(rep.totals().noShow()).isEqualTo(1);
        assertThat(rep.totals().collectedCents()).isEqualTo(400_000);
        assertThat(rep.totals().netRevenueCents()).isEqualTo(400_000);
        assertThat(rep.ticketTypes().get(0).revenueCents()).isEqualTo(400_000); // guests are free

        StringWriter csv = new StringWriter();
        report.writeAttendeesCsv(eventId, csv);
        assertThat(csv.toString()).contains("ticket_id,ticket_type").contains("Guest One").contains("'=cmd"); // formula neutralised
        assertThat(csv.toString().split("\r\n")).hasSize(1 + 3);
        StringWriter pays = new StringWriter();
        report.writePaymentsCsv(eventId, pays);
        assertThat(pays.toString()).contains("buyer@example.com").contains("400000");
    }
}
