package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "voided_tickets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoidedTicketEntity {

    @Id
    @Column(name = "ticket_id")
    private UUID ticketId;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "voided_at", nullable = false)
    private Instant voidedAt;
}
