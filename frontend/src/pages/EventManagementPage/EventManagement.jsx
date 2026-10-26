import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import { manageEventService } from '../../services/manageEventService';
import { ActionForm, Badge, Dialog, Field, Icon, Message, Panel, ResourceState, Stat, Table } from './managementUi';
import { useResource } from './useResource';
import { Coupons, Devices, Guests, Live, Reports, Tickets, TicketTypes } from './ManagementTabs';
import { dateRange, dateTime, localDate, money, number, requiredText } from './eventManagementUtils';
import { createPreviewService } from './previewService';
import './event-management.css';

const realApi = {
  ...manageEventService,
  workspace: async (id, signal) => {
    // The public detail endpoint alone does not prove management access.
    // Require the protected report before rendering this console.
    const [event, report] = await Promise.all([manageEventService.detail(id, signal), manageEventService.report(id, signal)]);
    return { event, report };
  },
  live: async (id, signal) => {
    const [stats, timeline] = await Promise.all([manageEventService.checkinStats(id, signal), manageEventService.timeline(id, 15, signal)]);
    return { stats, timeline };
  },
};
const tabs = [
  ['overview', 'Tổng quan', 'overview'], ['types', 'Loại vé', 'ticket'], ['coupons', 'Mã giảm giá', 'coupon'], ['guests', 'Khách mời', 'users'], ['devices', 'Thiết bị', 'device'], ['tickets', 'Danh sách vé', 'ticket'], ['live', 'Live Dashboard', 'live'], ['reports', 'Báo cáo', 'report'],
];

