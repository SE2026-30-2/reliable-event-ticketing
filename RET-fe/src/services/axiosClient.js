import axios from 'axios';

const axiosClient = axios.create({
    baseURL: 'https://api.yourbackend.com/v1', // Đường dẫn API backend của bạn
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default axiosClient;