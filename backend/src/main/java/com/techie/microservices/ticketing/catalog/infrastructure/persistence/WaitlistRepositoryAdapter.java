package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import com.techie.microservices.ticketing.catalog.application.port.WaitlistRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class WaitlistRepositoryAdapter implements WaitlistRepositoryPort {

    private final SpringDataWaitlistJpaRepository jpa;

    @Override
    public WaitlistEntry save(WaitlistEntry e) {
        return toDomain(jpa.save(toEntity(e)));
    }

    @Override
    public Optional<WaitlistEntry> findByEntryId(UUID entryId) {
        return jpa.findByEntryId(entryId).map(WaitlistRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<WaitlistEntry> findByEntryIdForUpdateSkipLocked(UUID entryId) {
        return jpa.findByEntryIdForUpdateSkipLocked(entryId).map(WaitlistRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<WaitlistEntry> findActive(UUID ticketTypeId, String ownerEmail) {
        return jpa.findActive(ticketTypeId, ownerEmail).map(WaitlistRepositoryAdapter::toDomain);
    }

    @Override
    public long countActiveByOwner(String ownerEmail) {
        return jpa.countActiveByOwner(ownerEmail);
    }

    @Override
    public long sumWaitingQuantity(UUID ticketTypeId) {
        return jpa.sumWaitingQuantity(ticketTypeId);
    }

    @Override
    public long sumWaitingQuantityFitting(UUID ticketTypeId, int maxUnits) {
        return jpa.sumWaitingQuantityFitting(ticketTypeId, maxUnits);
    }

    @Override
    public List<WaitlistEntry> findWaiting(UUID ticketTypeId) {
        return jpa.findByTicketTypeIdAndStatusOrderByCreatedAtAsc(ticketTypeId, WaitlistStatus.WAITING.name()).stream()
                .map(WaitlistRepositoryAdapter::toDomain).toList();
    }

    @Override
    public List<UUID> findTicketTypeIdsWithWaiting() {
        return jpa.findTicketTypeIdsWithWaiting();
    }

    @Override
    public List<WaitlistEntry> findByStatus(WaitlistStatus status) {
        return jpa.findByStatus(status.name()).stream().map(WaitlistRepositoryAdapter::toDomain).toList();
    }

    @Override
    public List<WaitlistEntry> findByOwner(String ownerEmail, int limit) {
        return jpa.findByOwnerEmailOrderByCreatedAtDesc(ownerEmail, PageRequest.of(0, limit)).stream()
                .map(WaitlistRepositoryAdapter::toDomain).toList();
    }

    private static WaitlistEntryEntity toEntity(WaitlistEntry e) {
        return WaitlistEntryEntity.builder().id(e.getId()).entryId(e.getEntryId()).ticketTypeId(e.getTicketTypeId())
                .ownerEmail(e.getOwnerEmail()).holderName(e.getHolderName()).holderEmail(e.getHolderEmail())
                .quantity(e.getQuantity()).status(e.getStatus().name()).reservationId(e.getReservationId())
                .failureReason(e.getFailureReason()).offeredAt(e.getOfferedAt()).createdAt(e.getCreatedAt()).build();
    }

    private static WaitlistEntry toDomain(WaitlistEntryEntity e) {
        return WaitlistEntry.builder().id(e.getId()).entryId(e.getEntryId()).ticketTypeId(e.getTicketTypeId())
                .ownerEmail(e.getOwnerEmail()).holderName(e.getHolderName()).holderEmail(e.getHolderEmail())
                .quantity(e.getQuantity()).status(WaitlistStatus.valueOf(e.getStatus())).reservationId(e.getReservationId())
                .failureReason(e.getFailureReason()).offeredAt(e.getOfferedAt()).createdAt(e.getCreatedAt()).build();
    }
}
