import { userClient } from "./axiosClient";

export const authService = {
  login: async (credentials) => {
    return userClient.post("/api/user/login", credentials, {
      skipAuth: true,
    });
  },
  loginWithProfile: async (credentials) => {
    const tokens = await authService.login(credentials);
    if (!tokens?.accessToken) {
      throw new Error("Máy chủ chưa trả về access token hợp lệ.");
    }
    // Fetch the authoritative profile with the new token before saving the session.
    const user = await userClient.get("/api/user/me", {
      accessToken: tokens.accessToken,
      timeout: 15000,
    });
    if (!user?.email || !Array.isArray(user.roles)) {
      throw new Error("Không tải được thông tin và quyền tài khoản. Vui lòng đăng nhập lại.");
    }
    return { ...tokens, user };
  },
  register: async (userData) => {
    return userClient.post("/api/user/register", userData, {
      skipAuth: true,
    });
  },
  refreshToken: async (token) => {
    const refreshToken = token || localStorage.getItem("refresh_token");
    if (!refreshToken) {
      throw new Error("Không tìm thấy refresh token.");
    }
    const data = await userClient.post(
      "/api/user/refresh",
      { refreshToken },
      { skipAuth: true, _isRefresh: true }
    );
    if (data?.accessToken) {
      localStorage.setItem("access_token", data.accessToken);
    }
    if (data?.refreshToken) {
      localStorage.setItem("refresh_token", data.refreshToken);
    }
    return data;
  },
  refreshWithProfile: async (token) => {
    const tokens = await authService.refreshToken(token);
    const user = await userClient.get("/api/user/me", {
      accessToken: tokens.accessToken,
      timeout: 15000,
    });
    if (user?.email && Array.isArray(user?.roles)) {
      localStorage.setItem("user", JSON.stringify(user));
    }
    return { ...tokens, user };
  },
};
