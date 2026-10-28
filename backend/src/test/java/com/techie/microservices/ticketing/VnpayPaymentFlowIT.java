package com.techie.microservices.ticketing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import com.techie.microservices.ticketing.catalog.application.port.CreateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeUseCase;
import com.techie.microservices.ticketing.catalog.application.port.GetTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.catalog.infrastructure.scheduling.ExpireReservationsJob;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestCommand;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestUseCase;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentUseCase;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.payment.infrastructure.vnpay.VnpaySigner;
import org.apache.kafka.clients.admin.NewTopic;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * The VNPay path end to end through real Postgres + Kafka, with VNPay itself replaced by (a) signed
 * IPN parameters built here with the same HMAC scheme and (b) a local HTTP fake for the refund API.
 * Needs Docker: {@code mvn test -Dtest=VnpayPaymentFlowIT}.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, VnpayPaymentFlowIT.KafkaTestConfig.class})
@TestPropertySource(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate",
        "spring.kafka.listener.auto-startup=true",
        "spring.kafka.consumer.auto-offset-reset=earliest",
        "ticketing.payment.provider=vnpay",
        "ticketing.payment.vnpay.tmn-code=TMN",
        "ticketing.payment.vnpay.hash-secret=IT-SECRET",
        "ticketing.payment.vnpay.return-url=http://localhost/return",
        // Keep the background reconciler out of the way; the tests drive settlement explicitly.
        "ticketing.payment.reconcile.interval-ms=3600000"
})
class VnpayPaymentFlowIT {

    private static final String SECRET = "IT-SECRET";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final List<String> REFUND_RESPONSE = List.of("vnp_ResponseId", "vnp_Command", "vnp_ResponseCode",
            "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo",
            "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo");
    private static HttpServer fakeVnpayApi;

