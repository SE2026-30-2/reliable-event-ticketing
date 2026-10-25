package com.techie.microservices.ticketing.catalog.application.port;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;

/** Catalog's view of "is a payment still being decided for this reservation?" - implemented by the
 * payment module. While one is, the expiry sweep must leave the reservation alone: cancelling it
 * could race with the provider confirming a payment and leave the buyer charged with no ticket. */
public interface PendingPaymentGuardPort {
    Set<UUID> reservationsWithPendingPayment(Collection<UUID> reservationIds);
}
