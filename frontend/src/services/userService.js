import axiosClient, { USER_SERVICE_URL } from './axiosClient';

export const userService = {
    getProfile: async () => {
        return axiosClient.get('/api/user/me', { baseURL: USER_SERVICE_URL });
    },

    logout: async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        return axiosClient.post(
            '/api/user/logout',
            { refreshToken: refreshToken || '' },
            { baseURL: USER_SERVICE_URL }
        );
    },

    resendVerificationEmail: async () => {
        return axiosClient.post('/api/user/email/verify/resend', {}, { baseURL: USER_SERVICE_URL });
    },
};