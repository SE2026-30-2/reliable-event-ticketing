package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

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
@Table(name = "tickets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false, unique = true)
    private UUID ticketId;

    @Column(name = "ticket_type_id", nullable = false)
    private UUID ticketTypeId;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "owner_email")
    private String ownerEmail;

    @Column(name = "holder_name")
    private String holderName;

    @Column(name = "holder_email")
    private String holderEmail;

    @Column(nullable = false)
    private String status;

    @Column(name = "status_reason", columnDefinition = "TEXT")
    private String statusReason;

    @Column(name = "reservation_id")
    private UUID reservationId;

    @Column(name = "reservation_expires_at")
    private Instant reservationExpiresAt;

    @Column(name = "issued_at")
    private Instant issuedAt;

    @Column(name = "valid_from", nullable = false)
    private Instant validFrom;

    @Column(name = "valid_until", nullable = false)
    private Instant validUntil;

    @Column(name = "qr_payload", columnDefinition = "TEXT")
    private String qrPayload;

    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private String source;

    @Column(name = "transferred_from")
    private UUID transferredFrom;

    @Column(name = "transfer_count", nullable = false)
    private int transferCount;

    @Column(name = "max_entries", nullable = false)
    private int maxEntries;

    @Column(name = "price_cents", nullable = false)
    private long priceCents;

    @Column(name = "coupon_id")
    private UUID couponId;
}
