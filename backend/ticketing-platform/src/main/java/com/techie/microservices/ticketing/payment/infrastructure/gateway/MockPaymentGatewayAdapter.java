package com.techie.microservices.ticketing.payment.infrastructure.gateway;

import com.techie.microservices.ticketing.payment.application.port.PaymentGatewayPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Stands in for a real sandbox (VNPay/Momo/Stripe) - no network call, no real money, ever. A
 * {@code forceOutcome} of {@code "COMPLETED"}/{@code "FAILED"} pins the result for demos and
 * deterministic tests; anything else draws against {@code ticketing.payment.success-rate} so the
 * "mạng chập chờn"-flavoured parts of the system (reservation expiry, cancelled-reservation
 * email, etc) have something to actually exercise without a human manually forcing failures.
 */
@Component
@Slf4j
public class MockPaymentGatewayAdapter implements PaymentGatewayPort {

    @Value("${ticketing.payment.success-rate:0.9}")
    private double successRate;

    @Override
    public boolean charge(long amountCents, String forceOutcome) {
        if ("COMPLETED".equalsIgnoreCase(forceOutcome)) {
            return true;
        }
        if ("FAILED".equalsIgnoreCase(forceOutcome)) {
            return false;
        }
        boolean success = ThreadLocalRandom.current().nextDouble() < successRate;
        log.debug("Mock gateway charge of {} cents -> {}", amountCents, success ? "COMPLETED" : "FAILED");
        return success;
    }
}
