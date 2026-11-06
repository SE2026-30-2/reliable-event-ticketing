import { userClient } from './axiosClient';

export const userService = {
    getProfile: async () => {
        return userClient.get('/api/user/me');
    },

    logout: async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        return userClient.post('/api/user/logout', {
            refreshToken: refreshToken || '',
        });
    },

    refreshToken: async (token) => {
        const refreshToken = token || localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('Không tìm thấy refresh token.');
        }
        return userClient.post('/api/user/refresh', { refreshToken }, { skipAuth: true, _isRefresh: true });
    },

    resendVerificationEmail: async () => {
        return userClient.post('/api/user/email/verify/resend', {});
    },

    verifyEmail: async (token) => {
        // token lấy từ URL params (?token=...)
        return userClient.post('/api/user/email/verify', { token });
    },

    forgotPassword: async (email) => {
        return userClient.post('/api/user/password/forgot', { email });
    },

    resetPassword: async ({ token, newPassword }) => {
        return userClient.post('/api/user/password/reset', {
            token,
            newPassword,
        });
    },
};
