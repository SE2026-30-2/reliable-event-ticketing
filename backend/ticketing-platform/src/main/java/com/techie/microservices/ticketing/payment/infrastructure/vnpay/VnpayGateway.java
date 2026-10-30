package com.techie.microservices.ticketing.payment.infrastructure.vnpay;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentPort;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import java.util.UUID;

/** VNPay (sandbox or production, by {@code ticketing.payment.vnpay.*}) behind {@link OnlinePaymentPort}. */
@Component
@ConditionalOnProperty(name = "ticketing.payment.provider", havingValue = "vnpay")
@Slf4j
public class VnpayGateway implements OnlinePaymentPort {

    static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh"); // UTC+7, no DST
    static final DateTimeFormatter VN_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(VN_ZONE);
    private static final String VERSION = "2.1.0";

    private static final List<String> QUERY_REQUEST_FIELDS = List.of("vnp_RequestId", "vnp_Version", "vnp_Command",
            "vnp_TmnCode", "vnp_TxnRef", "vnp_TransactionDate", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo");
    private static final List<String> REFUND_REQUEST_FIELDS = List.of("vnp_RequestId", "vnp_Version", "vnp_Command",
            "vnp_TmnCode", "vnp_TransactionType", "vnp_TxnRef", "vnp_Amount", "vnp_TransactionNo", "vnp_TransactionDate",
            "vnp_CreateBy", "vnp_CreateDate", "vnp_IpAddr", "vnp_OrderInfo");
    private static final List<String> QUERY_RESPONSE_FIELDS = List.of("vnp_ResponseId", "vnp_Command", "vnp_ResponseCode",
            "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo",
            "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo", "vnp_PromotionCode", "vnp_PromotionAmount");
    private static final List<String> REFUND_RESPONSE_FIELDS = List.of("vnp_ResponseId", "vnp_Command", "vnp_ResponseCode",
            "vnp_Message", "vnp_TmnCode", "vnp_TxnRef", "vnp_Amount", "vnp_BankCode", "vnp_PayDate", "vnp_TransactionNo",
            "vnp_TransactionType", "vnp_TransactionStatus", "vnp_OrderInfo");

    private final VnpaySigner signer;
    private final ObjectMapper objectMapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private final String tmnCode;
    private final String payUrl;
    private final String apiUrl;
    private final String returnUrl;
    private final String orderType;
    private final String serverIp;

    public VnpayGateway(
            ObjectMapper objectMapper,
            @Value("${ticketing.payment.vnpay.tmn-code:}") String tmnCode,
            @Value("${ticketing.payment.vnpay.hash-secret:}") String hashSecret,
            @Value("${ticketing.payment.vnpay.pay-url:https://sandbox.vnpayment.vn/paymentv2/vpcpay.html}") String payUrl,
            @Value("${ticketing.payment.vnpay.api-url:https://sandbox.vnpayment.vn/merchant_webapi/api/transaction}") String apiUrl,
            @Value("${ticketing.payment.vnpay.return-url:}") String returnUrl,
            @Value("${ticketing.payment.vnpay.order-type:other}") String orderType,
            @Value("${ticketing.payment.vnpay.server-ip:127.0.0.1}") String serverIp) {
        if (tmnCode.isBlank() || hashSecret.isBlank() || returnUrl.isBlank()) {
            // Fail at startup, not on the first buyer's checkout.
            throw new IllegalStateException("ticketing.payment.provider=vnpay requires ticketing.payment.vnpay.tmn-code, "
                    + "hash-secret and return-url (see docs/setup.md)");
        }
        this.objectMapper = objectMapper;
        this.signer = new VnpaySigner(hashSecret);
        this.tmnCode = tmnCode;
        this.payUrl = payUrl;
        this.apiUrl = apiUrl;
        this.returnUrl = returnUrl;
        this.orderType = orderType;
        this.serverIp = serverIp;
    }

    public static String formatVnTime(Instant instant) {
        return VN_TIME.format(instant);
    }

    @Override
    public String buildPaymentUrl(PaymentRequest payment, String clientIp) {
        Map<String, String> params = new TreeMap<>();
        params.put("vnp_Version", VERSION);
        params.put("vnp_Command", "pay");
        params.put("vnp_TmnCode", tmnCode);
        params.put("vnp_Amount", String.valueOf(payment.getAmountCents())); // VND x 100 == our cents
        params.put("vnp_CreateDate", payment.getProviderCreatedAt());
        params.put("vnp_CurrCode", "VND");
        params.put("vnp_IpAddr", clientIp == null || clientIp.isBlank() ? "127.0.0.1" : clientIp);
        params.put("vnp_Locale", "vn");
        params.put("vnp_OrderInfo", "Thanh toan ve " + payment.getTxnRef()); // unaccented, no special characters
        params.put("vnp_OrderType", orderType);
        params.put("vnp_ReturnUrl", returnUrl);
        params.put("vnp_ExpireDate", formatVnTime(payment.getPayExpiresAt()));
        params.put("vnp_TxnRef", payment.getTxnRef());
        return payUrl + "?" + VnpaySigner.canonicalQuery(params) + "&vnp_SecureHash=" + signer.signQuery(params);
    }

    @Override
    public Optional<ProviderCallback> verifyCallback(Map<String, String> params) {
        String hash = params.get("vnp_SecureHash");
        if (!signer.verifyQuery(params, hash)) {
            return Optional.empty();
        }
        String txnRef = params.get("vnp_TxnRef");
        String amount = params.get("vnp_Amount");
        if (txnRef == null || amount == null || !amount.matches("\\d{1,12}")) {
            return Optional.empty();
        }
        // Both fields must be "00": ResponseCode alone can be 00 while the transaction itself is not final.
        boolean success = "00".equals(params.get("vnp_ResponseCode")) && "00".equals(params.get("vnp_TransactionStatus"));
        return Optional.of(new ProviderCallback(txnRef, Long.parseLong(amount), success,
                params.get("vnp_TransactionNo"), params.get("vnp_PayDate"), params.get("vnp_ResponseCode")));
    }

    @Override
    public ProviderTransaction query(PaymentRequest payment) {
        Map<String, String> req = new LinkedHashMap<>();
        req.put("vnp_RequestId", UUID.randomUUID().toString().replace("-", ""));
        req.put("vnp_Version", VERSION);
        req.put("vnp_Command", "querydr");
        req.put("vnp_TmnCode", tmnCode);
        req.put("vnp_TxnRef", payment.getTxnRef());
        req.put("vnp_OrderInfo", "Truy van giao dich " + payment.getTxnRef());
        req.put("vnp_TransactionDate", payment.getProviderCreatedAt());
        req.put("vnp_CreateDate", formatVnTime(Instant.now()));
        req.put("vnp_IpAddr", serverIp);
        req.put("vnp_SecureHash", signer.signPipe(req, QUERY_REQUEST_FIELDS));

        Map<String, String> res = post(req, QUERY_RESPONSE_FIELDS);
        String code = res.get("vnp_ResponseCode");
        if ("91".equals(code)) {
            return new ProviderTransaction(TransactionState.NOT_FOUND, 0, null, null, res.get("vnp_Message"));
        }
        if (!"00".equals(code)) {
            throw new IllegalStateException("VNPay querydr failed: " + code + " " + res.get("vnp_Message"));
        }
        long amount = res.get("vnp_Amount") == null ? 0 : Long.parseLong(res.get("vnp_Amount"));
        TransactionState state = switch (String.valueOf(res.get("vnp_TransactionStatus"))) {
            case "00" -> TransactionState.SUCCESS;
            case "01" -> TransactionState.PENDING;
            default -> TransactionState.FAILED; // 02 error, 04 reversed, 07 suspected fraud, ...
        };
        return new ProviderTransaction(state, amount, res.get("vnp_TransactionNo"), res.get("vnp_PayDate"), res.get("vnp_Message"));
    }

    @Override
    public RefundResult refund(PaymentRequest payment, String requestedBy) {
        Map<String, String> req = new LinkedHashMap<>();
        req.put("vnp_RequestId", UUID.randomUUID().toString().replace("-", ""));
        req.put("vnp_Version", VERSION);
        req.put("vnp_Command", "refund");
        req.put("vnp_TmnCode", tmnCode);
        req.put("vnp_TransactionType", "02"); // full refund
        req.put("vnp_TxnRef", payment.getTxnRef());
        req.put("vnp_Amount", String.valueOf(payment.getAmountCents()));
        req.put("vnp_OrderInfo", "Hoan tien giao dich " + payment.getTxnRef());
        req.put("vnp_TransactionNo", payment.getProviderTxnNo() == null ? "" : payment.getProviderTxnNo());
        req.put("vnp_TransactionDate", payment.getProviderCreatedAt());
        req.put("vnp_CreateBy", requestedBy);
        req.put("vnp_CreateDate", formatVnTime(Instant.now()));
        req.put("vnp_IpAddr", serverIp);
        req.put("vnp_SecureHash", signer.signPipe(req, REFUND_REQUEST_FIELDS));

        Map<String, String> res = post(req, REFUND_RESPONSE_FIELDS);
        String code = res.get("vnp_ResponseCode");
        // 94 = a refund for this transaction was already submitted and is being processed: from our
        // side that is the same as accepted (we must not request it twice, and it is not a failure).
        boolean accepted = "00".equals(code) || "94".equals(code);
        return new RefundResult(accepted, code + " " + res.get("vnp_Message"));
    }

    private Map<String, String> post(Map<String, String> body, List<String> responseFields) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(apiUrl))
                    .timeout(Duration.ofSeconds(15))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("VNPay API HTTP " + response.statusCode());
            }
            Map<String, Object> raw = objectMapper.readValue(response.body(), new TypeReference<>() {
            });
            Map<String, String> res = new LinkedHashMap<>();
            raw.forEach((k, v) -> res.put(k, v == null ? null : String.valueOf(v)));
            if (!signer.verifyPipe(res, responseFields, res.get("vnp_SecureHash"))) {
                // A response we cannot authenticate must never be acted on (it could be forged or tampered).
                throw new IllegalStateException("VNPay API response failed signature verification");
            }
            return res;
        } catch (IOException e) {
            throw new IllegalStateException("VNPay API call failed: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("VNPay API call interrupted", e);
        }
    }
}
