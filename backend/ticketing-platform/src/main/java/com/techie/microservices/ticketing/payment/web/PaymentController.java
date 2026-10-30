package com.techie.microservices.ticketing.payment.web;

import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestCommand;
import com.techie.microservices.ticketing.payment.application.port.CreatePaymentRequestUseCase;
import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentUseCase;
import com.techie.microservices.ticketing.payment.web.dto.CreatePaymentRequestRequest;
import com.techie.microservices.ticketing.payment.web.dto.PaymentRequestResponse;
import com.techie.microservices.ticketing.shared.web.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PaymentController {

    private final CreatePaymentRequestUseCase createPaymentRequestUseCase;
    private final ObjectProvider<OnlinePaymentUseCase> onlinePayment;

    /** Requires the buyer who owns the reservation (anyone else gets 404). With the mock provider it
     * resolves synchronously; with VNPay it returns PENDING plus {@code paymentUrl} to redirect the
     * buyer to - the ticket transition happens later, via the outbox event a verified verdict publishes. */
    @PostMapping("/api/payment/requests")
    public ResponseEntity<PaymentRequestResponse> createPaymentRequest(@Valid @RequestBody CreatePaymentRequestRequest request,
                                                                        @AuthenticationPrincipal Jwt jwt,
                                                                        HttpServletRequest http) {
        var result = createPaymentRequestUseCase.createPaymentRequest(new CreatePaymentRequestCommand(
                AuthenticatedUser.email(jwt), request.reservationId(), request.forceOutcome(), clientIp(http)));
        return ResponseEntity.status(HttpStatus.CREATED).body(PaymentRequestResponse.from(result));
    }

    /** Buyer polls the payment of one of their reservations. */
    @GetMapping("/api/payment/requests/by-reservation/{reservationId}")
    public PaymentRequestResponse getByReservation(@PathVariable UUID reservationId, @AuthenticationPrincipal Jwt jwt) {
        return PaymentRequestResponse.from(online().getByReservation(reservationId, AuthenticatedUser.email(jwt)));
    }

    /** Buyer is back from the hosted page: ask the provider and settle now (IPN may lag or be unreachable). */
    @PostMapping("/api/payment/vnpay/sync/{txnRef}")
    public PaymentRequestResponse sync(@PathVariable String txnRef, @AuthenticationPrincipal Jwt jwt) {
        return PaymentRequestResponse.from(online().sync(txnRef, AuthenticatedUser.email(jwt)));
    }

    /** VNPay's server-to-server callback. Public by necessity - authenticity is the HMAC signature,
     * checked inside. Always HTTP 200: the provider reads RspCode, and non-200 only makes it retry. */
    @GetMapping("/api/payment/vnpay/ipn")
    public Map<String, String> ipn(@RequestParam Map<String, String> params) {
        return online().handleIpn(params);
    }

    /** Admin: refund a completed online payment (also voids its tickets). */
    @PostMapping("/api/payment/requests/{paymentRequestId}/refund")
    public PaymentRequestResponse refund(@PathVariable UUID paymentRequestId, @AuthenticationPrincipal Jwt jwt) {
        return PaymentRequestResponse.from(online().refund(paymentRequestId, AuthenticatedUser.email(jwt)));
    }

    private OnlinePaymentUseCase online() {
        OnlinePaymentUseCase u = onlinePayment.getIfAvailable();
        if (u == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Online payments are not enabled");
        }
        return u;
    }

    /** Servlet's remote address: RateLimitFilter's trusted-proxy handling is the only place that
     * decides whether X-Forwarded-For is believable; here VNPay only wants an informational IP. */
    private static String clientIp(HttpServletRequest http) {
        return http.getRemoteAddr();
    }
}
