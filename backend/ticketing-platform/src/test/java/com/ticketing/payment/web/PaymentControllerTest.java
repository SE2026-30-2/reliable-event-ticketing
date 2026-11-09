package com.ticketing.payment.web;

import com.ticketing.payment.application.port.OnlinePaymentUseCase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class PaymentControllerTest {

    @Test
    void ipnPersistenceFailurePropagatesOutOfController() throws Exception {
        OnlinePaymentUseCase online = mock(OnlinePaymentUseCase.class);
        ObjectProvider<OnlinePaymentUseCase> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(online);
        when(online.handleIpn(anyMap())).thenThrow(new DataAccessResourceFailureException("database unavailable"));

        PaymentController controller = new PaymentController(null, provider);
        MockMvc mvc = standaloneSetup(controller).build();

        assertThatThrownBy(() -> mvc.perform(get("/api/payment/vnpay/ipn").param("vnp_TxnRef", "ref1")))
                .hasRootCauseInstanceOf(DataAccessResourceFailureException.class);
    }
}
