package com.ticketing.payment.application.service;

import com.ticketing.payment.application.port.OnlinePaymentPort;
import com.ticketing.payment.application.port.PaymentRequestRepositoryPort;
import com.ticketing.payment.application.port.ReservationPricingPort;
import com.ticketing.payment.domain.model.PaymentRequest;
import com.ticketing.payment.domain.model.PaymentStatus;
import com.ticketing.shared.application.port.OutboxEventPublisherPort;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/** Local service-level harness. Provider, repository, and outbox are deterministic in-memory fakes. */
class VnpaySyncLoadHarnessTest {

    private static final int USERS = 60;
    private static final Duration TARGET_P95 = Duration.ofSeconds(2);

    @Test
    void sixtyConcurrentSyncTasksMeetP95AndEmitOneEventPerPayment() throws Exception {
        InMemoryPaymentRepository repository = new InMemoryPaymentRepository();
        CountingProvider provider = new CountingProvider();
        CountingOutbox outbox = new CountingOutbox();
        OnlinePaymentApplicationService service = new OnlinePaymentApplicationService(repository, provider, outbox,
                new HeldReservation(), 90, 120);

        List<String> txnRefs = new ArrayList<>();
        for (int index = 0; index < USERS; index++) {
            String txnRef = "vt048-load-" + index;
            txnRefs.add(txnRef);
            repository.seed(payment(index, txnRef));
        }

        ExecutorService workers = Executors.newFixedThreadPool(USERS);
        CountDownLatch ready = new CountDownLatch(USERS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Long>> tasks = new ArrayList<>();
        try {
            for (int index = 0; index < USERS; index++) {
                final int userIndex = index;
                String txnRef = txnRefs.get(index);
                tasks.add(workers.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("load start barrier timed out");
                    }
                    long began = System.nanoTime();
                    PaymentRequest settled = service.sync(txnRef, "vt048-user-" + userIndex + "@example.test");
                    long elapsed = System.nanoTime() - began;
                    assertThat(settled.getStatus()).isEqualTo(PaymentStatus.COMPLETED);
                    return elapsed;
                }));
            }

            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<Long> latencies = new ArrayList<>();
            for (Future<Long> task : tasks) {
                latencies.add(task.get(10, TimeUnit.SECONDS));
            }
            latencies.sort(Comparator.naturalOrder());
            long p95Nanos = latencies.get((int) Math.ceil(USERS * 0.95) - 1);

