import axiosClient from './axiosClient';

export const userService = {
    /**
     * Lấy thông tin cá nhân của người dùng hiện tại
     * GET /api/user/me
     */
    getProfile: async () => {
        const response = await axiosClient.get('/api/user/me');
        return response.data;
    },

    /**
     * Đăng xuất tài khoản
     * POST /api/user/logout
     */
    logout: async () => {
        const response = await axiosClient.post('/api/user/logout');
        return response.data;
    },

    /**
     * Gửi lại email xác minh tài khoản
     * POST /api/user/email/verify/resend
     */
    resendVerificationEmail: async () => {
        const response = await axiosClient.post('/api/user/email/verify/resend');
        return response.data;
    },
};