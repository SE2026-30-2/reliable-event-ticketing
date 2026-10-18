import axiosClient, { USER_SERVICE_URL } from "./axiosClient";

export const authService = {
  login: async (credentials) => {
    return axiosClient.post("/api/user/login", credentials, {
      baseURL: USER_SERVICE_URL,
      skipAuth: true,
    });
  },
  register: async (userData) => {
    return axiosClient.post("/api/user/register", userData, {
      baseURL: USER_SERVICE_URL,
      skipAuth: true,
    });
  },
};
