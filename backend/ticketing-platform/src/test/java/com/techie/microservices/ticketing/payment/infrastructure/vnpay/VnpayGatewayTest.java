package com.techie.microservices.ticketing.payment.infrastructure.vnpay;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort.TransactionState;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Talks to a local fake that signs its answers with the same scheme VNPay documents. */
class VnpayGatewayTest {

    private static final String SECRET = "TESTSECRET";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final List<String> QUERY_RESPONSE = List.of("vnp_ResponseId", "vnp_Command", "vnp_ResponseCode",
            "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo",
            "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount");

    private static final List<String> REFUND_RESPONSE = QUERY_RESPONSE.subList(0, 13); // no promotion fields

    private HttpServer server;
    private final AtomicReference<Map<String, Object>> lastRequest = new AtomicReference<>();
    private volatile Map<String, String> nextResponse;
    private volatile boolean signResponse = true;
    private VnpayGateway gateway;
    private final VnpaySigner signer = new VnpaySigner(SECRET);

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api", ex -> {
            Map<String, Object> req = MAPPER.readValue(ex.getRequestBody(), new com.fasterxml.jackson.core.type.TypeReference<>() {
            });
            lastRequest.set(req);
            List<String> fields = "refund".equals(req.get("vnp_Command")) ? REFUND_RESPONSE : QUERY_RESPONSE;
            Map<String, String> res = new LinkedHashMap<>(nextResponse);
            res.put("vnp_SecureHash", signResponse ? signer.signPipe(res, fields) : "deadbeef");
            byte[] body = MAPPER.writeValueAsBytes(res);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
        gateway = new VnpayGateway(MAPPER, "TMN", SECRET, "https://pay.example/vpcpay.html",
                "http://127.0.0.1:" + server.getAddress().getPort() + "/api", "http://localhost/return", "other", "10.0.0.1");
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private PaymentRequest payment() {
        return PaymentRequest.builder().reservationId(java.util.UUID.randomUUID()).amountCents(5_000_000L).status(PaymentStatus.PENDING)
                .txnRef("ref1").providerTxnNo("777").providerCreatedAt("20260101100000")
                .payExpiresAt(Instant.parse("2026-01-01T03:15:00Z")).build();
    }

    private static Map<String, String> queryParams(String url) {
        Map<String, String> m = new LinkedHashMap<>();
        for (String kv : URI.create(url).getRawQuery().split("&")) {
            String[] p = kv.split("=", 2);
            m.put(URLDecoder.decode(p[0], StandardCharsets.UTF_8), URLDecoder.decode(p[1], StandardCharsets.UTF_8));
        }
        return m;
    }

    @Test
    void paymentUrlCarriesSignedParamsAndIsDeterministic() {
        String url = gateway.buildPaymentUrl(payment(), "1.2.3.4");
        assertThat(url).startsWith("https://pay.example/vpcpay.html?");
        Map<String, String> q = queryParams(url);
        assertThat(q).containsEntry("vnp_Amount", "5000000").containsEntry("vnp_TxnRef", "ref1")
                .containsEntry("vnp_TmnCode", "TMN").containsEntry("vnp_CreateDate", "20260101100000")
                .containsEntry("vnp_ExpireDate", "20260101101500") // 03:15Z == 10:15 in GMT+7
                .containsEntry("vnp_IpAddr", "1.2.3.4").containsEntry("vnp_ReturnUrl", "http://localhost/return");
        assertThat(signer.verifyQuery(q, q.get("vnp_SecureHash"))).isTrue();
        assertThat(gateway.buildPaymentUrl(payment(), "1.2.3.4")).isEqualTo(url);
    }

