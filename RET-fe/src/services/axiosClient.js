import axios from 'axios';

const baseURL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:8087';

let currentToken = localStorage.getItem('access_token') || null;

const axiosClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const setAuthToken = (token) => {
    currentToken = token;
    if (token) {
        axiosClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete axiosClient.defaults.headers.common['Authorization'];
    }
};

// Nếu đã có token từ trước, gắn sẵn vào default header
if (currentToken) {
    setAuthToken(currentToken);
}

// Interceptor request
axiosClient.interceptors.request.use(
    (config) => {
        // Public authentication requests must not carry an expired session token,
        // including Authorization inherited from the client defaults.
        if (config.skipAuth) {
            config.headers.delete('Authorization');
            return config;
        }
        const token = currentToken || localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor response: trả về thẳng data và bóc tách error message rõ ràng
axiosClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const message =
            error.response?.data?.message ||
            error.response?.data?.detail ||
            error.response?.data?.error ||
            (Array.isArray(error.response?.data?.details) && error.response.data.details.join('; ')) ||
            error.message ||
            'Đã có lỗi xảy ra. Vui lòng thử lại sau.';
        return Promise.reject(new Error(message));
    }
);

export default axiosClient;
