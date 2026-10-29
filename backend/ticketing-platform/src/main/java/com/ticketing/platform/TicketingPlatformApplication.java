package com.ticketing.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TicketingPlatformApplication {

	public static void main(String[] args) {
		SpringApplication.run(TicketingPlatformApplication.class, args);
	}

}
