import axiosClient from './axiosClient';

export const paymentService = {
    createPaymentRequest: async (reservationId, forceOutcome = null) => {
        const body = { reservationId };
        if (forceOutcome) body.forceOutcome = forceOutcome;
        return axiosClient.post('/api/payment/requests', body);
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