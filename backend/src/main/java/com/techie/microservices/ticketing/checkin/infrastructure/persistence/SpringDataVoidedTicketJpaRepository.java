package com.techie.microservices.ticketing.checkin.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface SpringDataVoidedTicketJpaRepository extends JpaRepository<VoidedTicketEntity, UUID> {
}
