package com.techie.microservices.ticketing.catalog.domain.model;

public enum TicketStatus {
    /** Quota held, awaiting a payment outcome - not yet check-in-eligible. */
    RESERVED,
    /** The only check-in-eligible state. */
    ISSUED,
    /** Terminal - a reservation that never became a paid ticket (payment failed or expired). */
    CANCELLED,
    /** Terminal - invalidated by an admin (e.g. fraud, duplicate purchase), no refund implied. */
    VOID,
    /** Terminal - invalidated because the buyer was refunded. */
    REFUNDED,
    /** Terminal - the owner transferred it; a new ticket (new QR) was issued to the recipient. */
    TRANSFERRED;

    /**
     * The single source of truth for which transitions are legal, checked by every service that
     * changes a ticket's status (not just re-implemented per call site): RESERVED's two exits are
     * {@code ConfirmReservationApplicationService} (payment succeeded) and
     * {@code CancelReservationApplicationService} (payment failed, or {@code
     * ExpireReservationsJob} on timeout - same use case, different trigger); ISSUED's two exits
     * are both {@code VoidTicketApplicationService}. Every other status is terminal.
     */
    public boolean canTransitionTo(TicketStatus target) {
        return switch (this) {
            case RESERVED -> target == ISSUED || target == CANCELLED;
            case ISSUED -> target == VOID || target == REFUNDED || target == TRANSFERRED;
            case CANCELLED, VOID, REFUNDED, TRANSFERRED -> false;
        };
    }
}
