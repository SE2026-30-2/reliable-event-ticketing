package com.techie.microservices.ticketing.catalog.infrastructure.security;

import java.io.IOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;

import jakarta.annotation.PostConstruct;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

/**
 * Loads this service's RS256 QR-signing key from {@code ticketing.qr.private-key-path} on
 * startup. Adapted from user-service's {@code RsaKeyProvider} (same PEM format, same "only the
 * private key is ever written to disk, public key re-derived from it" approach), with one
 * deliberate behavioral change: user-service silently regenerates a key if the file is missing
 * (acceptable there - a 15-minute access token losing validity on an unexpected key change is a
 * minor availability blip). Here, a silently regenerated key would invalidate every QR code
 * already signed and possibly already printed/distributed to a ticket holder, with no way to
 * re-issue them after the fact - so when {@code ticketing.qr.require-existing-key=true}, a
 * missing/unreadable key file is a hard startup failure instead of a {@code log.warn}. The flag
 * defaults to {@code false} only to allow a fresh local-dev bootstrap (first-ever run, nothing
 * signed yet) to generate+persist its own key the same way user-service does; docker-compose and
 * any shared/long-lived environment should set it to {@code true} once the key volume has been
 * seeded once.
 */
@Component
@Slf4j
@Getter
public class RsaKeyProvider {

    /** Fixed - this service only ever holds a single signing key, so no rotation/kid lookup is needed. */
    public static final String KEY_ID = "ticket-service-key-1";

    private static final int KEY_SIZE_BITS = 2048;
    private static final int PEM_LINE_LENGTH = 64;
    private static final String PEM_HEADER = "-----BEGIN PRIVATE KEY-----";
    private static final String PEM_FOOTER = "-----END PRIVATE KEY-----";

    @Value("${ticketing.qr.private-key-path}")
    private String privateKeyPath;

    @Value("${ticketing.qr.require-existing-key:false}")
    private boolean requireExistingKey;

    private RSAPrivateCrtKey privateKey;
    private RSAPublicKey publicKey;

    @PostConstruct
    void init() throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        Path path = Path.of(privateKeyPath);
        if (Files.exists(path)) {
            log.info("Loading existing RSA signing key from {}", path.toAbsolutePath());
            privateKey = readPrivateKey(path);
        } else if (requireExistingKey) {
            throw new IllegalStateException(
                    "No RSA signing key found at " + path.toAbsolutePath() + " and " +
                            "ticketing.qr.require-existing-key=true - refusing to silently generate a new " +
                            "key, which would invalidate every QR ticket already signed. If this is a " +
                            "genuine first-ever bootstrap, explicitly set require-existing-key=false for " +
                            "this one run, then flip it back to true once the key volume has been seeded.");
        } else {
            log.warn("No RSA signing key found at {} - generating a new one (require-existing-key=false). " +
                            "Every QR ticket signed before this point (and the previous JWKS response) is now invalid.",
                    path.toAbsolutePath());
            privateKey = generateAndPersist(path);
        }
        publicKey = derivePublicKey(privateKey);
    }

    private RSAPrivateCrtKey generateAndPersist(Path path) throws NoSuchAlgorithmException, IOException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(KEY_SIZE_BITS);
        KeyPair keyPair = generator.generateKeyPair();
        RSAPrivateCrtKey generated = (RSAPrivateCrtKey) keyPair.getPrivate();

        Path parent = path.toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        String pem = PEM_HEADER + "\n" + wrapBase64(Base64.getEncoder().encodeToString(generated.getEncoded()))
                + "\n" + PEM_FOOTER + "\n";
        Files.writeString(path, pem, StandardCharsets.US_ASCII);
        log.info("Generated and persisted a new RSA signing key at {}", path.toAbsolutePath());
        return generated;
    }

    private RSAPrivateCrtKey readPrivateKey(Path path) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        String pem = Files.readString(path, StandardCharsets.US_ASCII);
        String base64 = pem.replace(PEM_HEADER, "").replace(PEM_FOOTER, "").replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(base64);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return (RSAPrivateCrtKey) keyFactory.generatePrivate(new PKCS8EncodedKeySpec(der));
    }

    private RSAPublicKey derivePublicKey(RSAPrivateCrtKey key) throws NoSuchAlgorithmException, InvalidKeySpecException {
        BigInteger modulus = key.getModulus();
        BigInteger publicExponent = key.getPublicExponent();
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        return (RSAPublicKey) keyFactory.generatePublic(new RSAPublicKeySpec(modulus, publicExponent));
    }

    private static String wrapBase64(String base64) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < base64.length(); i += PEM_LINE_LENGTH) {
            sb.append(base64, i, Math.min(i + PEM_LINE_LENGTH, base64.length())).append('\n');
        }
        return sb.substring(0, sb.length() - 1);
    }
}
