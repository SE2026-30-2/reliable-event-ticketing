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
}
