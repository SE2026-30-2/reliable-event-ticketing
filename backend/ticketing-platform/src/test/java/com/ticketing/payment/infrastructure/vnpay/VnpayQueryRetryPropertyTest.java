package com.ticketing.payment.infrastructure.vnpay;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import com.ticketing.payment.application.port.OnlinePaymentPort.TransactionState;
import com.ticketing.payment.domain.model.PaymentRequest;
import com.ticketing.payment.domain.model.PaymentStatus;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Provide;
import net.jqwik.api.Property;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VnpayQueryRetryPropertyTest {

    private static final String SECRET = "PROPERTY-TEST-SECRET";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final VnpaySigner SIGNER = new VnpaySigner(SECRET);
    private static final List<String> RESPONSE_FIELDS = List.of("vnp_ResponseId", "vnp_Command", "vnp_ResponseCode",
            "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo",
            "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount");

    @Provide
    Arbitrary<Integer> transientFailureCounts() {
        return Arbitraries.integers().between(0, 3);
    }

    @Property(tries = 20, seed = "48048")
    void queryRetriesTransientHttpFailuresButNeverExceedsThreeAttempts(
            @ForAll("transientFailureCounts") int failuresBeforeSuccess) throws IOException {
        AtomicInteger attempts = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api", exchange -> {
            int attempt = attempts.incrementAndGet();
            if (attempt <= failuresBeforeSuccess) {
                exchange.sendResponseHeaders(503, -1);
                exchange.close();
                return;
            }
            Map<String, String> response = successfulResponse();
            response.put("vnp_SecureHash", SIGNER.signPipe(response, RESPONSE_FIELDS));
            byte[] body = MAPPER.writeValueAsBytes(response);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            VnpayGateway gateway = new VnpayGateway(MAPPER, "TMN", SECRET, "https://pay.example/pay",
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/api", "http://localhost/return", "other", "127.0.0.1");

            if (failuresBeforeSuccess < 3) {
                var result = gateway.query(payment());
                assertThat(result.state()).isEqualTo(TransactionState.SUCCESS);
                assertThat(attempts).hasValue(failuresBeforeSuccess + 1);
            } else {
                assertThatThrownBy(() -> gateway.query(payment())).isInstanceOf(RuntimeException.class);
                assertThat(attempts).hasValue(3);
            }
        } finally {
            server.stop(0);
        }
    }

    private static Map<String, String> successfulResponse() {
        Map<String, String> response = new LinkedHashMap<>();
        response.put("vnp_ResponseId", "response-1");
        response.put("vnp_Command", "querydr");
        response.put("vnp_ResponseCode", "00");
        response.put("vnp_Message", "OK");
        response.put("vnp_TmnCode", "TMN");
        response.put("vnp_TxnRef", "ref-property");
        response.put("vnp_Amount", "5000000");
        response.put("vnp_BankCode", "NCB");
        response.put("vnp_PayDate", "20260101101010");
        response.put("vnp_TransactionNo", "999");
        response.put("vnp_TransactionType", "01");
        response.put("vnp_TransactionStatus", "00");
        response.put("vnp_OrderInfo", "Truy van giao dich ref-property");
        response.put("vnp_PromotionCode", "");
        response.put("vnp_PromotionAmount", "0");
        return response;
    }

    private static PaymentRequest payment() {
        return PaymentRequest.builder().reservationId(UUID.randomUUID()).amountCents(5_000_000L)
                .status(PaymentStatus.PENDING).txnRef("ref-property").providerCreatedAt("20260101100000")
                .payExpiresAt(Instant.parse("2026-01-01T03:15:00Z")).build();
    }
}
