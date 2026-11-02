package com.techie.microservices.ticketing.catalog.web;

import com.techie.microservices.ticketing.reporting.application.EventAnalyticsService;
import com.techie.microservices.ticketing.reporting.web.EventAnalyticsController;
import com.techie.microservices.ticketing.shared.config.CorsConfig;
import com.techie.microservices.ticketing.shared.config.SecurityConfig;
import com.techie.microservices.ticketing.shared.web.ManagementAccess;
import com.techie.microservices.ticketing.shared.web.error.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.UUID;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {EventImageController.class, EventAnalyticsController.class})
@Import({SecurityConfig.class, CorsConfig.class, GlobalExceptionHandler.class,
        com.techie.microservices.ticketing.shared.web.ratelimit.InMemoryRateLimiter.class})
class EventExtrasSecurityTest {
    @Autowired MockMvc mvc;
    @MockBean JdbcTemplate jdbc;
    @MockBean ManagementAccess access;
    @MockBean EventAnalyticsService analytics;

    @Test
    void imageUploadRequiresManagementRoleEvenForValidFiles() throws Exception {
        var file = new MockMultipartFile("file", "banner.png", "image/png", new byte[]{1});
        mvc.perform(multipart("/api/manage/event-images").file(file)).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/manage/event-images").file(file).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_USER"))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(jdbc);
    }

    @Test
    void storesOnlyDecodedPngOrJpegAndRejectsDisguisedFiles() throws Exception {
        mvc.perform(multipart("/api/manage/event-images").file(new MockMultipartFile("file", "fake.png", "image/png", "bad".getBytes()))
                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ORGANIZER")))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("JPG/PNG")));
        verifyNoInteractions(jdbc);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB), "PNG", bytes);
        mvc.perform(multipart("/api/manage/event-images").file(new MockMultipartFile("file", "banner.png", "image/png", bytes.toByteArray()))
                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ORGANIZER"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.url").value(org.hamcrest.Matchers.startsWith("/api/event-images/")));
        verify(jdbc).update(anyString(), any(UUID.class), eq("image/png"), any(byte[].class));
    }

    @Test
    void analyticsRequiresAnAuthorizedEventOwner() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(get("/api/manage/events/" + id + "/analytics")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/manage/events/" + id + "/analytics").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_USER"))))
                .andExpect(status().isForbidden());
        doThrow(new com.techie.microservices.ticketing.catalog.domain.exception.EventNotFoundException(id))
                .when(access).assertCanManage(eq(id), any(), any());
        mvc.perform(get("/api/manage/events/" + id + "/analytics").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ORGANIZER"))))
                .andExpect(status().isNotFound());
        verifyNoInteractions(analytics);
    }

    @Test
    void publicViewRecordingDoesNotExposeManagementAnalytics() throws Exception {
        UUID id = UUID.randomUUID();
        mvc.perform(post("/api/event/" + id + "/views")).andExpect(status().isNoContent());
        verify(analytics).recordView(id);
    }
}
