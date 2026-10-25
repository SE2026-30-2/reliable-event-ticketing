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
@Table(name = "waitlist_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WaitlistEntryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_id", nullable = false, unique = true)
    private UUID entryId;

    @Column(name = "ticket_type_id", nullable = false)
    private UUID ticketTypeId;

    @Column(name = "owner_email", nullable = false)
    private String ownerEmail;

    @Column(name = "holder_name", nullable = false)
    private String holderName;

    @Column(name = "holder_email", nullable = false)
    private String holderEmail;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private String status;

    @Column(name = "reservation_id")
    private UUID reservationId;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "offered_at")
    private Instant offeredAt;

    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;
}
