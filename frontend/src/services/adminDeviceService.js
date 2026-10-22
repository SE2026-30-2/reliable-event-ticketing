import axios from 'axios';
import { TICKETING_SERVICE_URL } from './axiosClient';

const client = axios.create({ baseURL: TICKETING_SERVICE_URL, timeout: 15000 });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function deviceError(error) {
  const status = error.response?.status;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn cần quyền Quản trị viên để quản lý thiết bị toàn hệ thống.';
  if (status === 404) return 'Thiết bị hoặc sự kiện không tồn tại, hoặc bạn không có quyền quản lý.';
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
  return error.response?.data?.message || error.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}

export const adminDeviceService = {
  list: (signal) => client.get('/api/checkin/devices', { signal }).then(({ data }) => data),
  events: (signal) => client.get('/api/manage/events', { signal }).then(({ data }) => data),
  create: (body) => client.post('/api/checkin/devices', body).then(({ data }) => data),
  revoke: (id) => client.patch(`/api/checkin/devices/${encodeURIComponent(id)}/revoke`).then(({ data }) => data),
};
