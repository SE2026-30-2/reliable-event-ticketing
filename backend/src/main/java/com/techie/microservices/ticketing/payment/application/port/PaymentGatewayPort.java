package com.techie.microservices.ticketing.payment.application.port;

/**
 * Stands in for a real payment provider (VNPay/Momo/Stripe sandbox, etc) - this entire app never
 * moves real money, so there is nothing to abstract beyond "does this charge succeed or fail."
 */
public interface PaymentGatewayPort {
    /**
     * @param forceOutcome "COMPLETED" or "FAILED" to pin the outcome (test/demo hook); any other
     *                     value (including null) falls back to the configured random success rate.
     */
    boolean charge(long amountCents, String forceOutcome);
}
