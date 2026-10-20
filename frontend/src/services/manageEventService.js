import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_TICKETING_SERVICE_URL || 'http://localhost:8091',
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function managementError(error) {
  const status = error.response?.status
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (status === 403) return 'Bạn cần quyền Ban tổ chức hoặc Quản trị viên để quản lý sự kiện.'
  if (status === 404) return 'Sự kiện không tồn tại hoặc không thuộc quyền quản lý của bạn.'
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
  return error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.'
}

export const manageEventService = {
  list: (signal) => client.get('/api/manage/events', { signal }).then(({ data }) => data),
  create: (body) => client.post('/api/event', body).then(({ data }) => data),
  update: (id, body) => client.patch(`/api/event/${encodeURIComponent(id)}`, body).then(({ data }) => data),
  ticketTypes: (id, signal) => client.get(`/api/event/${encodeURIComponent(id)}/ticket-types`, { signal }).then(({ data }) => data),
  detail: (id, signal) => client.get(`/api/event/${encodeURIComponent(id)}`, { signal }).then(({ data }) => data),
  report: (id, signal) => client.get(`/api/manage/events/${encodeURIComponent(id)}/report`, { signal }).then(({ data }) => data),
  createTicketType: (id, body) => client.post(`/api/event/${encodeURIComponent(id)}/ticket-types`, body).then(({ data }) => data),
  coupons: (id, signal) => client.get(`/api/manage/events/${encodeURIComponent(id)}/coupons`, { signal }).then(({ data }) => data),
  createCoupon: (id, body) => client.post(`/api/manage/events/${encodeURIComponent(id)}/coupons`, body).then(({ data }) => data),
  setCouponActive: (id, couponId, active) => client.patch(`/api/manage/events/${encodeURIComponent(id)}/coupons/${encodeURIComponent(couponId)}`, { active }).then(({ data }) => data),
  inviteGuests: (id, body) => client.post(`/api/manage/events/${encodeURIComponent(id)}/guests`, body).then(({ data }) => data),
  tickets: (id, page, signal) => client.get(`/api/event/${encodeURIComponent(id)}/tickets`, { params: { page, size: 20 }, signal }).then(({ data }) => data),
  updateTicketStatus: (id, body) => client.patch(`/api/ticket/${encodeURIComponent(id)}/status`, body).then(({ data }) => data),
  devices: (id, signal) => client.get('/api/checkin/devices', { params: { eventId: id }, signal }).then(({ data }) => data),
  createDevice: (id, label) => client.post('/api/checkin/devices', { eventId: id, label }).then(({ data }) => data),
  revokeDevice: (id) => client.patch(`/api/checkin/devices/${encodeURIComponent(id)}/revoke`).then(({ data }) => data),
  checkinStats: (id, signal) => client.get(`/api/checkin/events/${encodeURIComponent(id)}/stats`, { signal }).then(({ data }) => data),
  timeline: (id, bucketMinutes, signal) => client.get(`/api/checkin/events/${encodeURIComponent(id)}/timeline`, { params: { bucketMinutes }, signal }).then(({ data }) => data),
  exportCsv: (id, kind) => {
    if (!['attendees', 'payments'].includes(kind)) throw new Error('Loại báo cáo không hợp lệ.');
    return client.get(`/api/manage/events/${encodeURIComponent(id)}/${kind}.csv`, { responseType: 'blob' }).then(({ data }) => data);
  },
}
