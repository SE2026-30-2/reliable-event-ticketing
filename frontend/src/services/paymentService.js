import axiosClient from './axiosClient';

export function validatePayment(payment, reservationId) {
    if (typeof payment?.paymentRequestId !== 'string' || !payment.paymentRequestId.trim() || typeof payment.reservationId !== 'string' || !payment.reservationId.trim() || (reservationId && payment.reservationId.toLowerCase() !== reservationId.toLowerCase())
        || !['PENDING', 'COMPLETED', 'FAILED', 'REFUND_REQUIRED', 'REFUNDED'].includes(payment.status)
        || !['MOCK', 'VNPAY', 'FREE'].includes(payment.provider) || !Number.isSafeInteger(payment.amountCents) || payment.amountCents < 0) {
        throw new Error('Phản hồi thanh toán chưa xác nhận đúng giao dịch. Vui lòng tra cứu lại.');
    }
    return payment;
}

export const paymentService = {
    createPaymentRequest: async (reservationId, forceOutcome = null, { signal } = {}) => {
        const body = { reservationId };
        if (forceOutcome) body.forceOutcome = forceOutcome;
        return axiosClient.post('/api/payment/requests', body, { signal });
    },

    syncPaymentStatus: async (txnRef, { signal } = {}) => {
        return axiosClient.post(
            `/api/payment/vnpay/sync/${encodeURIComponent(txnRef)}`,
            undefined,
            { signal }
        );
    },

    getPaymentByReservation: async (reservationId, { signal } = {}) => {
        return axiosClient.get(
            `/api/payment/requests/by-reservation/${encodeURIComponent(reservationId)}`,
            { signal }
        );
    },

    refundPaymentRequest: async (paymentRequestId, { signal } = {}) => {
        return axiosClient.post(
            `/api/payment/requests/${encodeURIComponent(paymentRequestId)}/refund`,
            undefined,
            { signal }
        );
    },
};
