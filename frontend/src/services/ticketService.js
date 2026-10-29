import axiosClient from './axiosClient';

export const ticketService = {
    // Lấy danh sách vé của tôi
    getMyTickets: async () => {
        return axiosClient.get('/api/my/tickets');
    },

    // Lấy chi tiết 1 vé theo ID
    getTicketById: async (ticketId) => {
        return axiosClient.get(`/api/ticket/${ticketId}`);
    },

    // Lấy danh sách vé thuộc về 1 sự kiện cụ thể
    getTicketsByEvent: async (eventId) => {
        return axiosClient.get(`/api/event/${eventId}/tickets`);
    },

    // Giữ chỗ / Đặt vé (Tạo reservation)
    createReservation: async (ticketTypeId, payload) => {
        return axiosClient.post(`/api/ticket-types/${ticketTypeId}/reservations`, payload);
    },

    // Chuyển nhượng vé cho người khác
    transferTicket: async (ticketId, payload) => {
        // payload: { toEmail: "...", holderName: "..." }
        return axiosClient.post(`/api/ticket/${ticketId}/transfer`, payload);
    },

    // Gửi lại email chứa vé và mã QR
    resendTicketEmail: async (ticketId) => {
        return axiosClient.post(`/api/ticket/${ticketId}/resend`, {});
    },

    // Cập nhật trạng thái vé (VD: CANCELLED, USED...)
    updateTicketStatus: async (ticketId, status) => {
        return axiosClient.patch(`/api/ticket/${ticketId}/status`, { status });
    },

    // Lấy danh sách chờ của tôi
    getMyWaitlist: async () => {
        return axiosClient.get('/api/my/waitlist');
    },

    // Tham gia danh sách chờ khi loại vé đã hết
    joinWaitlist: async (ticketTypeId, payload) => {
        return axiosClient.post(`/api/ticket-types/${ticketTypeId}/waitlist`, payload);
    },

    // Rời khỏi danh sách chờ
    leaveWaitlist: async (waitlistId) => {
        return axiosClient.delete(`/api/waitlist/${waitlistId}`);
    }
};