function Cover({ url, name }) {
  const [failed, setFailed] = useState(false);
  return <div className="em-cover">{url && !failed ? <img src={url} alt={`Ảnh bìa ${name}`} onError={() => setFailed(true)} /> : <div className="em-cover-art" role="img" aria-label="Hình minh họa thay cho ảnh bìa sự kiện"><i /><i /><i /><div className="em-stage"><span>LIVE</span><strong>EVENTHUB</strong><small>MUSIC · LIGHTS · MEMORIES</small></div><div className="em-crowd">♩ &nbsp; ♪ &nbsp; ♫ &nbsp; ♪ &nbsp; ♩</div></div>}</div>;
}
function EventForm({ event, api, changed, close }) {
  async function save(form) {
    const [startsAt, endsAt] = dateRange(form.startsAt, form.endsAt);
    const bannerUrl = form.bannerUrl.trim();
    if (bannerUrl && !/^https?:\/\//i.test(bannerUrl)) throw new Error('Ảnh bìa phải dùng đường dẫn HTTP hoặc HTTPS.');
    return api.update(event.eventId, { name: requiredText(form.name, 'tên sự kiện'), venue: form.venue.trim(), description: form.description.trim(), bannerUrl, startsAt, endsAt });
  }
  return <Dialog title="Chỉnh sửa sự kiện" close={close}><ActionForm submit={save} complete={() => changed('Đã lưu thông tin sự kiện.')} cancel={close} label="Lưu thay đổi"><Field label="Tên sự kiện" name="name" defaultValue={event.name} required maxLength={255} /><Field label="Địa điểm" name="venue" defaultValue={event.venue || ''} maxLength={255} /><Field label="Mô tả"><textarea name="description" defaultValue={event.description || ''} rows={5} maxLength={5000} /></Field><Field label="Banner URL" name="bannerUrl" type="url" defaultValue={event.bannerUrl || ''} maxLength={500} /><div className="em-form-grid"><Field label="Thời gian bắt đầu" name="startsAt" type="datetime-local" defaultValue={localDate(event.startsAt)} required /><Field label="Thời gian kết thúc" name="endsAt" type="datetime-local" defaultValue={localDate(event.endsAt)} required /></div><p className="em-muted">Múi giờ: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p></ActionForm></Dialog>;
}
function Overview({ event, report, edit, selectTab, api }) {
  const coupons = useResource(api.coupons, [event.eventId]);
  const issued = report.totals.ticketsIssued;
  const quota = report.ticketTypes.reduce((sum, t) => sum + t.quota, 0);
  const percent = quota ? Math.round(issued / quota * 100) : 0;
  return <><div className="em-stats"><Stat icon="users" label="Tổng vé đã phát hành" value={<>{number(issued)} <em>/ {number(quota)}</em></>} note="Bao gồm vé mời"><div className="em-progress"><span style={{ width: `${Math.min(percent, 100)}%` }} /><b>{percent}%</b></div></Stat><Stat icon="money" label="Doanh thu thuần" value={money(report.totals.netRevenueCents)} note="Sau khi trừ tiền hoàn" /><Stat icon="users" label="Số khách đã check-in" value={number(report.totals.checkedIn)} note="Số vé riêng biệt đã vào cổng" /><Stat icon="eye" label="Lượt xem sự kiện" value="—" note="Chưa có dữ liệu lượt xem" /></div>
    <div className="em-overview-grid"><Panel title="Thông tin sự kiện" action={event.status !== 'CANCELLED' && <button className="small" onClick={edit}><Icon name="edit" />Chỉnh sửa</button>}><dl className="em-info"><div><dt><Icon name="users" />Tên sự kiện</dt><dd>{event.name}</dd></div><div><dt><Icon name="ticket" />Mô tả</dt><dd className="em-description">{event.description || 'Chưa có mô tả.'}</dd></div><div><dt><Icon name="calendar" />Thời gian</dt><dd>{dateTime(event.startsAt)}<br />{dateTime(event.endsAt)}</dd></div><div><dt><Icon name="pin" />Địa điểm</dt><dd>{event.venue || 'Chưa có địa điểm.'}</dd></div><div><dt><Icon name="eye" />Ảnh bìa</dt><dd><Cover key={event.bannerUrl} url={event.bannerUrl} name={event.name} /></dd></div></dl></Panel>
    <div className="em-overview-right"><Panel title="Doanh thu & lượt bán vé" action={<button className="text" onClick={() => selectTab('reports')}>Xem báo cáo ↗</button>}><div className="em-unavailable-chart"><Icon name="report" /><strong>Chưa có dữ liệu theo ngày</strong><p>Báo cáo hiện cung cấp tổng doanh thu và số liệu theo loại vé.</p><button onClick={() => selectTab('live')}>Xem lưu lượng check-in →</button></div></Panel><div className="em-mini-grid"><Panel title="Top loại vé phát hành" action={<button className="text" onClick={() => selectTab('types')}>Xem tất cả</button>}><Table headers={['Loại vé', 'Số vé', 'Tiền thu']} rows={[...report.ticketTypes].sort((a, b) => b.issued - a.issued).slice(0, 3).map((t) => ({ key: t.ticketTypeId, cells: [<span className="em-type-name">{t.name}</span>, number(t.issued), money(t.revenueCents)] }))} /></Panel><Panel title="Mã giảm giá nổi bật" action={<button className="text" onClick={() => selectTab('coupons')}>Xem tất cả</button>}>{coupons.loading ? <p className="em-muted">Đang tải mã giảm giá…</p> : coupons.error ? <Message error>{coupons.error}</Message> : <Table headers={['Mã giảm giá', 'Lượt dùng']} rows={[...coupons.data].sort((a, b) => b.redeemedCount - a.redeemedCount).slice(0, 3).map((c) => ({ key: c.couponId, cells: [<span className="em-code">{c.code}</span>, number(c.redeemedCount)] }))} />}</Panel></div></div></div></>;
}

function Workspace({ preview, eventId }) {
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'overview';
  const [refresh, setRefresh] = useState(0), [notice, setNotice] = useState(''), [modal, setModal] = useState(null);
  const api = useMemo(() => preview ? createPreviewService() : realApi, [preview]);
  const resource = useResource(api.workspace, [eventId], refresh);
  const event = resource.data?.event, report = resource.data?.report;
  const selectTab = (key) => { setParams({ tab: key }); setNotice(''); setRefresh((n) => n + 1); };
  const changed = (message) => { setNotice(message); setModal(null); setRefresh((n) => n + 1); };
  const base = preview ? '/manage/preview' : '/manage';
  return <><Header /><div className="event-management">
    <div className="em-container">{preview && <div className="em-preview">Bản xem thử · Dữ liệu minh họa, thao tác chỉ lưu trong phiên này.</div>}<nav className="em-breadcrumb" aria-label="Đường dẫn"><Link to={base}>Quản trị sự kiện</Link><span>›</span><span>{event?.name || 'Chi tiết sự kiện'}</span></nav>
      {notice && <Message>{notice}</Message>}<ResourceState resource={resource} retry={() => setRefresh((n) => n + 1)} />
      {resource.error && <div className="em-error-links"><Link to={base}>Quay lại danh sách</Link><Link to="/login" state={{ from: `/manage/events/${eventId}` }}>Đăng nhập lại</Link></div>}
      {event && <><section className="em-hero"><Cover key={event.bannerUrl} url={event.bannerUrl} name={event.name} /><div className="em-hero-info"><Badge status={event.status} /><h1>{event.name}</h1><p><Icon name="calendar" />{dateTime(event.startsAt)}<span>→</span>{dateTime(event.endsAt)}</p><p><Icon name="pin" />{event.venue || 'Chưa có địa điểm.'}</p><div className="em-hero-tags"><span>Quản trị sự kiện</span><span>{number(report.ticketTypes.length)} loại vé</span></div></div><div className="em-hero-actions"><button disabled={event.status === 'CANCELLED'} onClick={() => setModal('edit')}><Icon name="edit" />Chỉnh sửa</button>{event.status === 'PUBLISHED' && <Link className="em-button primary" to={`/events/${encodeURIComponent(event.eventId)}`}>Xem trang sự kiện ↗</Link>}{event.status === 'DRAFT' && <button className="primary" onClick={() => setModal('publish')}>Xuất bản sự kiện ↗</button>}<button className="danger-light" disabled={!['DRAFT', 'PUBLISHED'].includes(event.status)} onClick={() => setModal('cancel')}>Hủy sự kiện</button></div></section>
      <nav className="em-tabs" aria-label="Các mục quản trị sự kiện">{tabs.map(([key, label, icon]) => <button key={key} aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'active' : ''} onClick={() => selectTab(key)}><Icon name={icon} />{label}</button>)}</nav>
      <div className="em-tab-content" key={`${eventId}:${tab}:${refresh}`}>
        {tab === 'overview' && <Overview event={event} report={report} edit={() => setModal('edit')} selectTab={selectTab} api={api} />}
        {tab === 'types' && <TicketTypes api={api} event={event} changed={changed} />}
        {tab === 'coupons' && <Coupons api={api} event={event} changed={changed} types={report.ticketTypes} />}
        {tab === 'guests' && <Guests api={api} event={event} changed={changed} types={report.ticketTypes} />}
        {tab === 'devices' && <Devices api={api} event={event} changed={changed} />}
        {tab === 'tickets' && <Tickets api={api} event={event} types={report.ticketTypes} />}
        {tab === 'live' && <Live api={api} event={event} />}
        {tab === 'reports' && <Reports api={api} event={event} report={report} />}
      </div>
      {modal === 'edit' && <EventForm event={event} api={api} changed={changed} close={() => setModal(null)} />}
      {(modal === 'cancel' || modal === 'publish') && <Dialog title={modal === 'cancel' ? 'Hủy sự kiện?' : 'Xuất bản sự kiện?'} close={() => setModal(null)}><ActionForm submit={() => api.update(event.eventId, { status: modal === 'cancel' ? 'CANCELLED' : 'PUBLISHED' })} complete={() => changed(modal === 'cancel' ? 'Đã hủy sự kiện.' : 'Đã xuất bản sự kiện.')} label={modal === 'cancel' ? 'Xác nhận hủy sự kiện' : 'Xác nhận xuất bản'} danger={modal === 'cancel'} cancel={() => setModal(null)}><p><strong>{event.name}</strong></p><p>{modal === 'cancel' ? 'Sự kiện đã hủy không thể xuất bản lại. Bạn có chắc muốn tiếp tục?' : 'Sự kiện sẽ được hiển thị công khai để người dùng đặt vé.'}</p></ActionForm></Dialog>}
      </>}
    </div></div><Footer /></>;
}
export default function EventManagement({ preview = false }) {
  const { eventId = 'preview' } = useParams();
  return <Workspace key={`${preview}:${eventId}`} preview={preview} eventId={eventId} />;
}