    static {
        try {
            fakeVnpayApi = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            fakeVnpayApi.createContext("/api", ex -> {
                Map<String, String> res = new LinkedHashMap<>(Map.of("vnp_ResponseCode", "00", "vnp_Message", "Refund OK"));
                res.put("vnp_SecureHash", new VnpaySigner(SECRET).signPipe(res, REFUND_RESPONSE));
                byte[] body = MAPPER.writeValueAsBytes(res);
                ex.sendResponseHeaders(200, body.length);
                ex.getResponseBody().write(body);
                ex.close();
            });
            fakeVnpayApi.start();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @DynamicPropertySource
    static void fakeApi(DynamicPropertyRegistry registry) {
        registry.add("ticketing.payment.vnpay.api-url", () -> "http://127.0.0.1:" + fakeVnpayApi.getAddress().getPort() + "/api");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class KafkaTestConfig {
        @Bean
        @ServiceConnection
        KafkaContainer kafka() {
            return new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));
        }

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

    private static final String BUYER = "vn-buyer@example.com";

    @Autowired CreateEventUseCase createEvent;
    @Autowired CreateTicketTypeUseCase createTicketType;
    @Autowired ReserveTicketUseCase reserveTickets;
    @Autowired CreatePaymentRequestUseCase createPayment;
    @Autowired OnlinePaymentUseCase onlinePayment;
    @Autowired GetTicketUseCase getTicket;
    @Autowired TicketTypeRepositoryPort ticketTypes;
    @Autowired ExpireReservationsJob expireJob;
    @Autowired JdbcTemplate jdbc;

    private TicketType newTicketType(int quota, long priceCents) {
        var event = createEvent.createEvent(new CreateEventCommand(
                "VN event " + UUID.randomUUID(), "Venue", Instant.now().plus(Duration.ofDays(30)), Instant.now().plus(Duration.ofDays(31))));
        return createTicketType.createTicketType(new CreateTicketTypeCommand(
                event.getEventId(), "GA", priceCents, quota, Instant.now().minusSeconds(60), Instant.now().plus(Duration.ofDays(31))));
    }

    private ReservationResult reserve(TicketType type, int qty) {
        return reserveTickets.reserveTickets(new ReserveTicketCommand(BUYER, type.getTicketTypeId(), qty, "Buyer", "vn-" + UUID.randomUUID() + "@example.com"));
    }

    private Map<String, String> ipn(PaymentRequest p, String responseCode, String txnStatus) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("vnp_TxnRef", p.getTxnRef());
        m.put("vnp_Amount", String.valueOf(p.getAmountCents()));
        m.put("vnp_ResponseCode", responseCode);
        m.put("vnp_TransactionStatus", txnStatus);
        m.put("vnp_TransactionNo", "14000001");
        m.put("vnp_PayDate", "20260101101010");
        m.put("vnp_SecureHash", new VnpaySigner(SECRET).signQuery(m));
        return m;
    }

    private TicketStatus status(ReservationResult r) {
        return getTicket.getTicket(r.tickets().get(0).getTicketId()).getStatus();
    }

    @Test
    void checkoutStartsPendingThenASignedIpnIssuesTicketsAndRepeatedIpnIsHarmless() {
        TicketType type = newTicketType(5, 3_000_000); // 30,000 VND in the system's 1/100 units
        ReservationResult reservation = reserve(type, 2);

        PaymentRequest payment = createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), null, "1.2.3.4"));
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PENDING);
        assertThat(payment.getAmountCents()).isEqualTo(6_000_000L); // 2 x 30,000 VND == vnp_Amount 6000000, no conversion
        assertThat(payment.getPaymentUrl()).contains("vnp_SecureHash=").contains("vnp_TxnRef=" + payment.getTxnRef());
        assertThat(status(reservation)).isEqualTo(TicketStatus.RESERVED); // not issued until a verified verdict

        // asking again returns the same open payment and link, never a second payment
        PaymentRequest again = createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), null, "1.2.3.4"));
        assertThat(again.getPaymentRequestId()).isEqualTo(payment.getPaymentRequestId());
        assertThat(again.getPaymentUrl()).isEqualTo(payment.getPaymentUrl());

        // forged IPN: ignored
        Map<String, String> forged = ipn(payment, "00", "00");
        forged.put("vnp_Amount", "1");
        assertThat(onlinePayment.handleIpn(forged)).containsEntry("RspCode", "97");
        assertThat(status(reservation)).isEqualTo(TicketStatus.RESERVED);

        assertThat(onlinePayment.handleIpn(ipn(payment, "00", "00"))).containsEntry("RspCode", "00");
        await().atMost(Duration.ofSeconds(45)).untilAsserted(() -> assertThat(status(reservation)).isEqualTo(TicketStatus.ISSUED));
        assertThat(getTicket.getTicket(reservation.tickets().get(0).getTicketId()).getQrPayload()).isNotBlank();

        assertThat(onlinePayment.handleIpn(ipn(payment, "00", "00"))).containsEntry("RspCode", "02"); // retry delivery
        assertThat(ticketTypes.findByTicketTypeId(type.getTicketTypeId()).orElseThrow().getIssuedCount()).isEqualTo(2);
    }

    @Test
    void aDeclinedIpnCancelsTheReservationAndReleasesQuota() {
        TicketType type = newTicketType(2, 10_000);
        ReservationResult reservation = reserve(type, 2);
        PaymentRequest payment = createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), null, null));

        onlinePayment.handleIpn(ipn(payment, "24", "02")); // buyer cancelled on the bank page

        await().atMost(Duration.ofSeconds(45)).untilAsserted(() -> assertThat(status(reservation)).isEqualTo(TicketStatus.CANCELLED));
        assertThat(ticketTypes.findByTicketTypeId(type.getTicketTypeId()).orElseThrow().hasRemainingQuota(2)).isTrue();
    }

    @Test
    void theExpirySweepDoesNotCancelAReservationWhoseOnlinePaymentIsStillPendingSoALatePaymentIsHonoured() {
        TicketType type = newTicketType(2, 10_000);
        ReservationResult reservation = reserve(type, 1);
        PaymentRequest payment = createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), null, null));
        jdbc.update("UPDATE tickets SET reservation_expires_at = now() - interval '1 minute' WHERE reservation_id = ?", reservation.reservationId());

        expireJob.expireStaleReservations();
        assertThat(status(reservation)).isEqualTo(TicketStatus.RESERVED); // guarded: the payment owns its fate

        onlinePayment.handleIpn(ipn(payment, "00", "00")); // success lands after the hold lapsed
        await().atMost(Duration.ofSeconds(45)).untilAsserted(() -> assertThat(status(reservation)).isEqualTo(TicketStatus.ISSUED));
    }

    @Test
    void adminRefundMarksPaymentRefundedAndVoidsTheTickets() {
        TicketType type = newTicketType(2, 10_000);
        ReservationResult reservation = reserve(type, 1);
        PaymentRequest payment = createPayment.createPaymentRequest(new CreatePaymentRequestCommand(BUYER, reservation.reservationId(), null, null));
        onlinePayment.handleIpn(ipn(payment, "00", "00"));
        await().atMost(Duration.ofSeconds(45)).untilAsserted(() -> assertThat(status(reservation)).isEqualTo(TicketStatus.ISSUED));

        PaymentRequest refunded = onlinePayment.refund(payment.getPaymentRequestId(), "admin@example.com");

        assertThat(refunded.getStatus()).isEqualTo(PaymentStatus.REFUNDED);
        await().atMost(Duration.ofSeconds(45)).untilAsserted(() -> assertThat(status(reservation)).isEqualTo(TicketStatus.REFUNDED));
    }
}
