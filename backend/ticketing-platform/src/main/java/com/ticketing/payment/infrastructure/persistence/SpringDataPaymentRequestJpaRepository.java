package com.ticketing.payment.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

public interface SpringDataPaymentRequestJpaRepository extends JpaRepository<PaymentRequestEntity, Long> {
    Optional<PaymentRequestEntity> findByReservationId(UUID reservationId);

    Optional<PaymentRequestEntity> findByTxnRef(String txnRef);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PaymentRequestEntity p SET p.status = :status, p.completedAt = :completedAt, "
            + "p.providerTxnNo = :providerTxnNo, p.providerPaidAt = :providerPaidAt, p.failureReason = :failureReason "
            + "WHERE p.paymentRequestId = :paymentRequestId AND p.status = 'PENDING'")
    int updateIfPending(@Param("paymentRequestId") UUID paymentRequestId,
                        @Param("status") String status,
                        @Param("completedAt") Instant completedAt,
                        @Param("providerTxnNo") String providerTxnNo,
                        @Param("providerPaidAt") String providerPaidAt,
                        @Param("failureReason") String failureReason);

    Optional<PaymentRequestEntity> findByPaymentRequestId(UUID paymentRequestId);

    List<PaymentRequestEntity> findByStatusAndProvider(String status, String provider);

    @Query("SELECT p.reservationId FROM PaymentRequestEntity p WHERE p.status = 'PENDING' AND p.reservationId IN :ids")
    List<UUID> findPendingReservationIds(@Param("ids") Collection<UUID> ids);
}
