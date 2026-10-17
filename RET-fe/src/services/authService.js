import axiosClient from './axiosClient';

export const authService = {
    login: async (credentials) => {
        // credentials chứa { email, password }
        return axiosClient.post('/api/user/login', credentials, { skipAuth: true });
    },

    register: async (userData) => {
        // userData chứa { email, password, fullName }
        return axiosClient.post('/api/user/register', userData, { skipAuth: true });
    },
};
