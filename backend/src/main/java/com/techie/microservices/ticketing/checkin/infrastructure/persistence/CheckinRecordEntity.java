package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

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

/** Append-only by convention (no update/delete code path anywhere in this module) - this table IS
 * the audit log, see domain.model.CheckinRecord. */
@Entity
@Table(name = "checkin_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckinRecordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id")
    private UUID ticketId;

    @Column(name = "event_id")
    private UUID eventId;

    @Column(name = "device_id")
    private UUID deviceId;

    @Column(name = "idempotency_key", nullable = false, unique = true)
    private UUID idempotencyKey;

    @Column(name = "client_checkin_at")
    private Instant clientCheckinAt;

    @Column(name = "server_received_at", nullable = false)
    private Instant serverReceivedAt;

    @Column(nullable = false)
    private String outcome;

    @Column(columnDefinition = "TEXT")
    private String detail;

    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "entry_no")
    private Integer entryNo;
}
