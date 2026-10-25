package com.techie.microservices.ticketing.payment.application.port;

import java.util.UUID;

public record CreatePaymentRequestCommand(String requesterEmail, UUID reservationId, String forceOutcome, String clientIp) {

    public CreatePaymentRequestCommand(String requesterEmail, UUID reservationId, String forceOutcome) {
        this(requesterEmail, reservationId, forceOutcome, null);
    }
}
