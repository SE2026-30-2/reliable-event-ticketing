package com.techie.microservices.ticketing.payment.application.service;

import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestCommand;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestUseCase;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort;
import com.techie.microservices.ticketing.payment.application.port.PaymentGatewayPort;
import com.techie.microservices.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.techie.microservices.ticketing.payment.application.port.ReservationPricingPort;
import com.techie.microservices.ticketing.payment.domain.exception.ForceOutcomeNotAllowedException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import com.techie.microservices.ticketing.payment.domain.event.PaymentCompletedEvent;
import com.techie.microservices.ticketing.payment.domain.event.PaymentFailedEvent;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Creates and immediately resolves a mock payment for a reservation, in one call: no webhook, no
 * polling - {@link PaymentGatewayPort} is synchronous (there is no real gateway behind it), so the
 * outcome is known before this method returns. The outbox event published here is what actually
 * drives the ticket side of things ({@code catalog.infrastructure.messaging.PaymentEventListener}
 * -> confirm/cancel the reservation); the {@link PaymentRequest} returned to the caller is purely
 * for the buyer's own UI feedback, not what issues the ticket.
 */
@Service
@Slf4j
@Transactional
public class CreatePaymentRequestApplicationService implements CreatePaymentRequestUseCase {

    private final PaymentRequestRepositoryPort paymentRequestRepositoryPort;
    private final PaymentGatewayPort paymentGatewayPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;
    private final ReservationPricingPort reservationPricingPort;
    /** Present only when {@code ticketing.payment.provider=vnpay}; absent = the synchronous mock. */
    private final ObjectProvider<OnlinePaymentPort> onlinePaymentProvider;

    public CreatePaymentRequestApplicationService(PaymentRequestRepositoryPort paymentRequestRepositoryPort,
                                                  PaymentGatewayPort paymentGatewayPort,
                                                  OutboxEventPublisherPort outboxEventPublisherPort,
                                                  ReservationPricingPort reservationPricingPort,
                                                  ObjectProvider<OnlinePaymentPort> onlinePaymentProvider) {
        this.paymentRequestRepositoryPort = paymentRequestRepositoryPort;
        this.paymentGatewayPort = paymentGatewayPort;
        this.outboxEventPublisherPort = outboxEventPublisherPort;
        this.reservationPricingPort = reservationPricingPort;
        this.onlinePaymentProvider = onlinePaymentProvider;
    }

    /** forceOutcome is a demo/test hook - a real deployment must not let any caller pick the result. */
    @Value("${ticketing.payment.allow-force-outcome:false}")
    private boolean allowForceOutcome;

    @Override
    public PaymentRequest createPaymentRequest(CreatePaymentRequestCommand command) {
        // Ownership first, even on the idempotent replay path: knowing a reservation id must not
        // let someone else read (or trigger) its payment.
        reservationPricingPort.assertOwnedBy(command.reservationId(), command.requesterEmail());
        OnlinePaymentPort online = onlinePaymentProvider.getIfAvailable();
        return paymentRequestRepositoryPort.findByReservationId(command.reservationId())
                .map(existing -> withFreshUrl(existing, online, command))
                .orElseGet(() -> online != null ? startOnlinePayment(command, online) : processNewPaymentRequest(command));
    }

    /** Still-open hosted payment: hand back an identical link so a double click or a reload goes to
     * the same page, not a second payment. */
    private PaymentRequest withFreshUrl(PaymentRequest p, OnlinePaymentPort online, CreatePaymentRequestCommand command) {
        if (online != null && p.getStatus() == PaymentStatus.PENDING && p.getPayExpiresAt() != null
                && p.getPayExpiresAt().isAfter(Instant.now())) {
            p.setPaymentUrl(online.buildPaymentUrl(p, command.clientIp()));
        }
        return p;
    }

