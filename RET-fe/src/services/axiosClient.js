import axios from "axios";

export const USER_SERVICE_URL =
  import.meta.env.VITE_USER_SERVICE_URL || "http://localhost:8087";
export const TICKETING_SERVICE_URL =
  import.meta.env.VITE_TICKETING_SERVICE_URL || "http://localhost:8091";

const axiosClient = axios.create({
  baseURL: TICKETING_SERVICE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Chỉ gắn token cho request cần xác thực; login/register không gửi token cũ.
axiosClient.interceptors.request.use(
  (config) => {
    if (config.skipAuth) {
      config.headers.delete("Authorization");
      return config;
    }
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor response
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuth) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth:unauthorized"));
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.response?.data?.error ||
      (Array.isArray(error.response?.data?.details) &&
        error.response.data.details.join("; ")) ||
      error.message ||
      "Đã có lỗi xảy ra. Vui lòng thử lại sau.";

    return Promise.reject(new Error(message));
  },
);

export default axiosClient;
