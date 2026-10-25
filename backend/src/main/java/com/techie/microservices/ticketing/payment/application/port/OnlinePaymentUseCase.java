package com.techie.microservices.ticketing.payment.application.port;

import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;

import java.util.Map;
import java.util.UUID;

/** Everything that happens to a payment after the buyer was sent to the provider's page. */
public interface OnlinePaymentUseCase {

    /** Provider server-to-server callback. Returns the {RspCode, Message} the provider expects;
     * never throws for a bad/unknown/duplicate callback (the provider would just retry forever). */
    Map<String, String> handleIpn(Map<String, String> params);

    /** The buyer came back from the provider: ask the provider what happened (IPN may be late or
     * unreachable) and settle. Owner-only (anyone else gets not-found). */
    PaymentRequest sync(String txnRef, String requesterEmail);

    /** Current state of the payment for a reservation, owner-only. */
    PaymentRequest getByReservation(UUID reservationId, String requesterEmail);

    /** Admin: full refund of a COMPLETED online payment; voids the tickets via an event. */
    PaymentRequest refund(UUID paymentRequestId, String requestedBy);

    /** Scheduled safety net: resolve stuck PENDING payments, retry orphan refunds. */
    void reconcile();
}
