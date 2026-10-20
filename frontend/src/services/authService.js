import { userClient } from './axiosClient';

export const authService = {
    login: async (credentials) => {
        return userClient.post('/api/user/login', credentials);
    },
    register: async (userData) => {
        return userClient.post('/api/user/register', userData);
    },
};