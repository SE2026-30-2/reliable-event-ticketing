package com.techie.microservices.ticketing.catalog.application.port;

import com.techie.microservices.ticketing.catalog.domain.model.TicketQrClaims;

/**
 * Signs a ticket's QR claims into the exact string placed in the QR code
 * ({@code "<kid>.<base64url(json)>.<base64url(signature)>"}) - see
 * {@code infrastructure.security.TicketQrSigner}.
 */
public interface QrPayloadSignerPort {
    String sign(TicketQrClaims claims);
}
