package com.techie.microservices.ticketing.catalog.infrastructure.security;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RsaKeyProviderTest {

    @Test
    void generatesAndPersistsAKeyOnFirstBootWhenRequireExistingKeyIsFalse(@TempDir Path tempDir) throws Exception {
        Path keyPath = tempDir.resolve("key.pem");
        RsaKeyProvider provider = providerFor(keyPath, false);

        invokeInit(provider);

        assertThat(Files.exists(keyPath)).isTrue();
        assertThat(provider.getPrivateKey()).isNotNull();
        assertThat(provider.getPublicKey()).isNotNull();
    }

    @Test
    void reloadsTheSameKeyAcrossRestartsInsteadOfGeneratingANewOne(@TempDir Path tempDir) throws Exception {
        Path keyPath = tempDir.resolve("key.pem");
        RsaKeyProvider first = providerFor(keyPath, false);
        invokeInit(first);

        RsaKeyProvider second = providerFor(keyPath, true);
        invokeInit(second);

        assertThat(second.getPublicKey()).isEqualTo(first.getPublicKey());
    }

    @Test
    void hardFailsInsteadOfSilentlyGeneratingANewKeyWhenRequireExistingKeyIsTrueAndFileIsMissing(@TempDir Path tempDir) {
        Path keyPath = tempDir.resolve("does-not-exist.pem");
        RsaKeyProvider provider = providerFor(keyPath, true);

        assertThatThrownBy(() -> invokeInit(provider))
                .hasCauseInstanceOf(IllegalStateException.class)
                .hasRootCauseMessage(
                        "No RSA signing key found at " + keyPath.toAbsolutePath() + " and " +
                                "ticketing.qr.require-existing-key=true - refusing to silently generate a new " +
                                "key, which would invalidate every QR ticket already signed. If this is a " +
                                "genuine first-ever bootstrap, explicitly set require-existing-key=false for " +
                                "this one run, then flip it back to true once the key volume has been seeded.");
        assertThat(Files.exists(keyPath)).isFalse();
    }

    private static RsaKeyProvider providerFor(Path keyPath, boolean requireExistingKey) {
        RsaKeyProvider provider = new RsaKeyProvider();
        setField(provider, "privateKeyPath", keyPath.toString());
        setField(provider, "requireExistingKey", requireExistingKey);
        return provider;
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            var field = RsaKeyProvider.class.getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new RuntimeException(e);
        }
    }

    /** Reflection unwraps checked exceptions into {@link java.lang.reflect.InvocationTargetException} -
     * callers asserting on the hard-fail path assert against {@code .getCause()}. */
    private static void invokeInit(RsaKeyProvider provider) throws Exception {
        var method = RsaKeyProvider.class.getDeclaredMethod("init");
        method.setAccessible(true);
        method.invoke(provider);
    }
}
