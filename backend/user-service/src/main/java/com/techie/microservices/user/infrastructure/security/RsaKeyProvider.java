package com.techie.microservices.user.infrastructure.security;

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
 * Loads this service's RS256 signing key from {@code security.jwt.private-key-path} on startup,
 * generating a fresh 2048-bit RSA key pair and persisting it there if the file does not exist yet
 * (first run). docker-compose mounts a named volume at that path specifically so the key survives
 * container recreation - every JWT issued (and the JWKS response every other service caches) would
 * otherwise become invalid on every redeploy. Only the PKCS8-encoded private key is ever written
 * to disk: an {@link RSAPrivateCrtKey} already carries the modulus and public exponent, so the
 * public key is cheaply re-derived from it on every startup instead of keeping a second file in
 * sync.
 * <p>
 * Both {@link JwtAccessTokenIssuer} (signs) and {@code web.JwksController} /
 * {@code config.SecurityConfig} (serves the public key / validates this service's own protected
 * endpoints) depend on this single component so there is exactly one in-memory copy of the key
 * pair.
 */
@Component
@Slf4j
@Getter
public class RsaKeyProvider {

    /** Fixed - this service only ever holds a single signing key, so no rotation/kid lookup is needed. */
    public static final String KEY_ID = "user-service-key-1";

    private static final int KEY_SIZE_BITS = 2048;
    private static final int PEM_LINE_LENGTH = 64;
    private static final String PEM_HEADER = "-----BEGIN PRIVATE KEY-----";
    private static final String PEM_FOOTER = "-----END PRIVATE KEY-----";

    @Value("${security.jwt.private-key-path}")
    private String privateKeyPath;

    private RSAPrivateCrtKey privateKey;
    private RSAPublicKey publicKey;

    @PostConstruct
    void init() throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        Path path = Path.of(privateKeyPath);
        if (Files.exists(path)) {
            log.info("Loading existing RSA signing key from {}", path.toAbsolutePath());
            privateKey = readPrivateKey(path);
        } else {
            log.warn("No RSA signing key found at {} - generating a new one. Every JWT issued " +
                            "before this point (and the previous JWKS response) is now invalid.",
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
