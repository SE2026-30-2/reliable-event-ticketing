package com.techie.microservices.ticketing.shared.web.error;

/** A signed-in manager asked for something only a platform ADMIN may do (e.g. a device usable at any event). */
public class ManagementForbiddenException extends RuntimeException {
    public ManagementForbiddenException(String message) {
        super(message);
    }
}
