package com.techie.microservices.ticketing.catalog.infrastructure.scheduling;

import com.techie.microservices.ticketing.catalog.application.service.WaitlistPromotionService;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.domain.model.WaitlistEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Runs after {@code ExpireReservationsJob} frees quota (and whenever a buyer declines an offer or an
 * organizer adds capacity): settle finished offers, then walk each queue oldest-first offering whatever
 * fits. An entry that does not fit yet keeps its place; one that can never be served is dropped with a reason.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WaitlistPromotionJob {

    private final WaitlistPromotionService promotion;

    @Scheduled(fixedDelayString = "${ticketing.waitlist.interval-ms:30000}", initialDelayString = "${ticketing.waitlist.interval-ms:30000}")
    public void run() {
        promotion.settleOffers();
        for (UUID ticketTypeId : promotion.ticketTypesWithWaiting()) {
            for (WaitlistEntry entry : promotion.waiting(ticketTypeId)) {
                try {
                    promotion.promote(entry.getEntryId());
                } catch (TicketTypeSoldOutException stillNoRoom) {
                    // keeps its place; a smaller entry behind it may still fit
                } catch (RuntimeException unservable) {
                    log.warn("Dropping waitlist entry {}: {}", entry.getEntryId(), unservable.getMessage());
                    promotion.giveUp(entry.getEntryId(), unservable.getMessage());
                }
            }
        }
    }
}
