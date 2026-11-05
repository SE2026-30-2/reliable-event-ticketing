import axiosClient from './axiosClient';

export const ticketService = {
    // Lấy danh sách vé của tôi
    getMyTickets: async ({ page = 0, size = 20, signal } = {}) => {
        return axiosClient.get('/api/my/tickets', { params: { page, size }, signal });
    },

    // The buyer API is paginated; consumers must not mistake one page for all tickets.
    getAllMyTickets: async ({ signal } = {}) => {
        const tickets = new Map();
        let page = 0, totalPages;
        do {
            const data = await ticketService.getMyTickets({ page, size: 200, signal });
            const rows = Array.isArray(data) ? data : data?.content;
            if (!Array.isArray(rows)) throw new Error('Máy chủ chưa trả danh sách vé hợp lệ.');
            for (const ticket of rows) tickets.set(ticket.ticketId, ticket);
            totalPages = Array.isArray(data) ? 1 : data.totalPages ?? 1;
            page++;
        } while (page < totalPages);
        return [...tickets.values()];
    },

    // Recover email/deep links through the existing owner-only ticket endpoints.
    getReservation: async (reservationId, { signal, ticketIds } = {}) => {
        const mine = ticketIds?.length
            ? await Promise.all(ticketIds.map(id => ticketService.getTicketById(id, { signal })))
            : await ticketService.getAllMyTickets({ signal });
        const tickets = mine.filter(ticket => ticket.reservationId?.toLowerCase() === reservationId.toLowerCase());
        if (!tickets.length) throw new Error('Không tìm thấy đơn đặt chỗ của bạn.');
        const totalCents = tickets.reduce((sum, ticket) => sum + ticket.priceCents, 0);
        if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error('Không xác định được số tiền của đơn đặt chỗ.');
        return { reservationId, tickets, totalCents, eventId: tickets[0].eventId };
    },

    // Lấy chi tiết 1 vé theo ID
    getTicketById: async (ticketId, { signal } = {}) => {
        return axiosClient.get(`/api/ticket/${encodeURIComponent(ticketId)}`, { signal });
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
