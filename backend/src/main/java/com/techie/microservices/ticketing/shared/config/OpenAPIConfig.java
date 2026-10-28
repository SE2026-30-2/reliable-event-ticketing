package com.techie.microservices.ticketing.shared.config;

import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenAPIConfig {

    @Bean
    public OpenAPI ticketServiceAPI() {
        return new OpenAPI()
                .info(new Info().title("GateKeep API")
                        .description("Event ticketing with signed QR tickets, offline-first check-in, payments, waitlist and organizer reporting")
                        .version("v0.0.1")
                        .license(new License().name("Apache 2.0").url("http://springdoc.org")))
                .externalDocs(new ExternalDocumentation()
                        .description("GateKeep documentation")
                        .url("https://github.com/your-org/gatekeep")
                );
    }
}
