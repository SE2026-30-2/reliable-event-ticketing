package com.techie.microservices.ticketing.checkin.infrastructure.security;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Mirrors catalog's {@code infrastructure.security.QrClaimsJson} byte-for-byte - the wire
 * contract this decoder must match, not a shared class (the two modules are deliberately not
 * coupled to each other's internal DTOs). */
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
