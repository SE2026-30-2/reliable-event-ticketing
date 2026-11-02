package com.techie.microservices.ticketing.payment.web;

import com.techie.microservices.ticketing.payment.application.port.GetAdminPaymentUseCase;
import com.techie.microservices.ticketing.payment.domain.exception.PaymentNotFoundException;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import com.techie.microservices.ticketing.shared.config.CorsConfig;
import com.techie.microservices.ticketing.shared.config.SecurityConfig;
import com.techie.microservices.ticketing.shared.web.error.GlobalExceptionHandler;
import com.techie.microservices.ticketing.shared.web.ratelimit.InMemoryRateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Instant;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AdminPaymentController.class)
@Import({SecurityConfig.class, CorsConfig.class, GlobalExceptionHandler.class, InMemoryRateLimiter.class})
class AdminPaymentControllerTest {
    @Autowired MockMvc mvc;
    @MockBean GetAdminPaymentUseCase payments;
    private final UUID reservationId = UUID.randomUUID();
    private final UUID paymentId = UUID.randomUUID();

    @Test
    void anonymousBuyersAndOrganizersCannotProbeEitherLookup() throws Exception {
        for (String path : new String[]{"/api/admin/payments/by-reservation/" + reservationId, "/api/admin/payments/" + paymentId}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            for (String role : new String[]{"USER", "ORGANIZER"}) {
                mvc.perform(get(path).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                        .andExpect(status().isForbidden());
            }
        }
        verifyNoInteractions(payments);
    }

    @Test
    void adminReadsAnotherBuyersFreeOrMockPaymentByEitherIdentifier() throws Exception {
        PaymentRequest payment = PaymentRequest.builder().paymentRequestId(paymentId).reservationId(reservationId)
                .provider("MOCK").status(PaymentStatus.COMPLETED).amountCents(25000000).createdAt(Instant.now()).build();
        when(payments.getByReservation(reservationId)).thenReturn(payment);
        when(payments.getByPaymentId(paymentId)).thenReturn(payment);
        for (String path : new String[]{"/api/admin/payments/by-reservation/" + reservationId, "/api/admin/payments/" + paymentId}) {
            mvc.perform(get(path).with(jwt().jwt(j -> j.subject("admin@other.test")).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                    .andExpect(status().isOk()).andExpect(jsonPath("reservationId").value(reservationId.toString()))
                    .andExpect(jsonPath("paymentRequestId").value(paymentId.toString())).andExpect(jsonPath("provider").value("MOCK"));
        }
    }

    @Test
    void adminReceivesNotFoundAndMalformedIdsAreRejected() throws Exception {
        when(payments.getByPaymentId(paymentId)).thenThrow(new PaymentNotFoundException(paymentId.toString()));
        mvc.perform(get("/api/admin/payments/{id}", paymentId).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/admin/payments/not-a-uuid").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isBadRequest());
    }
}
