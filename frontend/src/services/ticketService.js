import axiosClient from './axiosClient';

export const ticketService = {
    // 1. Lấy danh sách vé của tôi (GET /api/my/tickets)
    getMyTickets: async () => {
        return axiosClient.get('/api/my/tickets');
    },

    // 2. Lấy danh sách chờ của tôi (GET /api/my/waitlist)
    getMyWaitlist: async () => {
        return axiosClient.get('/api/my/waitlist');
    },

    // 3. Gửi lại email chứa vé và mã QR (POST /api/ticket/:id/resend)
    resendTicketEmail: async (ticketId) => {
        return axiosClient.post(`/api/ticket/${ticketId}/resend`, {});
    },

    // 4. Chuyển nhượng vé cho người khác (POST /api/ticket/:id/transfer)
    transferTicket: async (ticketId, payload) => {
        // payload gồm: { toEmail: "...", holderName: "..." }
        return axiosClient.post(`/api/ticket/${ticketId}/transfer`, payload);
    },

    // 5. Rời khỏi danh sách chờ (DELETE /api/waitlist/:id)
    leaveWaitlist: async (waitlistId) => {
        return axiosClient.delete(`/api/waitlist/${waitlistId}`);
    }
};