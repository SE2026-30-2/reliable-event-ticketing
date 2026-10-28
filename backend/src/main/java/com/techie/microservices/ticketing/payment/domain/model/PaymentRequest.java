package com.techie.microservices.ticketing.payment.domain.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentRequest {
    private Long id;
    private UUID paymentRequestId;
    /** UNIQUE - one payment attempt per reservation; a repeated request for the same
     * reservation returns the existing outcome instead of processing twice (see
     * CreatePaymentRequestApplicationService). */
    private UUID reservationId;
    private long amountCents;
    private PaymentStatus status;
    private Instant createdAt;
    private Instant completedAt;
    /** MOCK (synchronous, no real money) or VNPAY. */
    private String provider;
    /** Our reference at the provider (vnp_TxnRef); null for MOCK. */
    private String txnRef;
    private String providerTxnNo;
    /** Provider-format timestamps (yyyyMMddHHmmss, GMT+7) kept verbatim - the provider's follow-up
     * APIs (query, refund) require the original value, not a reformatted instant. */
    private String providerCreatedAt;
    private String providerPaidAt;
    private Instant payExpiresAt;
    private String failureReason;
    private Instant refundedAt;
    /** Hosted payment page to send the buyer to; derived on demand, never persisted. */
    private String paymentUrl;
}
