import axiosClient from './axiosClient';

export const eventService = {
    /**
     * Lấy danh sách sự kiện
     * GET /api/event?q={keyword}&page={page}&size={size}
     */
    getEvents: async (query = '', page = 0, size = 12) => {
        // AxiosClient đã có sẵn baseURL là TICKETING_SERVICE_URL (Port 8091)
        return await axiosClient.get('/api/event', {
            params: {
                q: query,
                page,
                size,
            },
        });
    },

    /**
     * Lấy chi tiết 1 sự kiện
     * GET /api/event/{id}
     */
    getEventById: async (eventId) => {
        return await axiosClient.get(`/api/event/${eventId}`);
    },
};