import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { eventService } from '../../services/eventService';

const dateTime = (value) => value
  ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })
  : 'Đang cập nhật';
const money = (cents) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND',
}).format(cents / 100);
const statuses = {
  DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản',
  CANCELLED: 'Đã hủy', COMPLETED: 'Đã kết thúc',
};

export default function EventDetail() {
  const { eventId } = useParams();
  // Reset page state immediately when navigating between events.
  return <EventContent key={eventId} eventId={eventId} />;
}

function EventContent({ eventId }) {
  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [failedBanner, setFailedBanner] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };
    eventService.getEventById(eventId, options).then((data) => {
      if (!controller.signal.aborted) {
        if (data?.eventId) setEvent(data);
        else setError('Không tìm thấy sự kiện.');
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Không thể tải sự kiện. Sự kiện có thể không tồn tại, chưa được công khai hoặc máy chủ đang gián đoạn.');
    });
    eventService.getTicketTypes(eventId, options).then((data) => {
      if (!controller.signal.aborted) setTickets(data);
    }).catch(() => {
      if (!controller.signal.aborted) setTicketError('Không thể tải danh sách loại vé. Vui lòng thử lại.');
    });
    return () => controller.abort();
  }, [eventId, attempt]);

  function retry() {
    setEvent(null);
    setTickets(null);
    setError('');
    setTicketError('');
    setAttempt((value) => value + 1);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Link to="/home" className="font-semibold text-indigo-600 hover:underline">← Danh sách sự kiện</Link>
        {!event && !error && <p role="status" className="py-20 text-center text-slate-500">Đang tải thông tin sự kiện…</p>}
        {error && <section role="alert" className="my-8 rounded-2xl border border-rose-200 bg-white p-8">
          <h1 className="mb-3 text-2xl font-bold">Không thể hiển thị sự kiện</h1>
          <p>{error}</p>
          <button type="button" onClick={retry} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white">Thử lại</button>
        </section>}
        {event && <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          {event.bannerUrl && failedBanner !== event.bannerUrl
            ? <img src={event.bannerUrl} alt={event.name} onError={() => setFailedBanner(event.bannerUrl)} className="max-h-96 w-full object-cover" />
            : <div aria-hidden="true" className="h-40 bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-400 sm:h-56" />}
          <div className="space-y-8 p-6 sm:p-10">
            <div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">{statuses[event.status] || event.status}</span>
              <h1 className="mt-4 break-words text-3xl font-extrabold text-slate-900 sm:text-4xl">{event.name}</h1>
              <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                <div><dt className="text-sm text-slate-500">Bắt đầu</dt><dd className="mt-1 font-semibold">{dateTime(event.startsAt)}</dd></div>
                <div><dt className="text-sm text-slate-500">Kết thúc</dt><dd className="mt-1 font-semibold">{dateTime(event.endsAt)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-sm text-slate-500">Địa điểm</dt><dd className="mt-1 break-words font-semibold">{event.venue || 'Đang cập nhật địa điểm'}</dd></div>
              </dl>
            </div>
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-xl font-bold text-slate-900">Giới thiệu sự kiện</h2>
              <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed text-slate-600">{event.description || 'Thông tin giới thiệu đang được cập nhật.'}</p>
            </section>
            <section className="border-t border-slate-100 pt-6">
              <h2 className="text-xl font-bold text-slate-900">Thông tin vé</h2>
              {ticketError ? <div role="alert" className="mt-4 text-rose-600">{ticketError} <button type="button" className="font-semibold underline" onClick={retry}>Thử lại</button></div>
                : tickets === null ? <p role="status" className="mt-4 text-slate-500">Đang tải thông tin vé…</p>
                  : tickets.length === 0 ? <p className="mt-4 text-slate-500">Sự kiện chưa có loại vé nào được mở bán.</p>
                    : <ul className="mt-4 grid gap-4 sm:grid-cols-2">{tickets.map((ticket) => <li key={ticket.ticketTypeId} className="rounded-2xl border border-slate-200 p-5">
                      <h3 className="font-bold">{ticket.name}</h3>
                      <p className="mt-2 text-lg font-bold text-indigo-600">{money(ticket.priceCents)}</p>
                      <p className="mt-2 text-sm text-slate-500">{ticket.remaining > 0 ? `Còn ${ticket.remaining} vé` : 'Hết vé'}</p>
                      {ticket.bundleSize > 1 && <p className="mt-1 text-sm text-slate-500">Gói {ticket.bundleSize} vé</p>}
                    </li>)}</ul>}
            </section>
          </div>
        </article>}
      </main>
      <Footer />
    </div>
  );
}
