package com.techie.microservices.ticketing.payment.application.service;

import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort.ProviderTransaction;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort.TransactionState;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentUseCase;
import com.techie.microservices.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.techie.microservices.ticketing.payment.application.port.ReservationPricingPort;
import com.techie.microservices.ticketing.payment.domain.event.PaymentCompletedEvent;
import com.techie.microservices.ticketing.payment.domain.event.PaymentFailedEvent;
import com.techie.microservices.ticketing.payment.domain.event.PaymentRefundedEvent;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotFoundException;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotRefundableException;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Settles online payments. Three things can tell us the outcome - the provider's IPN, the buyer's
 * return trip (which asks the provider), and the reconciliation job (same question, on a timer) -
 * and all funnel into {@link #settle}, which only ever moves a PENDING payment, so whichever
 * arrives first wins and the rest are harmless no-ops (IPNs are retried and can duplicate).
 *
 * <p>Never trusts the browser: the return URL's query string is not used for state at all - only
 * a signed IPN or a signed query response from the provider is.
 */
@Service
@ConditionalOnProperty(name = "ticketing.payment.provider", havingValue = "vnpay")
@Slf4j
@Transactional
public class OnlinePaymentApplicationService implements OnlinePaymentUseCase {

    private final PaymentRequestRepositoryPort repository;
    private final OnlinePaymentPort provider;
    private final OutboxEventPublisherPort outbox;
    private final ReservationPricingPort reservations;
    private final Duration queryAfter;
    private final Duration expiryGrace;

    public OnlinePaymentApplicationService(PaymentRequestRepositoryPort repository, OnlinePaymentPort provider,
                                           OutboxEventPublisherPort outbox, ReservationPricingPort reservations,
                                           @Value("${ticketing.payment.reconcile.query-after-seconds:90}") long queryAfterSeconds,
                                           @Value("${ticketing.payment.reconcile.expiry-grace-seconds:120}") long expiryGraceSeconds) {
        this.repository = repository;
        this.provider = provider;
        this.outbox = outbox;
        this.reservations = reservations;
        this.queryAfter = Duration.ofSeconds(queryAfterSeconds);
        this.expiryGrace = Duration.ofSeconds(expiryGraceSeconds);
    }

    // ---- IPN ----------------------------------------------------------------------------

    @Override
    public Map<String, String> handleIpn(Map<String, String> params) {
        var callback = provider.verifyCallback(params);
        if (callback.isEmpty()) {
            log.warn("IPN rejected: bad signature or malformed");
            return rsp("97", "Invalid signature");
        }
        var cb = callback.get();
        var payment = repository.findByTxnRef(cb.txnRef());
        if (payment.isEmpty()) {
            return rsp("01", "Order not found");
        }
        PaymentRequest p = payment.get();
        if (p.getAmountCents() != cb.amountCents()) {
            log.error("IPN amount mismatch for {}: expected {} got {}", cb.txnRef(), p.getAmountCents(), cb.amountCents());
            return rsp("04", "Invalid amount");
        }
        if (p.getStatus() != PaymentStatus.PENDING) {
            return rsp("02", "Order already confirmed"); // duplicate delivery - already settled
        }
        settle(p, cb.success(), cb.providerTxnNo(), cb.payDate(), cb.success() ? null : "provider code " + cb.responseCode());
        return rsp("00", "Confirm Success");
    }

    // ---- buyer return trip --------------------------------------------------------------

    @Override
    public PaymentRequest sync(String txnRef, String requesterEmail) {
        PaymentRequest p = repository.findByTxnRef(txnRef).orElseThrow(() -> new PaymentNotFoundException(txnRef));
        reservations.assertOwnedBy(p.getReservationId(), requesterEmail);
        if (p.getStatus() == PaymentStatus.PENDING) {
            try {
                resolveByQuery(p, false);
            } catch (RuntimeException e) {
                // Provider unreachable: report the still-pending state; the buyer polls, IPN/job settle it.
                log.warn("Sync of {} could not reach the provider: {}", txnRef, e.getMessage());
            }
        }
        return repository.findByTxnRef(txnRef).orElse(p);
    }

    @Override
    @Transactional(readOnly = true)
    public PaymentRequest getByReservation(UUID reservationId, String requesterEmail) {
        reservations.assertOwnedBy(reservationId, requesterEmail);
        return repository.findByReservationId(reservationId).orElseThrow(() -> new PaymentNotFoundException(reservationId.toString()));
    }

    // ---- admin refund -------------------------------------------------------------------

    @Override
    public PaymentRequest refund(UUID paymentRequestId, String requestedBy) {
        PaymentRequest p = repository.findByPaymentRequestId(paymentRequestId)
                .orElseThrow(() -> new PaymentNotFoundException(paymentRequestId.toString()));
        if (!"VNPAY".equals(p.getProvider()) || p.getStatus() != PaymentStatus.COMPLETED) {
            throw new PaymentNotRefundableException("Only a COMPLETED VNPAY payment can be refunded (status " + p.getStatus() + ")");
        }
        var result = provider.refund(p, requestedBy);
        if (!result.accepted()) {
            throw new PaymentNotRefundableException("VNPay refused the refund: " + result.message());
        }
        p.setStatus(PaymentStatus.REFUNDED);
        p.setRefundedAt(Instant.now());
        repository.save(p);
        // Voiding the tickets is catalog's job, triggered by this event, like every other transition.
        outbox.publish(p.getPaymentRequestId().toString(), "payment-refunded", "payment-refunded",
                new PaymentRefundedEvent(UUID.randomUUID(), p.getPaymentRequestId(), p.getReservationId()));
        log.info("Payment {} refunded by {} ({})", paymentRequestId, requestedBy, result.message());
        return p;
    }

    // ---- reconciliation -----------------------------------------------------------------

    @Override
    public void reconcile() {
        Instant now = Instant.now();
        for (PaymentRequest p : repository.findByStatusAndProvider(PaymentStatus.PENDING, "VNPAY")) {
            boolean old = p.getCreatedAt().plus(queryAfter).isBefore(now);
            boolean pastDeadline = p.getPayExpiresAt() != null && p.getPayExpiresAt().plus(expiryGrace).isBefore(now);
            if (!old && !pastDeadline) {
                continue;
            }
            try {
                resolveByQuery(p, pastDeadline);
            } catch (RuntimeException e) {
                log.warn("Reconcile of {} failed, will retry: {}", p.getTxnRef(), e.getMessage());
            }
        }
        // Money taken for a reservation we could not honour: give it back.
        for (PaymentRequest p : repository.findByStatusAndProvider(PaymentStatus.REFUND_REQUIRED, "VNPAY")) {
            try {
                var result = provider.refund(p, "system");
                if (result.accepted()) {
                    p.setStatus(PaymentStatus.REFUNDED);
                    p.setRefundedAt(now);
                    repository.save(p);
                    log.info("Orphan payment {} auto-refunded", p.getTxnRef());
                } else {
                    log.error("Orphan payment {} needs a manual refund: {}", p.getTxnRef(), result.message());
                }
            } catch (RuntimeException e) {
                log.warn("Auto-refund of {} failed, will retry: {}", p.getTxnRef(), e.getMessage());
            }
        }
    }

    // ---- internals ----------------------------------------------------------------------

    /** Asks the provider. With {@code pastDeadline}, "no record" / "still pending" means the buyer
     * never finished - fail it so the reservation is freed instead of being held forever. */
    private void resolveByQuery(PaymentRequest p, boolean pastDeadline) {
        ProviderTransaction tx = provider.query(p);
        if (tx.state() == TransactionState.SUCCESS) {
            if (tx.amountCents() != p.getAmountCents()) {
                log.error("Query amount mismatch for {}: expected {} got {}", p.getTxnRef(), p.getAmountCents(), tx.amountCents());
                return;
            }
            settle(p, true, tx.providerTxnNo(), tx.payDate(), null);
        } else if (tx.state() == TransactionState.FAILED) {
            settle(p, false, tx.providerTxnNo(), tx.payDate(), "provider: " + tx.message());
        } else if (pastDeadline) {
            settle(p, false, null, null, "payment window expired");
        }
    }

    private void settle(PaymentRequest p, boolean success, String providerTxnNo, String payDate, String failureReason) {
        if (p.getStatus() != PaymentStatus.PENDING) {
            return;
        }
        Instant now = Instant.now();
        p.setCompletedAt(now);
        p.setProviderTxnNo(providerTxnNo);
        p.setProviderPaidAt(payDate);
        if (success && reservations.isStillHeld(p.getReservationId())) {
            p.setStatus(PaymentStatus.COMPLETED);
            repository.save(p);
            outbox.publish(p.getPaymentRequestId().toString(), "payment-completed", "payment-completed",
                    new PaymentCompletedEvent(UUID.randomUUID(), p.getPaymentRequestId(), p.getReservationId()));
        } else if (success) {
            // Paid, but the reservation is gone (cancelled meanwhile): never keep money for nothing.
            p.setStatus(PaymentStatus.REFUND_REQUIRED);
            p.setFailureReason("paid but reservation no longer held");
            repository.save(p);
            log.error("Payment {} succeeded but reservation {} is not held - refund required", p.getTxnRef(), p.getReservationId());
        } else {
            p.setStatus(PaymentStatus.FAILED);
            p.setFailureReason(failureReason);
            repository.save(p);
            outbox.publish(p.getPaymentRequestId().toString(), "payment-failed", "payment-failed",
                    new PaymentFailedEvent(UUID.randomUUID(), p.getPaymentRequestId(), p.getReservationId(),
                            failureReason == null ? "declined" : failureReason));
        }
        log.info("Payment {} settled -> {}", p.getTxnRef(), p.getStatus());
    }

    private static Map<String, String> rsp(String code, String message) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("RspCode", code);
        m.put("Message", message);
        return m;
    }
}
