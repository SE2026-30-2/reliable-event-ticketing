package com.ticketing.payment.infrastructure.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

@TestConfiguration
class PaymentSyncTestConfiguration {
    @Bean
    ObjectMapper testObjectMapper() {
        return new ObjectMapper();
    }
}
