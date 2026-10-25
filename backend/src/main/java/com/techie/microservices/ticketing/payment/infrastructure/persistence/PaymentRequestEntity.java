package com.techie.microservices.ticketing.payment.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payment_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_request_id", nullable = false, unique = true)
    private UUID paymentRequestId;

    @Column(name = "reservation_id", nullable = false, unique = true)
    private UUID reservationId;

    @Column(name = "amount_cents", nullable = false)
    private long amountCents;

    @Column(nullable = false)
    private String status;

    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(nullable = false)
    private String provider;

    @Column(name = "txn_ref")
    private String txnRef;

    @Column(name = "provider_txn_no")
    private String providerTxnNo;

    @Column(name = "provider_created_at")
    private String providerCreatedAt;

    @Column(name = "provider_paid_at")
    private String providerPaidAt;

    @Column(name = "pay_expires_at")
    private Instant payExpiresAt;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "refunded_at")
    private Instant refundedAt;
}
