package com.techie.microservices.ticketing.payment.domain.exception;

public class ForceOutcomeNotAllowedException extends RuntimeException {
    public ForceOutcomeNotAllowedException() {
        super("forceOutcome is a demo/test hook and is disabled in this environment");
    }
}
