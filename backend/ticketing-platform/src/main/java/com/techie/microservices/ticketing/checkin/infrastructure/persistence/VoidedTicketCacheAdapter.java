package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import com.techie.microservices.ticketing.checkin.application.port.VoidedTicketCachePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VoidedTicketCacheAdapter implements VoidedTicketCachePort {

    private final SpringDataVoidedTicketJpaRepository jpaRepository;

    @Override
    @Transactional
    public void upsert(UUID ticketId, String reason, Instant voidedAt) {
        VoidedTicketEntity entity = jpaRepository.findById(ticketId)
                .orElse(VoidedTicketEntity.builder().ticketId(ticketId).build());
        entity.setReason(reason);
        entity.setVoidedAt(voidedAt);
        jpaRepository.save(entity);
    }

    @Override
    public boolean isVoided(UUID ticketId) {
        return ticketId != null && jpaRepository.existsById(ticketId);
    }
}
