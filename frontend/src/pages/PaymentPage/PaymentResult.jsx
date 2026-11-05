import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import TicketQr from '../../components/tickets/TicketQr';
import { paymentService, validatePayment } from '../../services/paymentService';
import { ticketService } from '../../services/ticketService';
import { eventService } from '../../services/eventService';

const money = cents => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cents / 100);
const titles = { PENDING: 'Giao dịch đang chờ xác nhận', COMPLETED: 'Thanh toán thành công!', FAILED: 'Thanh toán không thành công', REFUND_REQUIRED: 'Giao dịch đang chờ hoàn tiền', REFUNDED: 'Giao dịch đã được hoàn tiền' };

function Result({ txnRef, reservationId }) {
  const location = useLocation();
  const [snapshot, setSnapshot] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [resending, setResending] = useState(null), [notice, setNotice] = useState('');
  useEffect(() => {
    if (!txnRef && !reservationId) return;
    const controller = new AbortController(), signal = controller.signal;
    let timer, polls = 0, eventInfo;
    async function load() {
      try {
        let payment = null, reservation = null, ticketError = '';
        if (txnRef) {
          payment = validatePayment(await paymentService.syncPaymentStatus(txnRef, { signal }), reservationId);
          if (payment.txnRef !== txnRef) throw new Error('Phản hồi không khớp mã giao dịch.');
        } else {
          try { payment = validatePayment(await paymentService.getPaymentByReservation(reservationId, { signal }), reservationId); }
          catch (failure) {
            // The read-only payment lookup is unavailable with the MOCK/FREE provider.
            // In that case only server-issued tickets can confirm fulfillment.
            if (failure.response?.status !== 404) throw failure;
          }
        }
        try {
          reservation = await ticketService.getReservation(payment?.reservationId || reservationId, { signal });
          if (!eventInfo) eventInfo = await eventService.getEventById(reservation.eventId, { signal }).catch(() => null);
        } catch (failure) {
          if (!payment) throw failure;
          ticketError = failure.message || 'Chưa tải được vé.';
        }
        const tickets = reservation?.tickets || [];
        const issued = tickets.length > 0 && tickets.every(ticket => ticket.status === 'ISSUED' && ticket.qrPayload);
        const status = payment?.status || (issued ? 'COMPLETED' : tickets.length && tickets.every(ticket => ticket.status === 'CANCELLED') ? 'FAILED' : tickets.length && tickets.every(ticket => ticket.status === 'REFUNDED') ? 'REFUNDED' : 'PENDING');
        if (signal.aborted) return;
        setSnapshot({ payment, reservation, status, tickets, issued, event: eventInfo, ticketError }); setError('');
        if (++polls < 10 && (status === 'PENDING' || (status === 'COMPLETED' && !issued))) timer = setTimeout(load, 1500);
      } catch (failure) {
        if (!signal.aborted) setError(failure.message || 'Chưa xác nhận được kết quả giao dịch.');
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [txnRef, reservationId, attempt]);

  async function resend(ticketId) {
    if (resending) return;
    setResending(ticketId); setNotice('');
    try { await ticketService.resendTicketEmail(ticketId); setNotice('Đã yêu cầu gửi lại email vé.'); }
    catch (failure) { setNotice(failure.message || 'Chưa gửi lại được email vé.'); }
    finally { setResending(null); }
  }
  const empty = !txnRef && !reservationId;
  const payment = snapshot?.payment, reservation = snapshot?.reservation;
  const status = snapshot?.status;
  const amount = payment?.amountCents ?? reservation?.totalCents;
  const title = empty ? 'Chưa có giao dịch để tra cứu' : !snapshot ? error ? 'Chưa xác nhận được giao dịch' : 'Đang kiểm tra giao dịch…' : !payment && status === 'COMPLETED' ? 'Vé đã được phát hành' : titles[status];
  return <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col"><Header />
    <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
      <nav className="text-sm text-slate-500"><Link to="/home">Trang chủ</Link> / Kết quả thanh toán</nav>
      <section className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold">{title}</h1>
        {!empty && !snapshot && !error && <p role="status">Đang đối soát với máy chủ…</p>}
        {error && <p role="alert" className="text-rose-700">{error} Chưa thể xác nhận trạng thái mới nhất.</p>}
        {snapshot && <>
          <p role="status">{status === 'COMPLETED' ? snapshot.issued ? 'Vé đã được máy chủ phát hành. Mỗi QR tương ứng một vé.' : 'Máy chủ đã xác nhận thanh toán. Vé đang được phát hành; hãy tải lại trạng thái nếu cần.' : status === 'PENDING' ? 'Chưa có xác nhận thanh toán thành công. Vui lòng kiểm tra lại trước khi tạo đơn khác.' : payment?.failureReason || 'Kiểm tra trạng thái vé và giao dịch trước khi đặt lại.'}</p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm break-words">
            <div><dt>Mã đặt chỗ</dt><dd>{payment?.reservationId || reservationId}</dd></div>
            {payment?.paymentRequestId && <div><dt>Mã thanh toán</dt><dd>{payment.paymentRequestId}</dd></div>}
            <div><dt>Trạng thái</dt><dd>{status}</dd></div>
            {amount != null && <div><dt>Số tiền</dt><dd className="text-2xl font-bold text-indigo-600">{money(amount)}</dd></div>}
            {payment?.provider && <div><dt>Phương thức thanh toán</dt><dd>{payment.provider}</dd></div>}
            {payment?.completedAt && <div><dt>Thời gian thanh toán</dt><dd>{new Date(payment.completedAt).toLocaleString('vi-VN')}</dd></div>}
          </dl>
          {snapshot.ticketError && <p role="alert">{snapshot.ticketError}</p>}
        </>}
        <div className="flex flex-wrap gap-4 items-center">
          {!empty && <button onClick={() => setAttempt(value => value + 1)} className="px-5 py-3 bg-indigo-600 text-white rounded-xl">Kiểm tra lại trạng thái</button>}
          <Link to="/my-tickets" className="text-indigo-700 underline">Vé của tôi</Link>
          <Link to="/login" state={{ from: location.pathname + location.search }} className="text-indigo-700 underline">Đăng nhập lại</Link>
        </div>
      </section>
      {notice && <p role="status">{notice}</p>}
      {status === 'COMPLETED' && snapshot.tickets.length > 0 && <section className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-label="Vé điện tử">
        {snapshot.tickets.map(ticket => <article key={ticket.ticketId} className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4">
          <h2 className="text-lg font-bold">{snapshot.event?.name || 'Vé của bạn'}</h2>
          <p>{ticket.holderName} · {ticket.status}</p><p className="text-xs break-all">Mã vé: {ticket.ticketId}</p>
          <TicketQr ticket={ticket} size={256} />
          {ticket.status === 'ISSUED' && <button disabled={Boolean(resending)} onClick={() => resend(ticket.ticketId)} className="text-indigo-700 underline">{resending === ticket.ticketId ? 'Đang gửi…' : 'Gửi lại email vé'}</button>}
        </article>)}
      </section>}
    </main><Footer /></div>;
}

export default function PaymentResult() {
  const [params] = useSearchParams(), location = useLocation();
  const txnRef = params.get('vnp_TxnRef') || '';
  const reservationId = params.get('reservationId') || location.state?.reservationId || location.state?.payment?.reservationId || '';
  return <Result key={`${txnRef}:${reservationId}`} txnRef={txnRef} reservationId={reservationId} />;
}
