package com.techie.microservices.ticketing.shared.web;

import com.techie.microservices.ticketing.shared.application.port.EventAccessPort;
import com.techie.microservices.ticketing.shared.domain.Actor;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Controller-side entry to {@link EventAccessPort}: turns the request's JWT into an {@link Actor}. */
@Component
@RequiredArgsConstructor
public class ManagementAccess {

    private final EventAccessPort eventAccessPort;

    public Actor actor(Jwt jwt, Authentication authentication) {
        return AuthenticatedUser.actor(jwt, authentication);
    }

    public void assertCanManage(UUID eventId, Jwt jwt, Authentication authentication) {
        eventAccessPort.assertCanManage(eventId, actor(jwt, authentication));
    }

    public boolean canManage(UUID eventId, Jwt jwt, Authentication authentication) {
        return eventAccessPort.canManage(eventId, actor(jwt, authentication));
    }
}
