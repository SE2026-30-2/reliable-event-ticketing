import AdminLayout from '../../components/layout/AdminLayout';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { adminPaymentService, paymentError } from '../../services/adminPaymentService';
import { Dialog, Icon } from '../EventManagementPage/managementUi';
import { canRefund, createPreviewService, dateTime, isUuid, money, previewPayment, providerLabels, statusLabels } from './paymentUtils';
import '../EventManagementPage/event-management.css';
import '../AdminUsersPage/admin-users.css';
import '../AdminDevicesPage/admin-devices.css';
import './admin-payments.css';

function CopyId({ label, value }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setMessage(`Đã sao chép ${label.toLowerCase()}.`); }
    catch { setMessage('Không thể sao chép tự động. Bạn có thể chọn và sao chép mã.'); }
  }
  return <div className="ap-id"><span>{label}</span><div><strong>{value}</strong><button type="button" aria-label={`Sao chép ${label.toLowerCase()}`} onClick={copy}>⧉</button></div>{message && <small role="status">{message}</small>}</div>;
}

function RefundDialog({ payment, api, close, complete, uncertain }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (lock.current || !canRefund(payment)) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await api.refund(payment.paymentRequestId);
      if (result.paymentRequestId !== payment.paymentRequestId || result.reservationId !== payment.reservationId || result.status !== 'REFUNDED') {
        throw new Error('unconfirmed');
      }
      complete(result);
    } catch (failure) {
      setError(paymentError(failure));
      uncertain();
    } finally { setBusy(false); }
  }
  return <Dialog title="Xác nhận hoàn tiền" close={close} busy={busy}>
    <form className="ap-refund-form" onSubmit={submit} aria-busy={busy}>
      <p className="ap-warning">Bạn có chắc chắn muốn hoàn tiền cho giao dịch này? Hành động này không thể hoàn tác.</p>
      <dl className="ap-refund-summary"><dt>Mã thanh toán</dt><dd>{payment.paymentRequestId}</dd><dt>Mã đặt chỗ</dt><dd>{payment.reservationId}</dd><dt>Cổng thanh toán</dt><dd>{providerLabels[payment.provider]}</dd><dt>Số tiền hoàn toàn bộ</dt><dd className="ap-amount">{money(payment.amountCents)}</dd></dl>
      <p className="ad-muted">Hoàn toàn bộ qua VNPay. Trạng thái các vé liên quan sẽ được cập nhật sau khi xử lý hoàn tiền.</p>
      {error && <p role="alert" className="au-message error">{error}</p>}
      <div className="em-form-actions"><button type="button" disabled={busy} onClick={close}>{error ? 'Đóng và tra cứu lại' : 'Hủy'}</button><button type="submit" className="danger" disabled={busy || !!error}>{busy ? 'Đang hoàn tiền…' : 'Xác nhận hoàn tiền'}</button></div>
    </form>
  </Dialog>;
}

