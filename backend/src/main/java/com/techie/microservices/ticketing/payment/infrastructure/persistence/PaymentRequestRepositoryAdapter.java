package com.techie.microservices.ticketing.payment.infrastructure.persistence;

import com.techie.microservices.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.techie.microservices.ticketing.payment.domain.model.PaymentRequest;
import com.techie.microservices.ticketing.payment.domain.model.PaymentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PaymentRequestRepositoryAdapter implements PaymentRequestRepositoryPort {

    private final SpringDataPaymentRequestJpaRepository jpaRepository;

    @Override
    public PaymentRequest save(PaymentRequest paymentRequest) {
        return toDomain(jpaRepository.save(toEntity(paymentRequest)));
    }

    @Override
    public Optional<PaymentRequest> findByTxnRef(String txnRef) {
        return jpaRepository.findByTxnRef(txnRef).map(PaymentRequestRepositoryAdapter::toDomain);
    }

    @Override
    public Optional<PaymentRequest> findByPaymentRequestId(UUID paymentRequestId) {
        return jpaRepository.findByPaymentRequestId(paymentRequestId).map(PaymentRequestRepositoryAdapter::toDomain);
    }

    @Override
    public List<PaymentRequest> findByStatusAndProvider(PaymentStatus status, String provider) {
        return jpaRepository.findByStatusAndProvider(status.name(), provider).stream().map(PaymentRequestRepositoryAdapter::toDomain).toList();
    }

    @Override
    public Set<UUID> findReservationIdsWithPendingPayment(Collection<UUID> reservationIds) {
        if (reservationIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(jpaRepository.findPendingReservationIds(reservationIds));
    }

    @Override
    public Optional<PaymentRequest> findByReservationId(UUID reservationId) {
        return jpaRepository.findByReservationId(reservationId).map(PaymentRequestRepositoryAdapter::toDomain);
    }

    private static PaymentRequestEntity toEntity(PaymentRequest paymentRequest) {
        return PaymentRequestEntity.builder()
                .id(paymentRequest.getId())
                .paymentRequestId(paymentRequest.getPaymentRequestId())
                .reservationId(paymentRequest.getReservationId())
                .amountCents(paymentRequest.getAmountCents())
                .status(paymentRequest.getStatus().name())
                .createdAt(paymentRequest.getCreatedAt())
                .completedAt(paymentRequest.getCompletedAt())
                .provider(paymentRequest.getProvider() == null ? "MOCK" : paymentRequest.getProvider())
                .txnRef(paymentRequest.getTxnRef())
                .providerTxnNo(paymentRequest.getProviderTxnNo())
                .providerCreatedAt(paymentRequest.getProviderCreatedAt())
                .providerPaidAt(paymentRequest.getProviderPaidAt())
                .payExpiresAt(paymentRequest.getPayExpiresAt())
                .failureReason(paymentRequest.getFailureReason())
                .refundedAt(paymentRequest.getRefundedAt())
                .build();
    }

    private static PaymentRequest toDomain(PaymentRequestEntity entity) {
        return PaymentRequest.builder()
                .id(entity.getId())
                .paymentRequestId(entity.getPaymentRequestId())
                .reservationId(entity.getReservationId())
                .amountCents(entity.getAmountCents())
                .status(PaymentStatus.valueOf(entity.getStatus()))
                .createdAt(entity.getCreatedAt())
                .completedAt(entity.getCompletedAt())
                .provider(entity.getProvider())
                .txnRef(entity.getTxnRef())
                .providerTxnNo(entity.getProviderTxnNo())
                .providerCreatedAt(entity.getProviderCreatedAt())
                .providerPaidAt(entity.getProviderPaidAt())
                .payExpiresAt(entity.getPayExpiresAt())
                .failureReason(entity.getFailureReason())
                .refundedAt(entity.getRefundedAt())
                .build();
    }
}
