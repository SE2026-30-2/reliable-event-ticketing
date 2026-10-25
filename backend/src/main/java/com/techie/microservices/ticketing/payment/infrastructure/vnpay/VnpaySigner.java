package com.techie.microservices.ticketing.payment.infrastructure.vnpay;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * VNPay's two signing schemes, both HMAC-SHA512 (hex) keyed with the merchant hash secret:
 * <ul>
 *   <li><b>Query-string scheme</b> (pay URL, IPN/return callbacks): every {@code vnp_*} field except
 *       {@code vnp_SecureHash}/{@code vnp_SecureHashType}, empty values dropped, sorted by name,
 *       {@code name=URLEncode(value)} joined with {@code &}.</li>
 *   <li><b>Pipe scheme</b> (querydr/refund API bodies and responses): a fixed ordered list of
 *       fields joined with {@code |}, missing fields as empty strings.</li>
 * </ul>
 * Written against VNPay's published spec (sandbox.vnpayment.vn/apis/docs); verified here only with
 * an independent re-computation in tests - real-sandbox conformance needs merchant credentials.
 */
public final class VnpaySigner {

    private final byte[] secret;

    public VnpaySigner(String hashSecret) {
        this.secret = hashSecret.getBytes(StandardCharsets.UTF_8);
    }

    /** {@code name=URLEncode(value)&...} over the sorted, non-empty fields - both the string that is
     * hashed and the query string that is sent. */
    public static String canonicalQuery(Map<String, String> params) {
        StringBuilder sb = new StringBuilder();
        new TreeMap<>(params).forEach((name, value) -> {
            if (value == null || value.isEmpty() || name.equals("vnp_SecureHash") || name.equals("vnp_SecureHashType")) {
                return;
            }
            if (sb.length() > 0) {
                sb.append('&');
            }
            sb.append(URLEncoder.encode(name, StandardCharsets.US_ASCII)).append('=')
                    .append(URLEncoder.encode(value, StandardCharsets.US_ASCII));
        });
        return sb.toString();
    }

    public String signQuery(Map<String, String> params) {
        return hmac(canonicalQuery(params));
    }

    public boolean verifyQuery(Map<String, String> params, String providedHash) {
        return providedHash != null && constantTimeEquals(signQuery(params), providedHash);
    }

    /** {@code fields} are looked up in order; missing/null become empty strings. */
    public String signPipe(Map<String, String> values, List<String> fields) {
        return hmac(pipeData(values, fields));
    }

    public boolean verifyPipe(Map<String, String> values, List<String> fields, String providedHash) {
        return providedHash != null && constantTimeEquals(signPipe(values, fields), providedHash);
    }

    static String pipeData(Map<String, String> values, List<String> fields) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < fields.size(); i++) {
            if (i > 0) {
                sb.append('|');
            }
            String v = values.get(fields.get(i));
            sb.append(v == null ? "" : v);
        }
        return sb.toString();
    }

    private String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(secret, "HmacSHA512"));
            byte[] digest = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HmacSHA512 unavailable", e);
        }
    }

    /** The provider may send the hash in either case; compare without leaking where they differ. */
    private static boolean constantTimeEquals(String expected, String provided) {
        return MessageDigest.isEqual(
                expected.toLowerCase().getBytes(StandardCharsets.UTF_8),
                provided.toLowerCase().getBytes(StandardCharsets.UTF_8));
    }
}
