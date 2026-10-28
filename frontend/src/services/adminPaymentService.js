import axios from 'axios';
import { TICKETING_SERVICE_URL } from './axiosClient';

const client = axios.create({ baseURL: TICKETING_SERVICE_URL, timeout: 20000 });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function paymentError(error) {
  const status = error.response?.status;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy giao dịch, bạn không có quyền xem đơn này hoặc thanh toán trực tuyến chưa được bật.';
  if (status === 409) return 'Giao dịch không còn đủ điều kiện hoàn tiền hoặc VNPay đã từ chối yêu cầu. Hãy tra cứu lại trạng thái.';
  if (status === 429) return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.';
  if (!error.response) return 'Không nhận được phản hồi từ máy chủ. Hãy tra cứu lại trạng thái trước khi thử hoàn tiền lần nữa.';
  return error.response.data?.message || error.response.data?.detail || 'Không thể xử lý giao dịch. Vui lòng thử lại sau.';
}

export const adminPaymentService = {
  lookup: (reservationId, signal) => client.get(`/api/payment/requests/by-reservation/${encodeURIComponent(reservationId)}`, { signal }).then(({ data }) => data),
  // The backend accepts a full refund only; amount/reason are not request fields.
  refund: (paymentId) => client.post(`/api/payment/requests/${encodeURIComponent(paymentId)}/refund`).then(({ data }) => data),
};
