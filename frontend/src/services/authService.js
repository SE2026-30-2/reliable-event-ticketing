import axiosClient, { USER_SERVICE_URL } from "./axiosClient";

export const authService = {
  login: async (credentials) => {
    return axiosClient.post("/api/user/login", credentials, {
      baseURL: USER_SERVICE_URL,
      skipAuth: true,
    });
  },
  loginWithProfile: async (credentials) => {
    const tokens = await authService.login(credentials);
    if (!tokens?.accessToken) {
      throw new Error("Máy chủ chưa trả về access token hợp lệ.");
    }
    // Fetch the authoritative profile with the new token before saving the session.
    const user = await axiosClient.get("/api/user/me", {
      baseURL: USER_SERVICE_URL,
      accessToken: tokens.accessToken,
      timeout: 15000,
    });
    if (!user?.email || !Array.isArray(user.roles)) {
      throw new Error("Không tải được thông tin và quyền tài khoản. Vui lòng đăng nhập lại.");
    }
    return { ...tokens, user };
  },
  register: async (userData) => {
    return axiosClient.post("/api/user/register", userData, {
      baseURL: USER_SERVICE_URL,
      skipAuth: true,
    });
  },
};
