package com.techie.microservices.ticketing.catalog.infrastructure.security;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Short-keyed JSON shape actually written into the signed QR payload - see
 * {@link TicketQrSigner}. Field names are intentionally terse ({@code tid}, {@code eid}, ...) to
 * keep the scannable QR code's data density down; this exact shape (key names, value types -
 * UUIDs as plain text, timestamps as epoch seconds) is the wire contract checkin-service's
 * decoder must mirror byte-for-byte.
 */
record QrClaimsJson(
        @JsonProperty("tid") String tid,
        @JsonProperty("eid") String eid,
        @JsonProperty("tt") String tt,
        @JsonProperty("vf") long vf,
        @JsonProperty("vu") long vu,
        @JsonProperty("iat") long iat,
        /** Max scans; absent means 1 (so single-use QRs stay exactly as small as before). */
        @JsonProperty("me") @JsonInclude(JsonInclude.Include.NON_NULL) Integer me
) {
}