    /** Online flow: record a PENDING payment and send the buyer to the provider. No outbox event
     * yet - the tickets stay RESERVED until a verified verdict arrives (OnlinePaymentApplicationService). */
    private PaymentRequest startOnlinePayment(CreatePaymentRequestCommand command, OnlinePaymentPort online) {
        if (command.forceOutcome() != null && !command.forceOutcome().isBlank()) {
            throw new ForceOutcomeNotAllowedException(); // there is no pinning a real provider's outcome
        }
        var quote = reservationPricingPort.quote(command.reservationId(), command.requesterEmail());
        if (quote.amountCents() == 0) {
            return completeFree(command.reservationId()); // nothing to charge: no provider involved
        }
        Instant now = Instant.now();
        UUID paymentRequestId = UUID.randomUUID();
        Instant expires = quote.expiresAt() != null ? quote.expiresAt() : now.plus(Duration.ofMinutes(15));
        PaymentRequest saved = paymentRequestRepositoryPort.save(PaymentRequest.builder()
                .paymentRequestId(paymentRequestId)
                .reservationId(command.reservationId())
                .amountCents(quote.amountCents())
                .status(PaymentStatus.PENDING)
                .createdAt(now)
                .provider("VNPAY")
                .txnRef(paymentRequestId.toString().replace("-", ""))
                .providerCreatedAt(com.techie.microservices.ticketing.payment.infrastructure.vnpay.VnpayGateway.formatVnTime(now))
                .payExpiresAt(expires)
                .build());
        saved.setPaymentUrl(online.buildPaymentUrl(saved, command.clientIp()));
        log.info("Online payment {} started for reservation {}", saved.getTxnRef(), command.reservationId());
        return saved;
    }

    private PaymentRequest processNewPaymentRequest(CreatePaymentRequestCommand command) {
        UUID paymentRequestId = UUID.randomUUID();
        Instant now = Instant.now();

        if (command.forceOutcome() != null && !command.forceOutcome().isBlank() && !allowForceOutcome) {
            throw new ForceOutcomeNotAllowedException();
        }
        // Amount comes from the ticket type's price, never from the request; also rejects an
        // unknown, already-resolved or expired reservation before any charge is attempted.
        long amountCents = reservationPricingPort.quote(command.reservationId(), command.requesterEmail()).amountCents();

        if (amountCents == 0) {
            return completeFree(command.reservationId()); // a fully discounted order
        }
        boolean success = paymentGatewayPort.charge(amountCents, command.forceOutcome());
        PaymentRequest paymentRequest = PaymentRequest.builder()
                .paymentRequestId(paymentRequestId)
                .reservationId(command.reservationId())
                .amountCents(amountCents)
                .status(success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED)
                .createdAt(now)
                .completedAt(now)
                .build();
        PaymentRequest saved = paymentRequestRepositoryPort.save(paymentRequest);

        if (success) {
            outboxEventPublisherPort.publish(
                    paymentRequestId.toString(),
                    "payment-completed",
                    "payment-completed",
                    new PaymentCompletedEvent(UUID.randomUUID(), paymentRequestId, command.reservationId()));
        } else {
            outboxEventPublisherPort.publish(
                    paymentRequestId.toString(),
                    "payment-failed",
                    "payment-failed",
                    new PaymentFailedEvent(UUID.randomUUID(), paymentRequestId, command.reservationId(), "declined"));
        }

        log.info("Payment request {} for reservation {} -> {}", paymentRequestId, command.reservationId(), saved.getStatus());
        return saved;
    }

    /** A zero-amount order (100% coupon): completed on the spot, still through the same
     * payment-completed event so ticket issuing has exactly one trigger. */
    private PaymentRequest completeFree(UUID reservationId) {
        UUID paymentRequestId = UUID.randomUUID();
        Instant now = Instant.now();
        PaymentRequest saved = paymentRequestRepositoryPort.save(PaymentRequest.builder()
                .paymentRequestId(paymentRequestId)
                .reservationId(reservationId)
                .amountCents(0)
                .status(PaymentStatus.COMPLETED)
                .createdAt(now)
                .completedAt(now)
                .provider("FREE")
                .build());
        outboxEventPublisherPort.publish(paymentRequestId.toString(), "payment-completed", "payment-completed",
                new PaymentCompletedEvent(UUID.randomUUID(), paymentRequestId, reservationId));
        log.info("Free order for reservation {} completed without a provider", reservationId);
        return saved;
    }
}
