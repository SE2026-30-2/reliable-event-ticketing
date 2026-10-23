import axiosClient, { TICKETING_SERVICE_URL } from './axiosClient';

export const eventService = {
    /**
     * Lấy danh sách sự kiện
     * GET http://localhost:8091/api/event?q={keyword}&page={page}&size={size}
     */
    getEvents: async (query = '', page = 0, size = 12) => {
        const data = await axiosClient.get('/api/event', {
            baseURL: TICKETING_SERVICE_URL, // Đảm bảo gọi sang port 8091
            params: {
                q: query,
                page,
                size,
            },
        });
        return data; // Trả về thẳng Page<EventSummary>
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
    getTicketTypes: (eventId, { signal } = {}) => axiosClient.get(
        `/api/event/${encodeURIComponent(eventId)}/ticket-types`,
        { baseURL: TICKETING_SERVICE_URL, signal, timeout: 15000 },
    ),
};
