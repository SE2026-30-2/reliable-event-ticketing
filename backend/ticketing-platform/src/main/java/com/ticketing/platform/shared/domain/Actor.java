package com.ticketing.platform.shared.domain;

/** Who is calling a management endpoint, as read from the validated JWT. */
public record Actor(String email, boolean admin, boolean organizer) {
}
