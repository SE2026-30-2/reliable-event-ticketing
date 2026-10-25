package com.techie.microservices.ticketing.catalog.application.service;

import com.techie.microservices.ticketing.catalog.application.port.ReservationResult;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketCommand;
import com.techie.microservices.ticketing.catalog.application.port.ReserveTicketUseCase;
import com.techie.microservices.ticketing.catalog.application.port.CouponRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.EventRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.TicketTypeRepositoryPort;
import com.techie.microservices.ticketing.catalog.application.port.WaitlistRepositoryPort;
import com.techie.microservices.ticketing.catalog.domain.event.TicketReservedEvent;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotOpenException;
import com.techie.microservices.ticketing.catalog.domain.exception.InvalidCouponException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.exception.TooManyActiveReservationsException;
import com.techie.microservices.ticketing.catalog.domain.exception.TicketTypeSoldOutException;
import com.techie.microservices.ticketing.catalog.domain.model.Coupon;
import com.techie.microservices.ticketing.catalog.domain.model.PriceCalculator;
import com.techie.microservices.ticketing.catalog.domain.model.Ticket;
import com.techie.microservices.ticketing.catalog.domain.model.TicketStatus;
import com.techie.microservices.ticketing.catalog.domain.model.TicketType;
import com.techie.microservices.ticketing.shared.application.port.OutboxEventPublisherPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Reserves N tickets of a given ticket type in a single transaction: row-locks the ticket type
 * ({@link TicketTypeRepositoryPort#findByTicketTypeIdForUpdate}) so concurrent purchases of the
 * last few remaining tickets cannot both pass the quota check and oversell - same locking
 * strategy the old direct-issue flow used, just guarding {@code issuedCount + reservedCount}
 * instead of {@code issuedCount} alone (see {@link TicketType#hasRemainingQuota}).
 * <p>
 * Unlike the old direct-issue flow, this does NOT sign a QR payload or set {@code issuedAt} - the
 * ticket sits in {@link TicketStatus#RESERVED}, holding its share of quota via {@code
 * reservedCount}, until {@link ConfirmReservationApplicationService} (payment succeeded) or
 * {@link CancelReservationApplicationService} (payment failed, or {@code ExpireReservationsJob}
 * on timeout) resolves it.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class ReserveTicketApplicationService implements ReserveTicketUseCase {

    private final TicketTypeRepositoryPort ticketTypeRepositoryPort;
    private final TicketRepositoryPort ticketRepositoryPort;
    private final OutboxEventPublisherPort outboxEventPublisherPort;
    private final EventRepositoryPort eventRepositoryPort;
    private final CouponRepositoryPort couponRepositoryPort;
    private final WaitlistRepositoryPort waitlistRepositoryPort;

    /** Cap on tickets one buyer account may hold RESERVED at once - the buyer endpoints are anonymous, so
     * without this one address could lock up an entire ticket type for the whole hold window. */
    @Value("${ticketing.reservation.max-active-per-email:10}")
    private int maxActivePerEmail;

    @Value("${ticketing.reservation.expiry-minutes:10}")
    private long reservationExpiryMinutes;

    @Override
    public ReservationResult reserveTickets(ReserveTicketCommand command) {
        // Checked before taking the ticket-type row lock: a rejected abuser must not queue behind (or hold up) real buyers.
        String owner = command.ownerEmail().trim().toLowerCase();
        int previewBundle = ticketTypeRepositoryPort.findByTicketTypeId(command.ticketTypeId()).map(TicketType::getBundleSize).orElse(1);
        int ticketCount = command.quantity() * Math.max(1, previewBundle);
        long active = ticketRepositoryPort.countActiveReservationsByOwner(owner);
        if (active + ticketCount > maxActivePerEmail) {
            throw new TooManyActiveReservationsException(maxActivePerEmail);
        }

        TicketType ticketType = ticketTypeRepositoryPort.findByTicketTypeIdForUpdate(command.ticketTypeId())
                .orElseThrow(() -> new TicketTypeNotFoundException(command.ticketTypeId()));
        ticketCount = command.quantity() * ticketType.getBundleSize();

        // Sales are only open for a PUBLISHED event that has not ended (drafts and cancelled events are closed).
        var event = eventRepositoryPort.findByEventId(ticketType.getEventId())
                .orElseThrow(() -> new TicketTypeNotFoundException(command.ticketTypeId()));
        Instant now = Instant.now();
        if (!event.isOpenForSales(now)) {
            throw new EventNotOpenException(event.getEventId());
        }

        if (!ticketType.hasRemainingQuota(ticketCount)) {
            int remaining = ticketType.getQuota() - ticketType.getIssuedCount() - ticketType.getReservedCount();
            throw new TicketTypeSoldOutException(command.ticketTypeId(), ticketCount, remaining);
        }

        if (!command.fromWaitlist()) {
            // Quota that just freed up belongs to the people already in line, not to whoever clicks first.
            int remaining = ticketType.getQuota() - ticketType.getIssuedCount() - ticketType.getReservedCount();
            // Only entries the waitlist could serve from what is free right now count: an entry wanting more than
            // is free cannot use these tickets, and must not keep them off sale.
            long waiting = waitlistRepositoryPort.sumWaitingQuantityFitting(ticketType.getTicketTypeId(), remaining / ticketType.getBundleSize())
                    * ticketType.getBundleSize();
            if (waiting > 0 && remaining - waiting < ticketCount) {
                throw new TicketTypeSoldOutException(command.ticketTypeId(), ticketCount, (int) Math.max(0, remaining - waiting));
            }
        }

        Coupon coupon = null;
        if (command.couponCode() != null && !command.couponCode().isBlank()) {
            // Locked so two buyers cannot both take the last redemption.
            coupon = couponRepositoryPort.findByEventIdAndCodeForUpdate(ticketType.getEventId(), command.couponCode().trim().toUpperCase())
                    .orElseThrow(() -> new InvalidCouponException("unknown code"));
            coupon.assertUsableFor(ticketType, now);
        }
        PriceCalculator.Result price = PriceCalculator.price(ticketType.getPriceCents(), ticketType.getBundleSize(), command.quantity(), coupon);

        UUID reservationId = UUID.randomUUID();
        Instant expiresAt = now.plus(Duration.ofMinutes(reservationExpiryMinutes));

        List<Ticket> reserved = new ArrayList<>(ticketCount);
        for (int i = 0; i < ticketCount; i++) {
            reserved.add(reserveOne(ticketType, command, reservationId, now, expiresAt, price.perTicketCents().get(i), coupon));
        }

        ticketType.setReservedCount(ticketType.getReservedCount() + ticketCount);
        ticketTypeRepositoryPort.save(ticketType);
        if (coupon != null) {
            coupon.setRedeemedCount(coupon.getRedeemedCount() + 1);
            couponRepositoryPort.save(coupon);
        }

        log.info("Reserved {} ticket(s) of type {} under reservation {}{}", ticketCount, ticketType.getTicketTypeId(), reservationId,
                coupon == null ? "" : " with coupon " + coupon.getCode());
        return new ReservationResult(reservationId, reserved, price.totalCents(), price.discountCents());
    }

    private Ticket reserveOne(TicketType ticketType, ReserveTicketCommand command, UUID reservationId,
                               Instant now, Instant expiresAt, long priceCents, Coupon coupon) {
        UUID ticketId = UUID.randomUUID();
        Ticket ticket = Ticket.builder()
                .ticketId(ticketId)
                .ticketTypeId(ticketType.getTicketTypeId())
                .eventId(ticketType.getEventId())
                .ownerEmail(command.ownerEmail().trim().toLowerCase())
                .holderName(command.holderName())
                .holderEmail(command.holderEmail())
                .status(TicketStatus.RESERVED)
                .reservationId(reservationId)
                .reservationExpiresAt(expiresAt)
                .validFrom(ticketType.getValidFrom())
                .validUntil(ticketType.getValidUntil())
                .maxEntries(ticketType.getMaxEntries())
                .priceCents(priceCents)
                .couponId(coupon == null ? null : coupon.getCouponId())
                .createdAt(now)
                .build();
        Ticket saved = ticketRepositoryPort.save(ticket);

        outboxEventPublisherPort.publish(
                ticketId.toString(),
                "ticket-reserved",
                "ticket-reserved",
                new TicketReservedEvent(
                        UUID.randomUUID(),
                        ticketId,
                        reservationId,
                        ticketType.getEventId(),
                        ticketType.getTicketTypeId(),
                        expiresAt,
                        now));

        return saved;
    }
}
