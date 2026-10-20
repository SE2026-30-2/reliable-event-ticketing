import axios from 'axios';

export const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:8087';
export const TICKETING_SERVICE_URL = import.meta.env.VITE_TICKETING_SERVICE_URL || 'http://localhost:8091';

// Client cho User Service (Port 8087)
export const userClient = axios.create({
    baseURL: USER_SERVICE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Client cho Ticketing Service (Port 8091)
const axiosClient = axios.create({
    baseURL: TICKETING_SERVICE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Hàm gán Interceptor chung
const setupInterceptors = (instance) => {
    instance.interceptors.request.use(
        (config) => {
            // Các API Auth công khai không cần gửi Token
            const isAuthRequest = config.url?.includes('/api/user/login') || config.url?.includes('/api/user/register');

            const token = localStorage.getItem('access_token');
            if (token && !isAuthRequest) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    instance.interceptors.response.use(
        (response) => response.data,
        (error) => {
            const isAuthRequest = error.config?.url?.includes('/api/user/login') || error.config?.url?.includes('/api/user/register');

            // Bỏ qua xóa token/bắn event nếu lỗi 401 đến từ trang Login hoặc Register
            if (error.response?.status === 401 && !isAuthRequest) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user');
                window.dispatchEvent(new Event('auth:unauthorized'));
            }

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
};

setupInterceptors(userClient);
setupInterceptors(axiosClient);

export default axiosClient;