package com.techie.microservices.ticketing.payment.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpringDataPaymentRequestJpaRepository extends JpaRepository<PaymentRequestEntity, Long> {
    Optional<PaymentRequestEntity> findByReservationId(UUID reservationId);

    Optional<PaymentRequestEntity> findByTxnRef(String txnRef);

    Optional<PaymentRequestEntity> findByPaymentRequestId(UUID paymentRequestId);

    List<PaymentRequestEntity> findByStatusAndProvider(String status, String provider);

    @Query("SELECT p.reservationId FROM PaymentRequestEntity p WHERE p.status = 'PENDING' AND p.reservationId IN :ids")
    List<UUID> findPendingReservationIds(@Param("ids") Collection<UUID> ids);
}
