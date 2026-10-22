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
};
