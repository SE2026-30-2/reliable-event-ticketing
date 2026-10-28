package com.techie.microservices.ticketing.catalog.infrastructure.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.ticketing.catalog.domain.model.TicketQrClaims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.Signature;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies the exact wire format checkin-service's TicketQrVerifier must mirror:
 * {@code "<kid>.<base64url(json)>.<base64url(signature)>"}, RS256 over the base64url payload
 * segment's ASCII bytes.
 */
class TicketQrSignerTest {

    private RsaKeyProvider rsaKeyProvider;
    private TicketQrSigner signer;

    @BeforeEach
    void setUp(@TempDir Path tempDir) throws Exception {
        rsaKeyProvider = new RsaKeyProvider();
        setField(rsaKeyProvider, "privateKeyPath", tempDir.resolve("key.pem").toString());
        setField(rsaKeyProvider, "requireExistingKey", false);
        invokeInit(rsaKeyProvider);

        signer = new TicketQrSigner(rsaKeyProvider, new ObjectMapper());
    }

    @Test
    void producesThreeDotSeparatedSegmentsWithTheFixedKidPrefix() {
        String signed = signer.sign(sampleClaims());

        String[] parts = signed.split("\\.");
        assertThat(parts).hasSize(3);
        assertThat(parts[0]).isEqualTo(RsaKeyProvider.KEY_ID);
    }

    @Test
    void signatureVerifiesAgainstTheProvidersOwnPublicKey() throws Exception {
        String signed = signer.sign(sampleClaims());
        String[] parts = signed.split("\\.");
        String payloadBase64 = parts[1];
        byte[] signatureBytes = Base64.getUrlDecoder().decode(parts[2]);

        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(rsaKeyProvider.getPublicKey());
        verifier.update(payloadBase64.getBytes(StandardCharsets.US_ASCII));

        assertThat(verifier.verify(signatureBytes)).isTrue();
    }

    @Test
    void tamperedPayloadFailsVerification() throws Exception {
        String signed = signer.sign(sampleClaims());
        String[] parts = signed.split("\\.");
        // Flip the ticket id in the decoded JSON payload without re-signing.
        String tamperedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8)
                        .replace(sampleClaims().ticketId().toString(), UUID.randomUUID().toString())
                        .getBytes(StandardCharsets.UTF_8));
        byte[] signatureBytes = Base64.getUrlDecoder().decode(parts[2]);

        Signature verifier = Signature.getInstance("SHA256withRSA");
        verifier.initVerify(rsaKeyProvider.getPublicKey());
        verifier.update(tamperedPayload.getBytes(StandardCharsets.US_ASCII));

        assertThat(verifier.verify(signatureBytes)).isFalse();
    }

    private static String decodedJson(String signed) {
        return new String(Base64.getUrlDecoder().decode(signed.split("\\.")[1]), StandardCharsets.UTF_8);
    }

    @Test
    void singleUseTicketsCarryNoMaxEntriesClaimSoTheQrStaysSmall() {
        assertThat(decodedJson(signer.sign(sampleClaims()))).doesNotContain("\"me\"");
    }

    @Test
    void multiEntryTicketsSignTheirEntryLimitIntoTheQr() {
        TicketQrClaims base = sampleClaims();
        TicketQrClaims pass = new TicketQrClaims(base.ticketId(), base.eventId(), base.ticketTypeId(),
                base.validFromEpochSeconds(), base.validUntilEpochSeconds(), base.issuedAtEpochSeconds(), 3);
        assertThat(decodedJson(signer.sign(pass))).contains("\"me\":3");
    }

    private TicketQrClaims sampleClaims() {
        Instant now = Instant.now();
        return new TicketQrClaims(
                UUID.fromString("11111111-1111-1111-1111-111111111111"),
                UUID.randomUUID(),
                UUID.randomUUID(),
                now.getEpochSecond(),
                now.plusSeconds(3600).getEpochSecond(),
                now.getEpochSecond());
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        var field = RsaKeyProvider.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private static void invokeInit(RsaKeyProvider provider) throws Exception {
        var method = RsaKeyProvider.class.getDeclaredMethod("init");
        method.setAccessible(true);
        method.invoke(provider);
    }
}
