package com.techie.microservices.ticketing.checkin.infrastructure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.ticketing.catalog.infrastructure.security.RsaKeyProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Signature;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * Decodes and verifies the exact wire format {@code catalog.infrastructure.security.TicketQrSigner}
 * produces: {@code "<kid>.<base64url(json)>.<base64url(signature)>"}. Deliberately reuses
 * catalog's {@link RsaKeyProvider} bean directly (same JVM, same process - no HTTP/JWKS round
 * trip needed server-side) rather than this module minting its own trust of catalog's public key;
 * the public {@code /.well-known/jwks.json} endpoint still exists separately for the check-in
 * *client app* to fetch and verify fully offline, on-device - this class is the server's own
 * independent re-verification at submission time, not a replacement for that.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TicketQrVerifier {

    private static final Base64.Decoder BASE64_URL_NO_PAD = Base64.getUrlDecoder();

    private final RsaKeyProvider catalogRsaKeyProvider;
    private final ObjectMapper objectMapper;

    /** Empty means "not a validly signed QR payload" - caller treats that as
     * {@code CheckinOutcome.INVALID_SIGNATURE}, never an exception. */
    public Optional<VerifiedTicketClaims> verify(String qrPayload) {
        if (qrPayload == null || qrPayload.isBlank()) {
            return Optional.empty();
        }
        String[] parts = qrPayload.split("\\.", -1);
        if (parts.length != 3) {
            return Optional.empty();
        }
        try {
            byte[] signature = BASE64_URL_NO_PAD.decode(parts[2]);
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(catalogRsaKeyProvider.getPublicKey());
            verifier.update(parts[1].getBytes(StandardCharsets.US_ASCII));
            if (!verifier.verify(signature)) {
                return Optional.empty();
            }
            byte[] json = BASE64_URL_NO_PAD.decode(parts[1]);
            QrClaimsJson claims = objectMapper.readValue(json, QrClaimsJson.class);
            return Optional.of(new VerifiedTicketClaims(
                    UUID.fromString(claims.tid()),
                    UUID.fromString(claims.eid()),
                    UUID.fromString(claims.tt()),
                    claims.vf(),
                    claims.vu(),
                    claims.iat(),
                    claims.me() == null || claims.me() < 1 ? 1 : claims.me()));
        } catch (Exception e) {
            log.debug("QR payload failed verification/decoding: {}", e.toString());
            return Optional.empty();
        }
    }
}
