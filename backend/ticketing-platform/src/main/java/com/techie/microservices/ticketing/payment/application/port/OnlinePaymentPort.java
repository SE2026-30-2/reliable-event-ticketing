package com.techie.microservices.ticketing.payment.application.port;

import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;

import java.util.Map;
import java.util.Optional;

/**
 * A provider where the buyer pays on the provider's hosted page and the verdict arrives later
 * (server-to-server callback, or by asking the provider) - as opposed to {@link PaymentGatewayPort},
 * the synchronous mock. Money amounts are in this system's "cents" = VND x 100, which is exactly
 * VNPay's {@code vnp_Amount} convention, so no conversion happens anywhere.
 */
public interface OnlinePaymentPort {

    /** Hosted-page URL for this payment. Deterministic for a given stored payment (same created
     * date, expiry and reference), so asking again returns an identical, still-valid link. */
    String buildPaymentUrl(PaymentRequest payment, String clientIp);

    /** Verifies the provider's signature on a callback (IPN) and extracts it; empty = not authentic. */
    Optional<ProviderCallback> verifyCallback(Map<String, String> params);

    /** Asks the provider what actually happened to this payment (authoritative, server-to-server). */
    ProviderTransaction query(PaymentRequest payment);

    /** Requests a full refund. */
    RefundResult refund(PaymentRequest payment, String requestedBy);

    record ProviderCallback(String txnRef, long amountCents, boolean success, String providerTxnNo,
                            String payDate, String responseCode) {
    }

    enum TransactionState {
        SUCCESS,
        /** The provider says it failed, was reversed, or was flagged. */
        FAILED,
        /** Started but not finished (buyer still on the page, or bank still processing). */
        PENDING,
        /** The provider has no record - the buyer never reached the page, or abandoned it. */
        NOT_FOUND
    }

    record ProviderTransaction(TransactionState state, long amountCents, String providerTxnNo, String payDate, String message) {
    }

    record RefundResult(boolean accepted, String message) {
    }
}
