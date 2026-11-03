package com.ticketing.catalog.application.port;

import java.util.UUID;

public record ConfirmReservationCommand(UUID reservationId) {
}
