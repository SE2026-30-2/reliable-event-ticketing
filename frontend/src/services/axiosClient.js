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
            const isAuthRequest = config.skipAuth || config.url?.includes('/api/user/login') || config.url?.includes('/api/user/register') || config.url?.includes('/api/user/password/forgot') || config.url?.includes('/api/user/password/reset') || (config.url?.includes('/api/user/email/verify') && !config.url?.includes('/api/user/email/verify/resend'));

            const token = config.accessToken ?? localStorage.getItem('access_token');
            if (isAuthRequest) config.headers.delete('Authorization');
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
            const isAuthRequest = error.config?.skipAuth || error.config?.url?.includes('/api/user/login') || error.config?.url?.includes('/api/user/register') || error.config?.url?.includes('/api/user/password/forgot') || error.config?.url?.includes('/api/user/password/reset') || (error.config?.url?.includes('/api/user/email/verify') && !error.config?.url?.includes('/api/user/email/verify/resend'));

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

            const failure = new Error(message, { cause: error });
            Object.assign(failure, { response: error.response, config: error.config, code: error.code, isAxiosError: error.isAxiosError });
            return Promise.reject(failure);
        }
    );
};

setupInterceptors(userClient);
setupInterceptors(axiosClient);

export default axiosClient;
