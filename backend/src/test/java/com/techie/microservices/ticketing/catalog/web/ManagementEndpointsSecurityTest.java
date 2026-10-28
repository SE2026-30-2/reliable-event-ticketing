package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.catalog.application.port.CreateEventCommand;
import com.techie.microservices.ticketing.catalog.application.port.CreateEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.CreateTicketTypeUseCase;
import com.techie.microservices.ticketing.catalog.application.port.GetEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListEventsUseCase;
import com.techie.microservices.ticketing.catalog.application.port.ListTicketTypesForEventUseCase;
import com.techie.microservices.ticketing.catalog.application.port.UpdateEventUseCase;
import com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException;
import com.techie.microservices.ticketing.catalog.domain.model.Event;
import com.techie.microservices.ticketing.catalog.domain.model.EventStatus;
import com.techie.microservices.ticketing.checkin.application.port.DeviceRepositoryPort;
import com.techie.microservices.ticketing.checkin.application.port.GetCheckinStatsUseCase;
import com.techie.microservices.ticketing.checkin.application.port.GetCheckinTimelineUseCase;
import com.techie.microservices.ticketing.checkin.application.port.ListDevicesUseCase;
import com.techie.microservices.ticketing.checkin.application.port.RegisterDeviceUseCase;
import com.techie.microservices.ticketing.checkin.application.port.RevokeDeviceUseCase;
import com.techie.microservices.ticketing.checkin.web.CheckinDashboardController;
import com.techie.microservices.ticketing.checkin.web.CheckinDeviceController;
import com.techie.microservices.ticketing.reporting.application.EventReportService;
import com.techie.microservices.ticketing.reporting.web.ReportController;
import com.techie.microservices.ticketing.shared.application.port.EventAccessPort;
import com.techie.microservices.ticketing.shared.config.CorsConfig;
import com.techie.microservices.ticketing.shared.config.SecurityConfig;
import com.techie.microservices.ticketing.shared.domain.Actor;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import com.techie.microservices.ticketing.shared.web.error.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Who may call the management endpoints, over the real security chain: a plain buyer never, an
 * ORGANIZER only for events they own (anything else is a 404 - they cannot even probe for other
 * organizers' ids), and an ADMIN everywhere.
 */
@WebMvcTest(controllers = {EventController.class, TicketTypeController.class, CheckinDeviceController.class,
        CheckinDashboardController.class, ReportController.class})
@Import({SecurityConfig.class, CorsConfig.class, GlobalExceptionHandler.class, ManagementAccess.class,
        com.techie.microservices.ticketing.shared.web.ratelimit.InMemoryRateLimiter.class})
class ManagementEndpointsSecurityTest {

    @Autowired MockMvc mvc;
    @MockBean CreateEventUseCase createEvent;
    @MockBean GetEventUseCase getEvent;
    @MockBean ListEventsUseCase listEvents;
    @MockBean UpdateEventUseCase updateEvent;
    @MockBean CreateTicketTypeUseCase createTicketType;
    @MockBean ListTicketTypesForEventUseCase listTicketTypes;
    @MockBean RegisterDeviceUseCase registerDevice;
    @MockBean RevokeDeviceUseCase revokeDevice;
    @MockBean ListDevicesUseCase listDevices;
    @MockBean DeviceRepositoryPort deviceRepository;
    @MockBean GetCheckinStatsUseCase stats;
    @MockBean GetCheckinTimelineUseCase timeline;
    @MockBean EventReportService reportService;
    @MockBean EventAccessPort eventAccess;

    private final UUID eventId = UUID.randomUUID();
    private static final String NEW_EVENT = "{\"name\":\"Gig\",\"startsAt\":\"%s\",\"endsAt\":\"%s\"}";

    private static org.springframework.test.web.servlet.request.RequestPostProcessor as(String email, String... roles) {
        return jwt().jwt(j -> j.subject(email)).authorities(java.util.Arrays.stream(roles).map(r -> (org.springframework.security.core.GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toArray(org.springframework.security.core.GrantedAuthority[]::new));
    }

    private String eventJson() {
        return NEW_EVENT.formatted(Instant.now().plusSeconds(86400), Instant.now().plusSeconds(90000));
    }

    @Test
    void aPlainBuyerCannotUseAnyManagementEndpoint() throws Exception {
        var buyer = as("buyer@x.com", "USER");
        mvc.perform(post("/api/event").with(buyer).contentType(MediaType.APPLICATION_JSON).content(eventJson())).andExpect(status().isForbidden());
        mvc.perform(patch("/api/event/{id}", eventId).with(buyer).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/manage/events").with(buyer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/manage/events/{id}/report", eventId).with(buyer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/checkin/events/{id}/stats", eventId).with(buyer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/checkin/events/{id}/timeline", eventId).with(buyer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/checkin/devices").param("eventId", eventId.toString()).with(buyer)).andExpect(status().isForbidden());
        verify(createEvent, never()).createEvent(any());
    }

    @Test
    void anOrganizerCreatesAnEventOwnedByTheirOwnAccount() throws Exception {
        when(createEvent.createEvent(any())).thenReturn(Event.builder().eventId(eventId).name("Gig").status(EventStatus.PUBLISHED)
                .startsAt(Instant.now()).endsAt(Instant.now()).build());
        mvc.perform(post("/api/event").with(as("Org@X.com", "ORGANIZER")).contentType(MediaType.APPLICATION_JSON).content(eventJson()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.organizerId").doesNotExist()); // an organizer's email is not exposed publicly
        ArgumentCaptor<CreateEventCommand> cmd = ArgumentCaptor.forClass(CreateEventCommand.class);
        verify(createEvent).createEvent(cmd.capture());
        assertThat(cmd.getValue().organizerId()).isEqualTo("org@x.com"); // from the JWT, never from the body
    }

    @Test
    void anOrganizerManagingSomeoneElsesEventGetsA404ForEveryManagementRoute() throws Exception {
        doThrow(new EventNotFoundException(eventId)).when(eventAccess).assertCanManage(eq(eventId), any(Actor.class));
        var org = as("org@x.com", "ORGANIZER");
        mvc.perform(patch("/api/event/{id}", eventId).with(org).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"x\"}")).andExpect(status().isNotFound());
        mvc.perform(post("/api/event/{id}/ticket-types", eventId).with(org).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"GA\",\"priceCents\":1,\"quota\":1,\"validFrom\":\"%s\",\"validUntil\":\"%s\"}".formatted(Instant.now(), Instant.now().plusSeconds(60))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/manage/events/{id}/report", eventId).with(org)).andExpect(status().isNotFound());
        mvc.perform(get("/api/manage/events/{id}/attendees.csv", eventId).with(org)).andExpect(status().isNotFound());
        mvc.perform(get("/api/checkin/events/{id}/stats", eventId).with(org)).andExpect(status().isNotFound());
        mvc.perform(get("/api/checkin/events/{id}/timeline", eventId).with(org)).andExpect(status().isNotFound());
        mvc.perform(get("/api/checkin/devices").param("eventId", eventId.toString()).with(org)).andExpect(status().isNotFound());
        verify(createTicketType, never()).createTicketType(any());
        verify(stats, never()).getStats(any());
        verify(reportService, never()).report(any());
    }

    @Test
    void anOrganizerCannotRegisterOrListPlatformWideDevices() throws Exception {
        var org = as("org@x.com", "ORGANIZER");
        mvc.perform(post("/api/checkin/devices").with(org).contentType(MediaType.APPLICATION_JSON).content("{\"label\":\"gate\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/checkin/devices").with(org)).andExpect(status().isForbidden());
        verify(registerDevice, never()).registerDevice(any());
    }

    @Test
    void anAdminMayRegisterAPlatformWideDeviceAndSeesEveryEventInTheManageList() throws Exception {
        when(listEvents.listManageableEvents(any(Actor.class))).thenReturn(List.of());
        mvc.perform(get("/api/manage/events").with(as("root@x.com", "ADMIN"))).andExpect(status().isOk());
        ArgumentCaptor<Actor> actor = ArgumentCaptor.forClass(Actor.class);
        verify(listEvents).listManageableEvents(actor.capture());
        assertThat(actor.getValue().admin()).isTrue();

        when(registerDevice.registerDevice(any())).thenReturn(new com.techie.microservices.ticketing.checkin.application.port.RegisteredDevice(
                com.techie.microservices.ticketing.checkin.domain.model.CheckinDevice.builder().deviceId(UUID.randomUUID()).label("gate")
                        .status(com.techie.microservices.ticketing.checkin.domain.model.DeviceStatus.ACTIVE).build(), "key"));
        mvc.perform(post("/api/checkin/devices").with(as("root@x.com", "ADMIN")).contentType(MediaType.APPLICATION_JSON).content("{\"label\":\"gate\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void aDraftEventIsInvisibleToThePublicButVisibleToItsManager() throws Exception {
        when(getEvent.getEvent(eventId)).thenReturn(Event.builder().eventId(eventId).name("Secret").status(EventStatus.DRAFT)
                .startsAt(Instant.now()).endsAt(Instant.now()).build());
        mvc.perform(get("/api/event/{id}", eventId)).andExpect(status().isNotFound());
        mvc.perform(get("/api/event/{id}/ticket-types", eventId)).andExpect(status().isNotFound());

        when(eventAccess.canManage(eq(eventId), any(Actor.class))).thenReturn(true);
        mvc.perform(get("/api/event/{id}", eventId).with(as("org@x.com", "ORGANIZER"))).andExpect(status().isOk());
    }

    @Test
    void thePublicListingNeedsNoLogin() throws Exception {
        when(listEvents.listPublicEvents(any())).thenReturn(List.of());
        mvc.perform(get("/api/event").param("q", "rock")).andExpect(status().isOk());
        verify(listEvents).listPublicEvents("rock");
    }
}
