import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { eventService } from '../../services/eventService';
import { paymentService, validatePayment } from '../../services/paymentService';
import { ticketService } from '../../services/ticketService';

const money = cents => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cents / 100);
const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác định';
const countdown = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function Checkout() {
  const { id } = useParams();
  const location = useLocation(), navigate = useNavigate();
  const reservationId = location.state?.reservationId || id;
  const idsKey = JSON.stringify(location.state?.tickets?.map(ticket => ticket.ticketId) || []);
  const [attempt, setAttempt] = useState(0), [resource, setResource] = useState(null);
  const [now, setNow] = useState(Date.now), [paying, setPaying] = useState(false), [payError, setPayError] = useState('');
  const locked = useRef(false), paymentController = useRef(null);
  const key = `${reservationId}:${idsKey}:${attempt}`;
  useEffect(() => {
    const controller = new AbortController(), signal = controller.signal;
    async function load() {
      try {
        const reservation = await ticketService.getReservation(reservationId, { signal, ticketIds: JSON.parse(idsKey) });
        const [event, types, payment] = await Promise.all([
          eventService.getEventById(reservation.eventId, { signal }).catch(() => null),
          eventService.getTicketTypesByEventId(reservation.eventId, { signal }).catch(() => []),
          paymentService.getPaymentByReservation(reservationId, { signal }).then(data => validatePayment(data, reservationId)).catch(() => null),
        ]);
        if (!signal.aborted) setResource({ key, reservation, event, types, payment });
      } catch (failure) {
        if (!signal.aborted) setResource({ key, error: failure.message || 'Không tải được đơn đặt chỗ.' });
      }
    }
    void load(); return () => controller.abort();
  }, [reservationId, idsKey, key]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); paymentController.current?.abort(); };
  }, []);
  const current = resource?.key === key ? resource : null;
  const reservation = current?.reservation, tickets = reservation?.tickets || [], event = current?.event;
  const reserved = tickets.length > 0 && tickets.every(ticket => ticket.status === 'RESERVED');
  const issued = tickets.length > 0 && tickets.every(ticket => ticket.status === 'ISSUED');
  const deadline = Math.min(...tickets.map(ticket => Date.parse(ticket.reservationExpiresAt)));
  const timeLeft = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
  const pendingPayment = current?.payment?.status === 'PENDING';
  const canPay = reserved && (timeLeft > 0 || pendingPayment);
  const discountCents = location.state?.amountCents === reservation?.totalCents && Number.isSafeInteger(location.state?.discountCents) && location.state.discountCents >= 0 ? location.state.discountCents : null;
  async function handlePayment() {
    if (locked.current || !canPay) return;
    locked.current = true; setPaying(true); setPayError('');
    const controller = new AbortController(); paymentController.current = controller;
    try {
      const result = validatePayment(await paymentService.createPaymentRequest(reservationId, null, { signal: controller.signal }), reservationId);
      if (controller.signal.aborted) return;
      const state = { reservationId, payment: result, tickets, eventName: event?.name, venue: event?.venue, expiresAt: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null };
      if (result.status === 'PENDING' && result.paymentUrl && result.txnRef) navigate('/payment-gateway', { state: { ...state, ...result, quantity: tickets.length } });
      else {
        const params = new URLSearchParams({ reservationId });
        if (result.txnRef) params.set('vnp_TxnRef', result.txnRef);
        navigate(`/payment/result?${params}`, { state });
      }
    } catch (failure) {
      if (!controller.signal.aborted) setPayError(`${failure.message || 'Chưa xác nhận được thanh toán.'} Kiểm tra lại giao dịch trước khi đặt vé khác.`);
    } finally { locked.current = false; if (!controller.signal.aborted) setPaying(false); }
  }
  return <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col"><Header />
    <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
      <nav className="text-sm text-slate-500"><Link to="/home">Trang chủ</Link> / Thanh toán đơn đặt chỗ</nav>
      <h1 className="text-3xl font-extrabold">Thanh toán đơn đặt chỗ</h1>
      {!current ? <p role="status">Đang tải đơn đặt chỗ…</p> : current.error ? <section className="bg-white rounded-3xl p-6 space-y-4">
        <h2 className="text-xl font-bold">Không tải được đơn đặt chỗ</h2><p role="alert">{current.error}</p>
        <button onClick={() => setAttempt(value => value + 1)} className="text-indigo-600 underline">Thử lại</button> · <Link to="/my-tickets">Vé của tôi</Link>
      </section> : <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-100 p-6 space-y-3">
            {event?.bannerUrl && <img src={event.bannerUrl} alt="" className="w-full max-h-56 object-cover rounded-2xl" />}
            <h2 className="text-xl font-bold">{event?.name || 'Đơn đặt chỗ của bạn'}</h2>
            {event && <p>{event.venue} · {dateTime(event.startsAt)}</p>}
            <p className="text-sm break-all">Mã đặt chỗ: <strong>{reservationId}</strong></p>
            <ul className="space-y-3">{tickets.map(ticket => <li key={ticket.ticketId} className="border-t border-slate-100 pt-3 text-sm">
              <strong>{current.types.find(type => type.ticketTypeId === ticket.ticketTypeId)?.name || 'Vé tham dự'}</strong>
              <p>{ticket.holderName} · {ticket.holderEmail}</p><p>{money(ticket.priceCents)} · {ticket.status}</p>
            </li>)}</ul>
          </section>
          {reserved && <section className={`rounded-2xl p-5 border ${timeLeft > 0 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
            <h2 className="font-bold">{pendingPayment ? 'Giao dịch đang chờ xác nhận' : 'Thời gian giữ chỗ còn lại'}</h2>
            <p className="text-2xl font-bold font-mono" aria-label="Thời gian giữ chỗ">{countdown(timeLeft)}</p>
            <p className="text-sm">{pendingPayment ? 'Kiểm tra giao dịch hiện tại trước khi đặt lại vé. Giao dịch đang xử lý được máy chủ đối soát riêng.' : timeLeft > 0 ? `Hoàn tất trước ${dateTime(new Date(deadline).toISOString())}.` : 'Thời gian giữ chỗ đã hết hoặc không xác định. Kiểm tra giao dịch trước khi đặt lại.'}</p>
          </section>}
          {!reserved && <p role="status">{issued ? 'Vé đã được phát hành. Bạn có thể xem QR tại Vé của tôi.' : 'Đơn này không còn ở trạng thái chờ thanh toán. Hãy kiểm tra vé và giao dịch hiện tại.'}</p>}
          {payError && <p role="alert" className="bg-rose-50 text-rose-800 rounded-2xl p-4">{payError}</p>}
          <div className="flex flex-wrap gap-4 items-center"><Link to="/my-tickets" className="px-5 py-3 bg-white border rounded-xl">Vé của tôi</Link>
            {reserved && <button onClick={handlePayment} disabled={paying || !canPay} className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-50">
              {paying ? 'Đang xử lý…' : pendingPayment ? 'Tiếp tục giao dịch hiện tại' : reservation.totalCents === 0 ? 'Xác nhận (miễn phí)' : `Thanh toán ngay (${money(reservation.totalCents)})`}
            </button>}
          </div>
        </div>
        <aside className="lg:col-span-5 bg-white rounded-3xl border border-slate-100 p-6 space-y-4"><h2 className="text-lg font-bold">Tóm tắt đơn hàng</h2>
          <p>Số lượng: <strong>{tickets.length} vé</strong></p>
          {discountCents > 0 && <p>Đã giảm: <strong>{money(discountCents)}</strong></p>}
          <p>Tổng thanh toán: <strong className="text-2xl text-indigo-600">{money(reservation.totalCents)}</strong></p>
          <p className="text-sm text-slate-500">Số tiền đã được chốt khi đặt chỗ. Vé chỉ có QR sau khi máy chủ xác nhận phát hành.</p>
        </aside>
      </div>}
    </main><Footer /></div>;
}