            System.out.printf("VT-048_LOAD users=%d tasks=%d p95_ms=%.3f queries=%d events=%d%n",
                    USERS, latencies.size(), p95Nanos / 1_000_000.0, provider.queryCount.get(), outbox.eventCount.get());
            assertThat(latencies).hasSize(USERS);
            assertThat(Duration.ofNanos(p95Nanos)).isLessThanOrEqualTo(TARGET_P95);
            assertThat(provider.queryCount).hasValue(USERS);
            assertThat(repository.transitionCount).hasValue(USERS);
            assertThat(outbox.eventCount).hasValue(USERS);
            assertThat(outbox.eventsPerPayment.values()).allSatisfy(count -> assertThat(count).hasValue(1));
        } finally {
            start.countDown();
            workers.shutdownNow();
            assertThat(workers.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private static PaymentRequest payment(int index, String txnRef) {
        UUID reservationId = UUID.nameUUIDFromBytes(("vt048-reservation-" + index).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        UUID paymentId = UUID.nameUUIDFromBytes(("vt048-payment-" + index).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return PaymentRequest.builder().paymentRequestId(paymentId).reservationId(reservationId)
                .amountCents(1_000_000L + index).status(PaymentStatus.PENDING)
                .createdAt(Instant.parse("2026-01-01T00:00:00Z")).payExpiresAt(Instant.parse("2026-01-01T00:10:00Z"))
                .provider("VNPAY").txnRef(txnRef).providerCreatedAt("20260101070000").build();
    }

    private static PaymentRequest copy(PaymentRequest source) {
        return PaymentRequest.builder().id(source.getId()).paymentRequestId(source.getPaymentRequestId())
                .reservationId(source.getReservationId()).amountCents(source.getAmountCents()).status(source.getStatus())
                .createdAt(source.getCreatedAt()).completedAt(source.getCompletedAt()).provider(source.getProvider())
                .txnRef(source.getTxnRef()).providerTxnNo(source.getProviderTxnNo())
                .providerCreatedAt(source.getProviderCreatedAt()).providerPaidAt(source.getProviderPaidAt())
                .payExpiresAt(source.getPayExpiresAt()).failureReason(source.getFailureReason())
                .refundedAt(source.getRefundedAt()).paymentUrl(source.getPaymentUrl()).build();
    }

    private static final class InMemoryPaymentRepository implements PaymentRequestRepositoryPort {
        private final Map<String, PaymentRequest> payments = new ConcurrentHashMap<>();
        private final AtomicInteger transitionCount = new AtomicInteger();

        void seed(PaymentRequest payment) {
            payments.put(payment.getTxnRef(), copy(payment));
        }

        @Override
        public PaymentRequest save(PaymentRequest paymentRequest) {
            payments.put(paymentRequest.getTxnRef(), copy(paymentRequest));
            return copy(paymentRequest);
        }

        @Override
        public boolean saveIfPending(PaymentRequest paymentRequest) {
            AtomicBoolean won = new AtomicBoolean();
            payments.compute(paymentRequest.getTxnRef(), (txnRef, current) -> {
                if (current == null || current.getStatus() != PaymentStatus.PENDING) {
                    return current;
                }
                won.set(true);
                return copy(paymentRequest);
            });
            if (won.get()) {
                transitionCount.incrementAndGet();
            }
            return won.get();
        }

        @Override
        public Optional<PaymentRequest> findByReservationId(UUID reservationId) {
            return payments.values().stream().filter(payment -> payment.getReservationId().equals(reservationId))
                    .findFirst().map(VnpaySyncLoadHarnessTest::copy);
        }

        @Override
        public Optional<PaymentRequest> findByTxnRef(String txnRef) {
            return Optional.ofNullable(payments.get(txnRef)).map(VnpaySyncLoadHarnessTest::copy);
        }

        @Override
        public Optional<PaymentRequest> findByPaymentRequestId(UUID paymentRequestId) {
            return payments.values().stream().filter(payment -> payment.getPaymentRequestId().equals(paymentRequestId))
                    .findFirst().map(VnpaySyncLoadHarnessTest::copy);
        }

        @Override
        public List<PaymentRequest> findByStatusAndProvider(PaymentStatus status, String provider) {
            return payments.values().stream().filter(payment -> payment.getStatus() == status)
                    .filter(payment -> provider.equals(payment.getProvider())).map(VnpaySyncLoadHarnessTest::copy).toList();
        }

        @Override
        public Set<UUID> findReservationIdsWithPendingPayment(Collection<UUID> reservationIds) {
            return payments.values().stream().filter(payment -> payment.getStatus() == PaymentStatus.PENDING)
                    .map(PaymentRequest::getReservationId).filter(reservationIds::contains).collect(java.util.stream.Collectors.toSet());
        }
    }

    private static final class CountingProvider implements OnlinePaymentPort {
        private final AtomicInteger queryCount = new AtomicInteger();

        @Override
        public String buildPaymentUrl(PaymentRequest payment, String clientIp) {
            return "https://vnpay.example/" + payment.getTxnRef();
        }

        @Override
        public Optional<ProviderCallback> verifyCallback(Map<String, String> params) {
            return Optional.empty();
        }

        @Override
        public ProviderTransaction query(PaymentRequest payment) {
            queryCount.incrementAndGet();
            return new ProviderTransaction(TransactionState.SUCCESS, payment.getAmountCents(),
                    "provider-" + payment.getTxnRef(), "20260101080000", "OK");
        }

        @Override
        public RefundResult refund(PaymentRequest payment, String requestedBy) {
            return new RefundResult(false, "not used by the load harness");
        }
    }

    private static final class HeldReservation implements ReservationPricingPort {
        @Override
        public Quote quote(UUID reservationId, String requesterEmail) {
            throw new UnsupportedOperationException("not used by the load harness");
        }

        @Override
        public void assertOwnedBy(UUID reservationId, String requesterEmail) {
            // All generated users own their generated reservation in this harness.
        }

        @Override
        public boolean isStillHeld(UUID reservationId) {
            return true;
        }
    }

    private static final class CountingOutbox implements OutboxEventPublisherPort {
        private final AtomicInteger eventCount = new AtomicInteger();
        private final Map<String, AtomicInteger> eventsPerPayment = new ConcurrentHashMap<>();

        @Override
        public void publish(String aggregateId, String eventType, String topic, Object payload) {
            eventCount.incrementAndGet();
            eventsPerPayment.computeIfAbsent(aggregateId, ignored -> new AtomicInteger()).incrementAndGet();
        }
    }
}
