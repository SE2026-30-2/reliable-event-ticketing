package com.techie.microservices.ticketing.catalog.infrastructure.security;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.ticketing.catalog.application.port.QrPayloadSignerPort;
import com.techie.microservices.ticketing.catalog.domain.model.TicketQrClaims;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.Signature;
import java.util.Base64;

/**
 * Signs a ticket's claims into the exact string placed in its QR code:
 * {@code "<kid>.<base64url(json)>.<base64url(signature)>"}. Deliberately hand-rolled instead of a
 * full JWT/{@code NimbusJwtEncoder} (the approach user-service's {@code JwtAccessTokenIssuer}
 * uses for access tokens) to avoid JOSE header overhead - a scannable QR code has a hard data
 * density ceiling, and every byte here is one the camera/decoder has to resolve. RS256 + a fixed
 * {@code kid} prefix keeps the same signing semantics as the rest of this codebase's JWT
 * infrastructure, just without the JSON header object. checkin-service's {@code TicketQrVerifier}
 * must decode this exact wire format.
 */
@Component
@RequiredArgsConstructor
public class TicketQrSigner implements QrPayloadSignerPort {

    private static final Base64.Encoder BASE64_URL_NO_PAD = Base64.getUrlEncoder().withoutPadding();

    private final RsaKeyProvider rsaKeyProvider;
    private final ObjectMapper objectMapper;

    @Override
    public String sign(TicketQrClaims claims) {
        String payloadBase64 = BASE64_URL_NO_PAD.encodeToString(serialize(claims));
        byte[] signature = signBytes(payloadBase64.getBytes(StandardCharsets.US_ASCII));
        String signatureBase64 = BASE64_URL_NO_PAD.encodeToString(signature);
        return RsaKeyProvider.KEY_ID + "." + payloadBase64 + "." + signatureBase64;
    }

    private byte[] serialize(TicketQrClaims claims) {
        QrClaimsJson json = new QrClaimsJson(
                claims.ticketId().toString(),
                claims.eventId().toString(),
                claims.ticketTypeId().toString(),
                claims.validFromEpochSeconds(),
                claims.validUntilEpochSeconds(),
                claims.issuedAtEpochSeconds(),
                claims.maxEntries() > 1 ? claims.maxEntries() : null);
        try {
            return objectMapper.writeValueAsBytes(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize QR claims for ticket " + claims.ticketId(), e);
        }
    }

    private byte[] signBytes(byte[] data) {
        try {
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(rsaKeyProvider.getPrivateKey());
            signature.update(data);
            return signature.sign();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to sign QR payload", e);
        }
    }
}
