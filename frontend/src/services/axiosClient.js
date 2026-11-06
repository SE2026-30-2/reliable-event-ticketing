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

const isAuthEndpoint = (url = '') =>
    url.includes('/api/user/login') ||
    url.includes('/api/user/register') ||
    url.includes('/api/user/refresh') ||
    url.includes('/api/user/password/forgot') ||
    url.includes('/api/user/password/reset') ||
    (url.includes('/api/user/email/verify') && !url.includes('/api/user/email/verify/resend'));

const isAuthRequest = (config = {}) =>
    Boolean(config.skipAuth || config._isRefresh || isAuthEndpoint(config.url));

const clearAuthAndNotify = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:unauthorized'));
};

const formatError = (error) => {
    if (error instanceof Error && error.response !== undefined) {
        return error;
    }
    const message =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.response?.data?.error ||
        (Array.isArray(error.response?.data?.details) && error.response.data.details.join('; ')) ||
        error.message ||
        'Đã có lỗi xảy ra. Vui lòng thử lại sau.';

    const failure = new Error(message, { cause: error });
    Object.assign(failure, {
        response: error.response,
        config: error.config,
        code: error.code,
        isAxiosError: error.isAxiosError,
    });
    return failure;
};

let refreshPromise = null;

const refreshTokens = async () => {
    if (refreshPromise) {
        return refreshPromise;
    }

    const currentRefreshToken = localStorage.getItem('refresh_token');
    if (!currentRefreshToken) {
        clearAuthAndNotify();
        throw new Error('Không tìm thấy refresh token.');
    }

    refreshPromise = (async () => {
        try {
            const data = await userClient.post(
                '/api/user/refresh',
                { refreshToken: currentRefreshToken },
                { skipAuth: true, _isRefresh: true }
            );

            if (!data?.accessToken) {
                throw new Error('Máy chủ chưa trả về access token mới.');
            }

            localStorage.setItem('access_token', data.accessToken);
            if (data.refreshToken) {
                localStorage.setItem('refresh_token', data.refreshToken);
            }

            return data.accessToken;
        } catch (err) {
            clearAuthAndNotify();
            throw err;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

// Hàm gán Interceptor chung
const setupInterceptors = (instance) => {
    instance.interceptors.request.use(
        (config) => {
            const isAuth = isAuthRequest(config);
            const token = config.accessToken ?? localStorage.getItem('access_token');

            if (isAuth && config.headers) {
                if (typeof config.headers.delete === 'function') {
                    config.headers.delete('Authorization');
                } else {
                    delete config.headers.Authorization;
                    delete config.headers.authorization;
                }
            }

            if (token && !isAuth) {
                if (config.headers) {
                    if (typeof config.headers.set === 'function') {
                        config.headers.set('Authorization', `Bearer ${token}`);
                    } else {
                        config.headers.Authorization = `Bearer ${token}`;
                    }
                }
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    instance.interceptors.response.use(
        (response) => response.data,
        async (error) => {
            const isAuth = isAuthRequest(error?.config);

            // Xử lý khi access token hết hạn (401) đối với các request cần xác thực
            if (error?.response?.status === 401 && !isAuth) {
                const originalConfig = error.config;
                if (originalConfig && !originalConfig._retry) {
                    originalConfig._retry = true;
                    const refreshToken = localStorage.getItem('refresh_token');
                    if (refreshToken) {
                        try {
                            const newAccessToken = await refreshTokens();
                            if (originalConfig.headers) {
                                if (typeof originalConfig.headers.set === 'function') {
                                    originalConfig.headers.set('Authorization', `Bearer ${newAccessToken}`);
                                } else {
                                    originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
                                }
                            }
                            if (originalConfig.accessToken) {
                                originalConfig.accessToken = newAccessToken;
                            }
                            return instance(originalConfig);
                        } catch (refreshError) {
                            return Promise.reject(formatError(refreshError));
                        }
                    }
                }

                clearAuthAndNotify();
            }

            return Promise.reject(formatError(error));
        }
    );
};

setupInterceptors(userClient);
setupInterceptors(axiosClient);

export default axiosClient;
