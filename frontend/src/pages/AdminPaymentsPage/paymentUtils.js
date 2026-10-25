export const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const canRefund = (payment) => payment?.provider === 'VNPAY' && payment?.status === 'COMPLETED' && payment.amountCents > 0;
export const money = (cents) => Number.isFinite(cents) ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 }).format(cents / 100) : 'Chưa có dữ liệu';
export const dateTime = (value) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận';
export const statusLabels = { PENDING: 'Đang chờ thanh toán', COMPLETED: 'Thanh toán thành công', FAILED: 'Thanh toán thất bại', REFUND_REQUIRED: 'Chờ hoàn tiền tự động', REFUNDED: 'Đã hoàn tiền' };
export const providerLabels = { VNPAY: 'VNPay', MOCK: 'Mock (mô phỏng)', FREE: 'Miễn phí' };

export const previewPayment = {
  paymentRequestId: '20251025-0000-4000-8000-000000000789',
  reservationId: '20251025-0000-4000-8000-000000000123',
  amountCents: 220000000, status: 'COMPLETED', provider: 'VNPAY',
  createdAt: '2025-10-25T08:40:00Z', completedAt: '2025-10-25T08:42:00Z',
  txnRef: 'EH202510251542', failureReason: null,
};

export function createPreviewService() {
  let payment = { ...previewPayment };
  return {
    lookup: async (id) => {
      if (id.toLowerCase() !== payment.reservationId) throw { response: { status: 404 } };
      return { ...payment };
    },
    refund: async () => { payment = { ...payment, status: 'REFUNDED' }; return { ...payment }; },
  };
}
