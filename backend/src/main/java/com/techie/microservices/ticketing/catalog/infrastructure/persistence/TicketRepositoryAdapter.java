package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TicketRepositoryAdapter implements TicketRepositoryPort {

    private final SpringDataTicketJpaRepository jpaRepository;

    @Override
    public Ticket save(Ticket ticket) {
        return toDomain(jpaRepository.save(toEntity(ticket)));
    }

    @Override
    public Optional<Ticket> findByTicketIdForUpdate(UUID ticketId) {
        return jpaRepository.findByTicketIdForUpdate(ticketId).map(TicketRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<Ticket> findByTicketId(UUID ticketId) {
        return jpaRepository.findByTicketId(ticketId).map(TicketRepositoryAdapter::toDomain);
    }

    @Override
    public Page<Ticket> findByEventId(UUID eventId, Pageable pageable) {
        return jpaRepository.findByEventId(eventId, pageable).map(TicketRepositoryAdapter::toDomain);
    }

    @Override
    public List<Ticket> findByReservationId(UUID reservationId) {
        return jpaRepository.findByReservationId(reservationId).stream()
                .map(TicketRepositoryAdapter::toDomain).toList();
    }

    @Override
    public List<Ticket> findExpiredReservations(Instant before) {
        return jpaRepository.findByStatusAndReservationExpiresAtBefore(TicketStatus.RESERVED.name(), before).stream()
                .map(TicketRepositoryAdapter::toDomain).toList();
    }

    @Override
    public long countActiveReservationsByOwner(String ownerEmail) {
        return jpaRepository.countByOwnerEmailIgnoreCaseAndStatus(ownerEmail, TicketStatus.RESERVED.name());
    }

    @Override
    public long countByEventIdAndStatus(UUID eventId, TicketStatus status) {
        return jpaRepository.countByEventIdAndStatus(eventId, status.name());
    }

    @Override
    public Page<Ticket> findByOwner(String ownerEmail, Pageable pageable) {
        return jpaRepository.findByOwnerEmailIgnoreCase(ownerEmail, pageable).map(TicketRepositoryAdapter::toDomain);
    }

    private static TicketEntity toEntity(Ticket ticket) {
        return TicketEntity.builder()
                .id(ticket.getId())
                .ticketId(ticket.getTicketId())
                .ticketTypeId(ticket.getTicketTypeId())
                .eventId(ticket.getEventId())
                .ownerEmail(ticket.getOwnerEmail())
                .holderName(ticket.getHolderName())
                .holderEmail(ticket.getHolderEmail())
                .status(ticket.getStatus().name())
                .statusReason(ticket.getStatusReason())
                .reservationId(ticket.getReservationId())
                .reservationExpiresAt(ticket.getReservationExpiresAt())
                .issuedAt(ticket.getIssuedAt())
                .validFrom(ticket.getValidFrom())
                .validUntil(ticket.getValidUntil())
                .qrPayload(ticket.getQrPayload())
                .createdAt(ticket.getCreatedAt())
                .source(ticket.getSource())
                .transferredFrom(ticket.getTransferredFrom())
                .transferCount(ticket.getTransferCount())
                .maxEntries(ticket.getMaxEntries())
                .priceCents(ticket.getPriceCents())
                .couponId(ticket.getCouponId())
                .build();
    }

    private static Ticket toDomain(TicketEntity entity) {
        return Ticket.builder()
                .id(entity.getId())
                .ticketId(entity.getTicketId())
                .ticketTypeId(entity.getTicketTypeId())
                .eventId(entity.getEventId())
                .ownerEmail(entity.getOwnerEmail())
                .holderName(entity.getHolderName())
                .holderEmail(entity.getHolderEmail())
                .status(TicketStatus.valueOf(entity.getStatus()))
                .statusReason(entity.getStatusReason())
                .reservationId(entity.getReservationId())
                .reservationExpiresAt(entity.getReservationExpiresAt())
                .issuedAt(entity.getIssuedAt())
                .validFrom(entity.getValidFrom())
                .validUntil(entity.getValidUntil())
                .qrPayload(entity.getQrPayload())
                .createdAt(entity.getCreatedAt())
                .source(entity.getSource())
                .transferredFrom(entity.getTransferredFrom())
                .transferCount(entity.getTransferCount())
                .maxEntries(entity.getMaxEntries())
                .priceCents(entity.getPriceCents())
                .couponId(entity.getCouponId())
                .build();
    }
}
