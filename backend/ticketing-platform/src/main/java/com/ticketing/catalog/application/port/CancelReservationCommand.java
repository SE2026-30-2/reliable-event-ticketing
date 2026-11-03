package com.ticketing.catalog.application.port;

import java.util.UUID;

public record CancelReservationCommand(UUID reservationId, String reason) {
}
