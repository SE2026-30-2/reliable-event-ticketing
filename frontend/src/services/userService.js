import { userClient } from './axiosClient';

export const userService = {
    getProfile: async () => {
        return userClient.get('/api/user/me');
    },

    // Đăng xuất
    logout: async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        return userClient.post('/api/user/logout', {
            refreshToken: refreshToken || '',
        });
    },

    // Gửi lại email xác thực
    resendVerificationEmail: async () => {
        return userClient.post('/api/user/email/verify/resend', {});
    },
};