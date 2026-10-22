import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { adminDeviceService, deviceError } from '../../services/adminDeviceService';
import { userService } from '../../services/userService';
import { Dialog, Field, Icon } from '../EventManagementPage/managementUi';
import { createPreviewService, eventName, filterDevices, withoutKey } from './deviceUtils';
import '../EventManagementPage/event-management.css';
import '../AdminUsersPage/admin-users.css';
import './admin-devices.css';

const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận';
const emptyFilters = { query: '', scope: '', type: '', status: '' };

function CreateDevice({ api, events, eventsError, eventsLoading, close, complete }) {
  const [type, setType] = useState('global'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const form = new FormData(event.currentTarget), label = String(form.get('label') || '').trim();
    const eventId = form.get('eventId');
    if (!label) { setError('Vui lòng nhập tên thiết bị.'); return; }
    if (type === 'event' && (!eventId || !events.some((item) => item.eventId === eventId))) { setError('Vui lòng chọn một sự kiện hợp lệ.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { complete(await api.create({ label, eventId: type === 'event' ? eventId : null })); }
    catch (failure) { setError(deviceError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title="Tạo thiết bị mới" close={close} busy={busy}>
    <p className="ad-muted">Tạo thiết bị check-in và nhận API key để tích hợp với ứng dụng.</p>
    <form onSubmit={submit} aria-busy={busy}>
      {error && <p className="au-message error" role="alert">{error}</p>}
      <fieldset disabled={busy}>
        <Field label="Tên thiết bị" name="label" required maxLength={255} placeholder="Ví dụ: iPad Check-in Cổng 3" />
        <fieldset className="ad-type"><legend>Loại thiết bị</legend>
          <label><input type="radio" name="type" value="global" checked={type === 'global'} onChange={() => setType('global')} /><span>Thiết bị toàn cầu<small>Sử dụng cho mọi sự kiện</small></span></label>
          <label><input type="radio" name="type" value="event" checked={type === 'event'} onChange={() => setType('event')} /><span>Thiết bị theo sự kiện<small>Chỉ sử dụng cho sự kiện được chọn</small></span></label>
        </fieldset>
        {type === 'event' && <><Field label="Gắn sự kiện"><select name="eventId" required disabled={eventsLoading || !!eventsError} defaultValue=""><option value="">{eventsLoading ? 'Đang tải sự kiện…' : 'Chọn sự kiện'}</option>{events.map((item) => <option key={item.eventId} value={item.eventId}>{item.name}{item.status === 'CANCELLED' ? ' (Đã hủy)' : ''}</option>)}</select></Field>{eventsError && <p className="au-message error" role="alert">{eventsError}</p>}{!eventsLoading && !eventsError && !events.length && <p className="ad-muted">Chưa có sự kiện. Hãy tạo sự kiện trước hoặc chọn thiết bị toàn cầu.</p>}</>}
        <p className="ad-muted">API key chỉ hiển thị một lần sau khi tạo. Thiết bị bị thu hồi sẽ không thể kích hoạt lại.</p>
        <div className="em-form-actions"><button type="button" onClick={close}>Hủy</button><button className="primary" disabled={busy || (type === 'event' && (eventsLoading || !!eventsError || !events.length))}>{busy ? 'Đang tạo…' : 'Tạo thiết bị'}</button></div>
      </fieldset>
    </form>
  </Dialog>;
}

function KeyDialog({ device, close }) {
  const [message, setMessage] = useState('');
  const input = useRef(null);
  async function copy() {
    try { await navigator.clipboard.writeText(device.apiKey); setMessage('Đã sao chép API key.'); }
    catch { input.current?.focus(); input.current?.select(); setMessage('Chưa thể sao chép tự động. Hãy sao chép key trong ô đã chọn.'); }
  }
  return <Dialog title="Tạo thiết bị thành công" close={close}>
    <div className="ad-key-art"><Icon name="device" /></div>
    <p className="ad-muted">Thiết bị <strong>{device.label}</strong> đã sẵn sàng. Sao chép và lưu API key trước khi đóng cửa sổ này.</p>
    {device.apiKey ? <><label className="em-field"><span>API key thiết bị</span><div className="ad-key"><input ref={input} aria-label="API key thiết bị" value={device.apiKey} readOnly autoComplete="off" spellCheck={false} /><button type="button" onClick={copy}>Sao chép</button></div></label><p className="au-message error">API key chỉ hiển thị một lần. Không chia sẻ công khai; bạn sẽ không xem lại được key này.</p></> : <p className="au-message error" role="alert">Máy chủ đã tạo thiết bị nhưng không trả về API key. Bạn cần thu hồi thiết bị này và tạo thiết bị mới.</p>}
    {message && <p role="status" className="ad-muted">{message}</p>}
    <div className="em-form-actions"><button className="primary" onClick={close}>{device.apiKey ? 'Đã lưu key, đóng' : 'Đóng'}</button></div>
  </Dialog>;
}

function RevokeDialog({ device, api, close, complete }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { complete(await api.revoke(device.deviceId)); }
    catch (failure) { setError(deviceError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title="Thu hồi thiết bị" close={close} busy={busy}>
    <form onSubmit={submit} aria-busy={busy}>
      <p>Thu hồi thiết bị <strong>{device.label}</strong>?</p><p className="ad-muted">Thao tác này là vĩnh viễn. API key sẽ mất hiệu lực; mọi lượt quét gửi từ thiết bị, kể cả hàng đợi ngoại tuyến, sẽ bị máy chủ từ chối.</p>
      {error && <p className="au-message error" role="alert">{error}</p>}
      <div className="em-form-actions"><button type="button" disabled={busy} onClick={close}>Quay lại</button><button className="danger" disabled={busy}>{busy ? 'Đang thu hồi…' : 'Xác nhận thu hồi'}</button></div>
    </form>
  </Dialog>;
}

function Workspace({ preview }) {
  const { user, logout } = useAuth();
  const api = useMemo(() => preview ? createPreviewService() : adminDeviceService, [preview]);
  const [devices, setDevices] = useState([]), [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [eventsLoading, setEventsLoading] = useState(true), [eventsError, setEventsError] = useState('');
  const [revision, setRevision] = useState(0), [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(0), [size, setSize] = useState(10), [modal, setModal] = useState(null), [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api.list(controller.signal).then((data) => { if (!controller.signal.aborted) { setDevices(data.map(withoutKey)); setError(''); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(deviceError(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    api.events(controller.signal).then((data) => { if (!controller.signal.aborted) { setEvents(data); setEventsError(''); } })
      .catch((failure) => { if (!controller.signal.aborted) setEventsError(`Không tải được danh sách sự kiện: ${deviceError(failure)}`); })
      .finally(() => { if (!controller.signal.aborted) setEventsLoading(false); });
    return () => controller.abort();
  }, [api, revision]);
  const filtered = filterDevices(devices, events, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * size, (current + 1) * size);
  const globalCount = devices.filter((device) => !device.eventId).length;
  function changeFilter(key, value) { setFilters((old) => ({ ...old, [key]: value })); setPage(0); }
  function refresh() { setLoading(true); setEventsLoading(true); setError(''); setEventsError(''); setRevision((n) => n + 1); }
  async function signOut() { try { await userService.logout(); } finally { logout(); } }
  return <div className="event-management admin-devices">
    <header className="em-header"><Link className="em-brand" to="/home"><span><Icon /></span>EventHub</Link><nav aria-label="Điều hướng chính"><Link to="/home">Trang chủ</Link><Link to="/manage">Sự kiện</Link><Link to="/#features">Về chúng tôi</Link></nav><details className="em-account"><summary><span className="em-avatar">{(user?.fullName || 'A').charAt(0)}</span>{user?.fullName || 'Admin'} ⌄</summary><div><Link to="/profile">Hồ sơ cá nhân</Link><Link to="/admin/users">Quản trị người dùng</Link>{!preview && <button onClick={() => { void signOut().catch(() => {}); }}>Đăng xuất</button>}</div></details></header>
    <div className="ad-layout"><aside className="ad-sidebar"><h2>Quản trị hệ thống</h2><nav aria-label="Quản trị hệ thống"><Link to="/manage"><Icon name="calendar" />Quản lý sự kiện</Link><Link to="/admin/devices" aria-current="page"><Icon name="device" />Quản trị thiết bị</Link><Link to="/admin/users"><Icon name="users" />Người dùng</Link><Link to="/checkin"><Icon name="ticket" />Soát vé</Link></nav></aside>
      <main className="ad-main">
        {preview && <p className="em-preview">Bản xem thử · Dữ liệu minh họa, thao tác chỉ lưu trong phiên này. Key mẫu không dùng để soát vé thật.</p>}
        <nav className="au-breadcrumb" aria-label="Đường dẫn"><span>Quản trị hệ thống</span><span>›</span><span>Quản trị thiết bị</span></nav>
        <section className="ad-heading"><div><h1>Quản trị thiết bị toàn cầu</h1><p>Quản lý các thiết bị check-in được sử dụng tại mọi sự kiện. Tạo thiết bị mới và thu hồi key khi cần thiết.</p></div><button className="primary" disabled={loading || !!error} onClick={() => { setNotice(''); setModal({ kind: 'create' }); }}>＋ Tạo thiết bị mới</button></section>
        {notice && <p className="au-message" role="status">{notice}</p>}
        {eventsError && <div className="ad-event-error"><p role="alert">{eventsError}</p><button disabled={loading} onClick={refresh}>Tải lại dữ liệu</button></div>}
        <section className="ad-panel" aria-label="Danh sách thiết bị">
          <nav className="ad-tabs" aria-label="Phạm vi thiết bị">{[['', 'Tất cả thiết bị', devices.length], ['global', 'Thiết bị toàn cầu', globalCount], ['event', 'Thiết bị theo sự kiện', devices.length - globalCount]].map(([value, label, count]) => <button key={value} aria-pressed={filters.scope === value} onClick={() => { setFilters((old) => ({ ...old, scope: value, type: '' })); setPage(0); }}>{label} ({loading || error ? '—' : count})</button>)}</nav>
          <div className="ad-filters"><label className="au-search"><Icon name="eye" /><input type="search" aria-label="Tìm thiết bị" placeholder="Tìm theo tên thiết bị, mã thiết bị hoặc sự kiện…" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} /></label><select aria-label="Loại thiết bị" value={filters.type} onChange={(e) => changeFilter('type', e.target.value)}><option value="">Tất cả loại</option><option value="global">Toàn cầu</option><option value="event">Theo sự kiện</option></select><select aria-label="Trạng thái thiết bị" value={filters.status} onChange={(e) => changeFilter('status', e.target.value)}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="REVOKED">Đã thu hồi</option></select><button aria-label="Làm mới danh sách" disabled={loading} onClick={refresh}>↻</button></div>
          {loading ? <div className="au-empty" role="status"><span className="em-spinner" />Đang tải thiết bị…</div> : error ? <div className="au-empty"><p className="au-message error" role="alert">{error}</p><button onClick={refresh}>Thử lại</button><Link to="/login">Đăng nhập lại</Link></div> : <>
            <div className="ad-table-scroll"><table className="au-table ad-table"><thead><tr>{['Tên thiết bị', 'Mã thiết bị', 'Loại', 'Sự kiện được gán', 'Trạng thái', 'Hoạt động lần cuối', 'Thao tác'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map((device) => <tr key={device.deviceId}><td><div className="ad-device"><span className="ad-device-icon"><Icon name="device" /></span><strong>{device.label}</strong></div></td><td><code className="ad-id" title={device.deviceId}>{device.deviceId}</code></td><td><span className={`ad-kind ${device.eventId ? 'event' : ''}`}>{device.eventId ? 'Theo sự kiện' : 'Toàn cầu'}</span></td><td><span className={!device.eventId ? 'ad-muted' : ''}>{eventName(device.eventId, events)}</span></td><td><span className={`em-badge ${device.status.toLowerCase()}`}>{device.status === 'ACTIVE' ? 'Đang hoạt động' : device.status === 'REVOKED' ? 'Đã thu hồi' : device.status}</span></td><td><time dateTime={device.lastSeenAt || undefined}>{dateTime(device.lastSeenAt)}</time></td><td><button className="small" aria-label={`Chi tiết ${device.label}`} onClick={() => setModal({ kind: 'detail', device })}>Chi tiết</button>{device.status === 'ACTIVE' && <button className="small danger-text" aria-label={`Thu hồi ${device.label}`} onClick={() => { setNotice(''); setModal({ kind: 'revoke', device }); }}>Thu hồi</button>}</td></tr>)}</tbody></table></div>
            {!visible.length && <div className="au-empty"><Icon name="device" /><strong>{devices.length ? 'Không tìm thấy thiết bị phù hợp.' : 'Chưa có thiết bị check-in.'}</strong>{devices.length > 0 && <button onClick={() => { setFilters(emptyFilters); setPage(0); }}>Xóa bộ lọc</button>}</div>}
            <footer className="au-footer ad-footer"><p>Hiển thị {filtered.length ? current * size + 1 : 0}–{Math.min((current + 1) * size, filtered.length)} của <strong>{filtered.length}</strong> thiết bị</p><nav aria-label="Phân trang thiết bị"><button aria-label="Trang trước" disabled={current === 0} onClick={() => setPage(current - 1)}>‹</button><span>Trang {current + 1} / {pages}</span><button aria-label="Trang sau" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>›</button></nav><select aria-label="Số thiết bị mỗi trang" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>{[10, 20, 50].map((n) => <option key={n} value={n}>{n} / trang</option>)}</select></footer>
          </>}
        </section>
      </main>
    </div>
    {modal?.kind === 'create' && <CreateDevice api={api} events={events} eventsLoading={eventsLoading} eventsError={eventsError} close={() => setModal(null)} complete={(result) => { setDevices((items) => [withoutKey(result), ...items.filter((item) => item.deviceId !== result.deviceId)]); setModal({ kind: 'key', device: result }); }} />}
    {modal?.kind === 'key' && <KeyDialog device={modal.device} close={() => { setNotice('Đã tạo thiết bị. API key không thể xem lại.'); setModal(null); }} />}
    {modal?.kind === 'revoke' && <RevokeDialog device={modal.device} api={api} close={() => setModal(null)} complete={(result) => { setDevices((items) => items.map((item) => item.deviceId === result.deviceId ? withoutKey(result) : item)); setNotice('Đã thu hồi thiết bị. API key không còn hiệu lực.'); setModal(null); }} />}
    {modal?.kind === 'detail' && <Dialog title="Chi tiết thiết bị" close={() => setModal(null)}><dl className="au-detail"><dt>Tên thiết bị</dt><dd>{modal.device.label}</dd><dt>Mã thiết bị</dt><dd>{modal.device.deviceId}</dd><dt>Sự kiện</dt><dd>{eventName(modal.device.eventId, events)}</dd><dt>Trạng thái</dt><dd>{modal.device.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã thu hồi'}</dd><dt>Ngày tạo</dt><dd>{dateTime(modal.device.createdAt)}</dd><dt>Hoạt động lần cuối</dt><dd>{dateTime(modal.device.lastSeenAt)}</dd><dt>Thu hồi lúc</dt><dd>{modal.device.revokedAt ? dateTime(modal.device.revokedAt) : 'Chưa thu hồi'}</dd></dl><p className="ad-muted">API key chỉ được cấp lúc tạo thiết bị và không thể xem lại.</p></Dialog>}
  </div>;
}

export default function AdminDevices({ preview = false }) {
  const { user } = useAuth();
  if (!preview && !user?.roles?.includes('ADMIN')) return <div className="event-management"><main className="au-empty"><h1>Không có quyền truy cập</h1><p>Chỉ Quản trị viên (ADMIN) được quản lý thiết bị toàn hệ thống.</p><Link to="/manage">Về quản lý sự kiện</Link></main></div>;
  return <Workspace preview={preview} />;
}
