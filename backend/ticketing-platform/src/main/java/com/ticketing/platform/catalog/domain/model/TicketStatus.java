package com.ticketing.platform.catalog.domain.model;

public enum TicketStatus {
    RESERVED,
    ISSUED,
    CANCELLED,
    VOID,
    REFUNDED,
    TRANSFERRED;

    public boolean canTransitionTo(TicketStatus target) {
        return switch (this) {
            case RESERVED -> target == ISSUED || target == CANCELLED;
            case ISSUED -> target == VOID || target == REFUNDED || target == TRANSFERRED;
            case CANCELLED, VOID, REFUNDED, TRANSFERRED -> false;
        };
    }
}