function Workspace({ preview }) {
  const api = useMemo(() => preview ? createPreviewService() : adminPaymentService, [preview]);
  const [query, setQuery] = useState(preview ? previewPayment.reservationId : '');
  const [payment, setPayment] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [notice, setNotice] = useState(''), [modal, setModal] = useState(null), [needsLookup, setNeedsLookup] = useState(false);
  const controller = useRef(null), lookupLock = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function lookup(event) {
    event.preventDefault();
    if (lookupLock.current) return;
    const id = query.trim();
    setPayment(null); setNotice(''); setError(''); setModal(null);
    if (!isUuid(id)) { setError('Vui lòng nhập mã đặt chỗ đúng định dạng UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).'); return; }
    lookupLock.current = true; setLoading(true);
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      const result = await api.lookup(id, signal);
      if (!signal.aborted) { setPayment(result); setNeedsLookup(false); }
    } catch (failure) { if (!signal.aborted) setError(paymentError(failure)); }
    finally { lookupLock.current = false; if (!signal.aborted) setLoading(false); }
  }
  return <AdminLayout className="admin-payments" preview={preview}>
      <div>
        {preview && <p className="em-preview">Bản xem thử · Dữ liệu minh họa, thao tác chỉ lưu trong phiên này và không gọi VNPay.</p>}
        <nav className="au-breadcrumb" aria-label="Đường dẫn"><span>Quản trị hệ thống</span><span>›</span><span>Quản trị giao dịch</span></nav>
        <section className="ad-heading"><div><h1>Quản trị giao dịch &amp; Hoàn tiền</h1><p>Tra cứu thông tin giao dịch, kiểm tra trạng thái thanh toán và thực hiện hoàn tiền khi cần thiết.</p></div></section>
        <section className="ap-panel" aria-labelledby="ap-search-title"><h2 id="ap-search-title"><Icon name="eye" />Tra cứu giao dịch</h2>
          <form onSubmit={lookup} aria-busy={loading}>
            <fieldset className="ap-search-type" disabled={loading}><legend className="ap-sr-only">Loại mã tra cứu</legend><label><input type="radio" name="lookupType" value="reservation" defaultChecked />Tìm theo mã đặt chỗ (Reservation ID)</label><label title="Chưa có API tra cứu theo mã thanh toán"><input type="radio" name="lookupType" value="payment" disabled />Tìm theo mã thanh toán (Payment ID)</label></fieldset>
            <label className="ap-sr-only" htmlFor="ap-query">Mã đặt chỗ</label><div className="ap-search-row"><div className="ap-input"><input id="ap-query" value={query} onChange={(e) => setQuery(e.target.value)} disabled={loading} placeholder="Nhập mã đặt chỗ (UUID)" autoComplete="off" spellCheck={false} aria-describedby="ap-search-help" /><button type="button" aria-label="Xóa mã tra cứu" disabled={loading || !query} onClick={() => { setQuery(''); setPayment(null); setError(''); setNotice(''); }}>×</button></div><button className="primary" disabled={loading} type="submit">{loading ? <><span className="em-spinner" />Đang tra cứu…</> : '⌕ Tra cứu'}</button></div>
            <p className="ap-help" id="ap-search-help">Nhập chính xác mã đặt chỗ để xem thông tin giao dịch và trạng thái thanh toán.</p>
            <details className="ap-api-note"><summary>Phạm vi tra cứu hiện có</summary><p>Hiện chỉ tra cứu bằng mã đặt chỗ của các đơn do tài khoản hiện tại đặt. Tra cứu theo mã thanh toán và tra cứu đơn của tài khoản khác chưa khả dụng.</p></details>
          </form>
        </section>
        {loading && <p role="status" className="au-message">Đang tải thông tin giao dịch…</p>}
        {error && <div role="alert" className="au-message error">{error}</div>}
        {notice && <p role="status" className="au-message">{notice}</p>}
        {!loading && !error && !payment && <div className="ap-empty"><Icon name="money" /><p>Nhập mã đặt chỗ để bắt đầu tra cứu giao dịch.</p></div>}
        {payment && <>
          <section className="ap-panel" aria-labelledby="ap-detail-title"><div className="ap-panel-title"><h2 id="ap-detail-title"><Icon name="ticket" />Thông tin giao dịch</h2><span className={`em-badge ap-status ${payment.status.toLowerCase()}`}>{statusLabels[payment.status] || payment.status}</span></div>
            <div className="ap-payment-grid"><div className="ap-payment-meta">
              <CopyId key={`p-${payment.paymentRequestId}`} label="Mã thanh toán" value={payment.paymentRequestId} /><CopyId key={`r-${payment.reservationId}`} label="Mã đặt chỗ" value={payment.reservationId} />
              <dl className="ap-data"><dt>Thời gian tạo giao dịch</dt><dd>{dateTime(payment.createdAt)}</dd><dt>Thời gian thanh toán</dt><dd>{dateTime(payment.completedAt)}</dd><dt>Phương thức thanh toán</dt><dd className="ap-provider"><span>{payment.provider === 'VNPAY' ? 'VN' : '₫'}</span>{providerLabels[payment.provider] || payment.provider || 'Chưa ghi nhận'}</dd><dt>Trạng thái</dt><dd><span className={`em-badge ap-status ${payment.status.toLowerCase()}`}>{statusLabels[payment.status] || payment.status}</span></dd></dl>
            </div><div className="ap-payment-total"><div className="ap-payment-art"><Icon name="money" /><div><strong>{providerLabels[payment.provider] || payment.provider}</strong><p>Chi tiết thanh toán</p></div></div><dl className="ap-data"><dt>Mã tham chiếu cổng thanh toán</dt><dd>{payment.txnRef || 'Chưa ghi nhận'}</dd><dt>Tổng thanh toán</dt><dd className="ap-amount">{money(payment.amountCents)}</dd></dl><p className="ap-help">Số tiền ghi nhận từ hệ thống thanh toán.</p>{payment.failureReason && <p className="au-message error">{payment.failureReason}</p>}</div></div>
          </section>
          <section className="ap-panel" aria-labelledby="ap-actions-title"><h2 id="ap-actions-title"><Icon name="coupon" />Hành động</h2><div className="ap-actions"><article><h3><Icon name="ticket" />Xem chi tiết đặt chỗ</h3><p>Xem thông tin đặt chỗ liên quan đến giao dịch này.</p><button onClick={() => setModal('reservation')}>Xem chi tiết</button></article><article className="ap-refund-action"><h3><Icon name="money" />Hoàn tiền giao dịch</h3><p>{needsLookup ? 'Cần tra cứu lại để xác nhận trạng thái trước khi hoàn tiền tiếp.' : payment.status === 'REFUNDED' ? 'Giao dịch đã được hoàn tiền. Không thể hoàn tiền lần nữa.' : canRefund(payment) ? 'Hoàn toàn bộ số tiền qua VNPay. Vui lòng kiểm tra kỹ thông tin trước khi thực hiện.' : 'Chỉ giao dịch VNPay thanh toán thành công và có số tiền lớn hơn 0 mới được hoàn tiền.'}</p><button disabled={!canRefund(payment) || needsLookup} onClick={() => setModal('refund')}>↶ Hoàn tiền</button></article></div></section>
        </>}
      </div>
    {modal === 'refund' && <RefundDialog payment={payment} api={api} close={() => setModal(null)} uncertain={() => setNeedsLookup(true)} complete={(result) => { setPayment(result); setModal(null); setNotice('Hoàn tiền thành công. Trạng thái các vé liên quan sẽ được cập nhật sau ít giây.'); }} />}
    {modal === 'reservation' && <Dialog title="Thông tin đặt chỗ" close={() => setModal(null)}><dl className="au-detail"><dt>Mã đặt chỗ</dt><dd>{payment.reservationId}</dd><dt>Mã thanh toán</dt><dd>{payment.paymentRequestId}</dd><dt>Tổng thanh toán</dt><dd>{money(payment.amountCents)}</dd></dl><p className="ad-muted">Thông tin người mua, sự kiện và danh sách vé chưa khả dụng trong mục tra cứu này.</p><div className="em-form-actions"><button onClick={() => setModal(null)}>Đóng</button></div></Dialog>}
  </AdminLayout>;
}

export default function AdminPayments({ preview = false }) {
  const { user } = useAuth();
  if (!preview && !user?.roles?.includes('ADMIN')) return <div className="event-management"><div className="au-empty"><h1>Không có quyền truy cập</h1><p>Chỉ Quản trị viên (ADMIN) được quản trị thanh toán và hoàn tiền.</p><Link to="/home">Về trang chủ</Link></div></div>;
  return <Workspace preview={preview} />;
}
