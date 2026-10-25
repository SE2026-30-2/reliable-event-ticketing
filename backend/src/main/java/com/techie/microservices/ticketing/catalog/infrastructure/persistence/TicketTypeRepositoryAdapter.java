package com.techie.microservices.ticketing.catalog.infrastructure.persistence;

import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TicketTypeRepositoryAdapter implements TicketTypeRepositoryPort {

    private final SpringDataTicketTypeJpaRepository jpaRepository;

    @Override
    public TicketType save(TicketType ticketType) {
        return toDomain(jpaRepository.save(toEntity(ticketType)));
    }

    @Override
    public Optional<TicketType> findByTicketTypeId(UUID ticketTypeId) {
        return jpaRepository.findByTicketTypeId(ticketTypeId).map(TicketTypeRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<TicketType> findByTicketTypeIdForUpdate(UUID ticketTypeId) {
        return jpaRepository.findByTicketTypeIdForUpdate(ticketTypeId).map(TicketTypeRepositoryAdapter::toDomain);
    }

    @Override
    public List<TicketType> findByEventId(UUID eventId) {
        return jpaRepository.findByEventId(eventId).stream().map(TicketTypeRepositoryAdapter::toDomain).toList();
    }

    private static TicketTypeEntity toEntity(TicketType ticketType) {
        return TicketTypeEntity.builder()
                .id(ticketType.getId())
                .ticketTypeId(ticketType.getTicketTypeId())
                .eventId(ticketType.getEventId())
                .name(ticketType.getName())
                .priceCents(ticketType.getPriceCents())
                .quota(ticketType.getQuota())
                .issuedCount(ticketType.getIssuedCount())
                .reservedCount(ticketType.getReservedCount())
                .validFrom(ticketType.getValidFrom())
                .validUntil(ticketType.getValidUntil())
                .createdAt(ticketType.getCreatedAt())
                .maxEntries(ticketType.getMaxEntries())
                .bundleSize(ticketType.getBundleSize())
                .build();
    }

    private static TicketType toDomain(TicketTypeEntity entity) {
        return TicketType.builder()
                .id(entity.getId())
                .ticketTypeId(entity.getTicketTypeId())
                .eventId(entity.getEventId())
                .name(entity.getName())
                .priceCents(entity.getPriceCents())
                .quota(entity.getQuota())
                .issuedCount(entity.getIssuedCount())
                .reservedCount(entity.getReservedCount())
                .validFrom(entity.getValidFrom())
                .validUntil(entity.getValidUntil())
                .createdAt(entity.getCreatedAt())
                .maxEntries(entity.getMaxEntries())
                .bundleSize(entity.getBundleSize())
                .build();
    }
}
