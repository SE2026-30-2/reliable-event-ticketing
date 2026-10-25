package com.techie.microservices.ticketing.catalog.application.port;

import java.util.UUID;

public record CancelReservationCommand(UUID reservationId, String reason) {
}
