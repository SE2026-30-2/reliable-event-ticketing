package com.techie.microservices.ticketing.catalog.domain.model;

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
public class Ticket {
    private Long id;
    private UUID ticketId;
    private UUID ticketTypeId;
    private UUID eventId;
    /** The buyer account (JWT subject, lower-cased) - who may see/resend this ticket. Null only for
     * pre-accounts anonymous tickets, which only an ADMIN can read. */
    private String ownerEmail;
    private String holderName;
    private String holderEmail;
    private TicketStatus status;
    private String statusReason;
    /** Groups every ticket created by one reserve call - what a payment outcome correlates against. */
    private UUID reservationId;
    /** Null once the ticket leaves RESERVED (issued, cancelled, or otherwise terminal). */
    private Instant reservationExpiresAt;
    /** Null until the ticket is ISSUED - a RESERVED ticket has no issuance moment yet. */
    private Instant issuedAt;
    private Instant validFrom;
    private Instant validUntil;
    /** The exact signed string placed in the QR code - see infrastructure.security.TicketQrSigner.
     * Null until ISSUED - signing happens at confirm-reservation time, not at reserve time. */
    private String qrPayload;
    private Instant createdAt;
    /** PURCHASE (paid reservation), GUEST (complimentary, issued by the organizer) or TRANSFER. */
    @Builder.Default
    private String source = "PURCHASE";
    /** What this ticket was sold for, after any coupon (cents). */
    private long priceCents;
    /** The coupon redeemed by the reservation this ticket belongs to; null if none. */
    private UUID couponId;
    /** The ticket this one replaced in a transfer; null otherwise. */
    private UUID transferredFrom;
    private int transferCount;
    /** How many times this ticket may be scanned in; 1 = ordinary single-use. */
    @Builder.Default
    private int maxEntries = 1;
}
