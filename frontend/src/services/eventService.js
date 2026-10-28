import axiosClient, { TICKETING_SERVICE_URL } from './axiosClient';

export const eventService = {
    /**
     * Lấy danh sách sự kiện
     * GET http://localhost:8091/api/event?q={keyword}&page={page}&size={size}
     */
    getEvents: async (query = '', page = 0, size = 12) => {
        const data = await axiosClient.get('/api/event', {
            baseURL: TICKETING_SERVICE_URL,
            params: {
                q: query,
                page,
                size,
            },
        });
        return data; // Trả về Page<EventSummary>
    },

    /**
     * Lấy chi tiết 1 sự kiện
     * GET http://localhost:8091/api/event/{id}
     */
    getEventById: async (eventId, { signal } = {}) => {
        const data = await axiosClient.get(`/api/event/${encodeURIComponent(eventId)}`, {
            baseURL: TICKETING_SERVICE_URL,
            signal,
            timeout: 15000,
        });
        return data;
    },

    /**
     * Lấy danh sách loại vé của sự kiện
     * GET http://localhost:8091/api/event/{id}/ticket-types
     */
    getTicketTypesByEventId: async (eventId, { signal } = {}) => {
        const data = await axiosClient.get(`/api/event/${encodeURIComponent(eventId)}/ticket-types`, {
            baseURL: TICKETING_SERVICE_URL,
            signal,
            timeout: 15000,
        });
        return data;
    },

    /**
     * Báo giá tức thì theo loại vé, số lượng và coupon
     * GET http://localhost:8091/api/ticket-types/{id}/quote?quantity={qty}&couponCode={coupon}
     */
    getTicketQuote: async (ticketTypeId, quantity = 1, couponCode = '', { signal } = {}) => {
        const data = await axiosClient.get(`/api/ticket-types/${encodeURIComponent(ticketTypeId)}/quote`, {
            baseURL: TICKETING_SERVICE_URL,
            params: {
                quantity,
                coupon: couponCode || undefined,
            },
            signal,
            timeout: 10000,
        });
        return data;
    },
    /**
     * Giữ chỗ / Đặt vé
     * POST http://localhost:8091/api/ticket-types/{id}/reservations
     */
    createReservation: async (ticketTypeId, bookingData) => {
        const data = await axiosClient.post(
            `/api/ticket-types/${encodeURIComponent(ticketTypeId)}/reservations`,
            bookingData,
            {
                baseURL: TICKETING_SERVICE_URL,
                timeout: 15000,
            }
        );
        return data;
    },

    /**
     * Tham gia danh sách chờ khi hết vé
     * POST http://localhost:8091/api/ticket-types/{id}/waitlist
     */
    joinWaitlist: async (ticketTypeId, waitlistData) => {
        const data = await axiosClient.post(
            `/api/ticket-types/${encodeURIComponent(ticketTypeId)}/waitlist`,
            waitlistData,
            {
                baseURL: TICKETING_SERVICE_URL,
                timeout: 15000,
            }
        );
        return data;
    },
};