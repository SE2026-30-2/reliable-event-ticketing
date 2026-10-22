import axios from 'axios';
import { USER_SERVICE_URL } from './axiosClient';

const client = axios.create({ baseURL: USER_SERVICE_URL, timeout: 15000 });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function adminUserError(error) {
  const status = error.response?.status;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn cần quyền Quản trị viên để quản lý người dùng.';
  if (status === 404) return 'Người dùng không còn tồn tại. Vui lòng tải lại danh sách.';
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
  return error.response?.data?.message || error.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}

export const adminUserService = {
  // The existing API supports pagination only. Load every page before calculating
  // global filters and totals; never present a single API page as the whole dataset.
  async list(signal) {
    const users = new Map();
    let page = 0, totalPages;
    do {
      const { data } = await client.get('/api/user/admin/users', {
        params: { page, size: 200, sort: 'createdAt,desc' }, signal,
      });
      for (const user of data.content) users.set(user.id, user);
      totalPages = data.totalPages;
      page += 1;
    } while (page < totalPages);
    return [...users.values()];
  },
  detail: (id, signal) => client.get(`/api/user/admin/users/${encodeURIComponent(id)}`, { signal }).then(({ data }) => data),
  status: (id, status) => client.patch(`/api/user/admin/users/${encodeURIComponent(id)}/status`, { status }).then(({ data }) => data),
  roles: (id, roles) => client.patch(`/api/user/admin/users/${encodeURIComponent(id)}/roles`, { roles }).then(({ data }) => data),
};
