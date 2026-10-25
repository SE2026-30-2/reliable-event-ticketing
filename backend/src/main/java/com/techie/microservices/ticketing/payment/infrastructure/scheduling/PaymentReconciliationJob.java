package com.techie.microservices.ticketing.payment.infrastructure.scheduling;

import com.techie.microservices.ticketing.payment.application.port.OnlinePaymentUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** The safety net under the IPN: a lost or unreachable callback must not leave a buyer's
 * payment, or a reservation, hanging. */
@Component
@ConditionalOnProperty(name = "ticketing.payment.provider", havingValue = "vnpay")
@RequiredArgsConstructor
public class PaymentReconciliationJob {

    private final OnlinePaymentUseCase onlinePayment;

    @Scheduled(fixedDelayString = "${ticketing.payment.reconcile.interval-ms:60000}")
    public void run() {
        onlinePayment.reconcile();
    }
}