    @Test
    void verifyCallbackRequiresValidSignatureAndBothCodesZeroForSuccess() {
        Map<String, String> cb = new LinkedHashMap<>(Map.of("vnp_TxnRef", "ref1", "vnp_Amount", "5000000",
                "vnp_ResponseCode", "00", "vnp_TransactionStatus", "00", "vnp_TransactionNo", "999", "vnp_PayDate", "20260101101010"));
        cb.put("vnp_SecureHash", signer.signQuery(cb));
        var ok = gateway.verifyCallback(cb).orElseThrow();
        assertThat(ok.success()).isTrue();
        assertThat(ok.amountCents()).isEqualTo(5_000_000L);

        Map<String, String> declined = new LinkedHashMap<>(cb);
        declined.put("vnp_ResponseCode", "24");
        declined.put("vnp_SecureHash", signer.signQuery(declined));
        assertThat(gateway.verifyCallback(declined).orElseThrow().success()).isFalse();

        Map<String, String> halfDone = new LinkedHashMap<>(cb);
        halfDone.put("vnp_TransactionStatus", "02");
        halfDone.put("vnp_SecureHash", signer.signQuery(halfDone));
        assertThat(gateway.verifyCallback(halfDone).orElseThrow().success()).isFalse();

        Map<String, String> forged = new LinkedHashMap<>(cb);
        forged.put("vnp_Amount", "1"); // hash no longer matches
        assertThat(gateway.verifyCallback(forged)).isEmpty();
        Map<String, String> unsigned = new LinkedHashMap<>(cb);
        unsigned.remove("vnp_SecureHash");
        assertThat(gateway.verifyCallback(unsigned)).isEmpty();
    }

    @Test
    void queryReportsSuccessAndSendsASignedRequestWithTheOriginalDate() {
        nextResponse = Map.of("vnp_ResponseId", "x", "vnp_Command", "querydr", "vnp_ResponseCode", "00", "vnp_Message", "OK",
                "vnp_TmnCode", "TMN", "vnp_TxnRef", "ref1", "vnp_Amount", "5000000", "vnp_PayDate", "20260101101010",
                "vnp_TransactionNo", "999", "vnp_TransactionStatus", "00");
        var tx = gateway.query(payment());
        assertThat(tx.state()).isEqualTo(TransactionState.SUCCESS);
        assertThat(tx.amountCents()).isEqualTo(5_000_000L);
        assertThat(tx.providerTxnNo()).isEqualTo("999");
        Map<String, Object> sent = lastRequest.get();
        assertThat(sent).containsEntry("vnp_Command", "querydr").containsEntry("vnp_TxnRef", "ref1")
                .containsEntry("vnp_TransactionDate", "20260101100000");
        assertThat(sent.get("vnp_SecureHash")).isNotNull();
    }

    @Test
    void queryMapsNotFoundPendingAndFailed() {
        nextResponse = Map.of("vnp_ResponseCode", "91", "vnp_Message", "not found");
        assertThat(gateway.query(payment()).state()).isEqualTo(TransactionState.NOT_FOUND);
        nextResponse = Map.of("vnp_ResponseCode", "00", "vnp_Message", "ok", "vnp_TransactionStatus", "01", "vnp_Amount", "5000000");
        assertThat(gateway.query(payment()).state()).isEqualTo(TransactionState.PENDING);
        nextResponse = Map.of("vnp_ResponseCode", "00", "vnp_Message", "ok", "vnp_TransactionStatus", "02", "vnp_Amount", "5000000");
        assertThat(gateway.query(payment()).state()).isEqualTo(TransactionState.FAILED);
    }

    @Test
    void anUnsignedOrForgedApiResponseIsNeverTrusted() {
        signResponse = false;
        nextResponse = Map.of("vnp_ResponseCode", "00", "vnp_Message", "ok", "vnp_TransactionStatus", "00", "vnp_Amount", "5000000");
        assertThatThrownBy(() -> gateway.query(payment())).isInstanceOf(IllegalStateException.class).hasMessageContaining("signature");
    }

    @Test
    void refundSendsFullRefundAndTreatsAlreadySubmittedAsAccepted() {
        nextResponse = Map.of("vnp_ResponseCode", "00", "vnp_Message", "Refund OK");
        assertThat(gateway.refund(payment(), "admin@x.com").accepted()).isTrue();
        assertThat(lastRequest.get()).containsEntry("vnp_Command", "refund").containsEntry("vnp_TransactionType", "02")
                .containsEntry("vnp_Amount", "5000000").containsEntry("vnp_TransactionNo", "777").containsEntry("vnp_CreateBy", "admin@x.com");
        nextResponse = Map.of("vnp_ResponseCode", "94", "vnp_Message", "dup");
        assertThat(gateway.refund(payment(), "a").accepted()).isTrue();
        nextResponse = Map.of("vnp_ResponseCode", "02", "vnp_Message", "bad");
        assertThat(gateway.refund(payment(), "a").accepted()).isFalse();
    }

    @Test
    void startupFailsFastWhenCredentialsAreMissing() {
        assertThatThrownBy(() -> new VnpayGateway(MAPPER, "", "", "p", "a", "", "other", "ip"))
                .isInstanceOf(IllegalStateException.class);
    }
}
