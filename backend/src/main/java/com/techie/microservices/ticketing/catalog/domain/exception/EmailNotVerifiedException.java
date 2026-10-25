package com.techie.microservices.ticketing.catalog.domain.exception;

public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException() {
        super("Please verify your email address before buying tickets (check your inbox, or request a new link)");
    }
}
