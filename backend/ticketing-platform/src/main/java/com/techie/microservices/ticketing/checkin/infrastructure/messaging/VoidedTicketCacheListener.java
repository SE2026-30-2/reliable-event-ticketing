package com.techie.microservices.ticketing.checkin.infrastructure.messaging;

import com.techie.microservices.ticketing.checkin.application.port.VoidedTicketCachePort;
import com.techie.microservices.ticketing.checkin.infrastructure.messaging.dto.TicketVoidedEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the local {@code voided_tickets} cache in sync with catalog's outbox - an upsert is
 * naturally idempotent against at-least-once redelivery (reprocessing the same event just writes
 * the same row again), so no separate event-id dedup table is needed here either.
 */
@Component
@RequiredArgsConstructor
public class VoidedTicketCacheListener {

    private final VoidedTicketCachePort voidedTicketCachePort;

    @KafkaListener(topics = "${kafka.topic.ticket-voided}", groupId = "ticketing-platform-checkin")
    public void onTicketVoided(TicketVoidedEvent event) {
        voidedTicketCachePort.upsert(event.ticketId(), event.reason(), event.changedAt());
    }
}
