import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { adminUserService, adminUserError } from '../../services/adminUserService';
import { Dialog, Icon } from '../EventManagementPage/managementUi';
import { filterUsers, hasRole, organizerRoles, userStats } from './adminUsersUtils';
import '../EventManagementPage/event-management.css';
import './admin-users.css';

const number = (value) => new Intl.NumberFormat('vi-VN').format(value);
const date = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('vi-VN') : '—';
const emptyFilters = { query: '', role: '', verified: '', status: '' };
const previewUsers = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Minh C', 'Phạm Hoàng D', 'Vũ Thảo E', 'Hoàng Gia F', 'Nguyễn Ngọc G', 'Đặng Tuấn H', 'Trần Mai I', 'Phạm Linh K', 'Lý An L', 'Nguyễn Hà M'].map((fullName, i) => ({
  id: `demo-${i}`, fullName, email: ['nguyen.van.a', 'tran.thi.b', 'le.minh.c', 'pham.hoang.d', 'vu.thao.e', 'hoang.gia.f', 'nguyen.ngoc.g', 'dang.tuan.h', 'tran.mai.i', 'pham.linh.k', 'ly.an.l', 'nguyen.ha.m'][i] + '@example.com',
  roles: i % 3 === 0 ? ['USER', 'ORGANIZER'] : ['USER'], status: i % 5 === 4 ? 'LOCKED' : 'ACTIVE', emailVerified: i % 3 !== 2,
  createdAt: `2026-${String(i + 1).padStart(2, '0')}-12T08:00:00Z`, failedLoginAttempts: i % 5 === 4 ? 5 : 0,
}));

function createPreviewService() {
  let data = previewUsers.map((item) => ({ ...item, roles: [...item.roles] }));
  const update = async (id, patch) => {
    data = data.map((item) => item.id === id ? { ...item, ...patch } : item);
    return data.find((item) => item.id === id);
  };
  return {
    list: async () => data,
    detail: async (id) => data.find((item) => item.id === id),
    status: (id, status) => update(id, { status, ...(status === 'ACTIVE' ? { failedLoginAttempts: 0 } : {}) }),
    roles: (id, roles) => update(id, { roles }),
  };
}

function RoleBadges({ user }) {
  return <div className="au-roles">{user.roles.map((role) => <span key={role} className={`au-badge ${role.toLowerCase()}`}>{role}</span>)}</div>;
}
function Status({ user }) {
  return <span className={`au-badge ${user.status.toLowerCase()}`}>{user.status}</span>;
}
function Verified({ user }) {
  return <span className={`au-verified ${user.emailVerified ? 'yes' : ''}`}><i />{user.emailVerified ? 'Đã xác thực' : 'Chưa xác thực'}</span>;
}

function UserDialog({ target, api, close, changed, currentUser }) {
  const [detail, setDetail] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const action = target.action;
  useEffect(() => {
    const controller = new AbortController();
    api.detail(target.user.id, controller.signal).then((data) => { if (!controller.signal.aborted) { setDetail(data); setError(''); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(adminUserError(failure)); });
    return () => controller.abort();
  }, [target.user.id, api, attempt]);
  const title = { detail: 'Chi tiết người dùng', grant: 'Cấp vai trò ORGANIZER', revoke: 'Thu hồi vai trò ORGANIZER', lock: 'Khóa tài khoản', unlock: 'Mở khóa tài khoản' }[action];
  const self = detail && (detail.id === currentUser?.id || detail.email === currentUser?.email);
  const forbidden = self && (action === 'lock' || action === 'revoke');
  async function submit(event) {
    event.preventDefault();
    if (lock.current || !detail || forbidden) return;
    lock.current = true; setBusy(true); setError('');
    try {
      // Read current roles immediately before PATCH so other roles are preserved.
      const fresh = await api.detail(detail.id);
      const result = ['grant', 'revoke'].includes(action)
        ? await api.roles(detail.id, organizerRoles(fresh, action === 'grant'))
        : await api.status(detail.id, action === 'lock' ? 'LOCKED' : 'ACTIVE');
      changed(result, `${title} thành công cho ${result.fullName || result.email}.`);
    } catch (failure) { setError(adminUserError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog title={title} close={close} busy={busy}>
    {error && <p className="au-message error" role="alert">{error}</p>}
    {!detail && !error && <p role="status">Đang tải người dùng…</p>}
    {!detail && error && <button onClick={() => { setError(''); setAttempt((n) => n + 1); }}>Thử lại</button>}
    {detail && (action === 'detail' ? <dl className="au-detail">
      <dt>Họ và tên</dt><dd>{detail.fullName || 'Chưa cập nhật'}</dd><dt>Email</dt><dd>{detail.email}</dd>
      <dt>Mã người dùng</dt><dd>{detail.id}</dd><dt>Vai trò</dt><dd><RoleBadges user={detail} /></dd>
      <dt>Trạng thái email</dt><dd><Verified user={detail} /></dd><dt>Trạng thái tài khoản</dt><dd><Status user={detail} /></dd>
      <dt>Ngày tham gia</dt><dd>{date(detail.createdAt)}</dd><dt>Số lần đăng nhập sai</dt><dd>{detail.failedLoginAttempts ?? 0}</dd>
    </dl> : <form onSubmit={submit} aria-busy={busy}>
      <p>Xác nhận {title.toLocaleLowerCase('vi')} cho <strong>{detail.fullName || detail.email}</strong>?</p><p className="au-muted">{detail.email}</p>
      {['grant', 'revoke'].includes(action) && <p className="au-hint">Thay đổi vai trò có hiệu lực từ lần cấp token tiếp theo của người dùng.</p>}
      {action === 'lock' && <p className="au-hint">Người dùng sẽ không thể đăng nhập; các refresh token hiện tại sẽ bị thu hồi.</p>}
      {forbidden && <p className="au-message error" role="alert">Bạn không thể thực hiện thao tác này với tài khoản đang đăng nhập.</p>}
      <div className="em-form-actions"><button type="button" disabled={busy} onClick={close}>Hủy</button><button className={action === 'lock' ? 'danger' : 'primary'} disabled={busy || forbidden}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button></div>
    </form>)}
  </Dialog>;
}

function Workspace({ preview }) {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0), [filters, setFilters] = useState(emptyFilters), [page, setPage] = useState(0), [size, setSize] = useState(10);
  const [target, setTarget] = useState(null), [notice, setNotice] = useState('');
  const api = useMemo(() => preview ? createPreviewService() : adminUserService, [preview]);
  useEffect(() => {
    const controller = new AbortController();
    api.list(controller.signal).then((data) => { if (!controller.signal.aborted) { setUsers(data); setError(''); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(adminUserError(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, refresh]);
  const filtered = filterUsers(users, filters), stats = userStats(users);
  const pages = Math.max(1, Math.ceil(filtered.length / size)), current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * size, (current + 1) * size);
  function changeFilter(key, value) { setFilters((f) => ({ ...f, [key]: value })); setPage(0); }
  function retry() { setLoading(true); setError(''); setRefresh((n) => n + 1); }
  function open(action, item, event) { event.currentTarget.closest('details')?.removeAttribute('open'); setTarget({ action, user: item }); setNotice(''); }
  return <div className="event-management admin-users">
    <header className="em-header"><Link className="em-brand" to="/home"><span><Icon /></span>EventHub</Link><nav aria-label="Điều hướng chính"><Link to="/home">Trang chủ</Link><Link to="/manage">Sự kiện</Link><Link to="/#features">Về chúng tôi</Link></nav><details className="em-account"><summary><span className="em-avatar">{(user?.fullName || 'A').charAt(0)}</span>{user?.fullName || 'Admin'} ⌄</summary><div><Link to="/profile">Hồ sơ cá nhân</Link><Link to="/manage">Quản lý sự kiện</Link><Link to="/admin/devices">Quản trị thiết bị</Link>{!preview && <button onClick={logout}>Đăng xuất</button>}</div></details></header>
    <div className="au-container">
      {preview && <p className="em-preview">Bản xem thử · Dữ liệu minh họa, thao tác chỉ lưu trong phiên này.</p>}
      <nav className="au-breadcrumb" aria-label="Đường dẫn"><span>Quản trị hệ thống</span><span>›</span><span>Quản trị người dùng</span></nav>
      <section className="au-heading"><div><h1>Quản trị người dùng</h1><p>Quản lý tài khoản người dùng trên hệ thống EventHub.</p></div><div className="au-stats">{['Tổng người dùng', 'Nhà tổ chức', 'Người tham dự'].map((label, i) => <div className="au-stat" key={label}><span className="au-stat-icon"><Icon name={i === 1 ? 'overview' : 'users'} /></span><div><p>{label}</p><strong>{loading || error ? '—' : number(stats[i])}</strong></div></div>)}</div></section>
      <div className="au-filters"><label className="au-search"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></svg><input type="search" aria-label="Tìm kiếm theo tên hoặc email" placeholder="Tìm kiếm theo tên, email…" value={filters.query} onChange={(e) => changeFilter('query', e.target.value)} /></label>
        <select aria-label="Vai trò" value={filters.role} onChange={(e) => changeFilter('role', e.target.value)}><option value="">Tất cả vai trò</option><option value="ADMIN">ADMIN</option><option value="ORGANIZER">ORGANIZER</option><option value="USER">USER</option></select>
        <select aria-label="Trạng thái email" value={filters.verified} onChange={(e) => changeFilter('verified', e.target.value)}><option value="">Tất cả trạng thái email</option><option value="true">Đã xác thực</option><option value="false">Chưa xác thực</option></select>
        <select aria-label="Trạng thái tài khoản" value={filters.status} onChange={(e) => changeFilter('status', e.target.value)}><option value="">Tất cả trạng thái TK</option><option value="ACTIVE">ACTIVE</option><option value="LOCKED">LOCKED</option></select>
      </div>
      {notice && <p className="au-message" role="status">{notice}</p>}
      {loading ? <div className="au-empty" role="status"><span className="em-spinner" />Đang tải danh sách người dùng…</div> : error ? <div className="au-empty"><p role="alert">{error}</p><button onClick={retry}>Thử lại</button><Link to="/login">Đăng nhập lại</Link></div> : <>
        <div className="au-table-scroll"><table className="au-table"><thead><tr>{['Người dùng', 'Email', 'Vai trò', 'Trạng thái email', 'Trạng thái tài khoản', 'Thao tác'].map((h) => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((item) => <tr key={item.id}>
          <td><div className="au-person"><span className="au-avatar">{(item.fullName || item.email).split(' ').map((part) => part.charAt(0)).slice(-2).join('')}</span><div><strong>{item.fullName || 'Chưa cập nhật'}</strong><small>Tham gia {date(item.createdAt)}</small></div></div></td><td>{item.email}</td><td><RoleBadges user={item} /></td><td><Verified user={item} /></td><td><Status user={item} /></td>
          <td><details className="au-actions" onToggle={(event) => { if (event.currentTarget.open) { document.querySelectorAll('.au-actions[open]').forEach((other) => { if (other !== event.currentTarget) other.open = false; }); } }}><summary aria-label={`Thao tác với ${item.fullName || item.email}`}>•••</summary><div>
            <button onClick={(e) => open('detail', item, e)}><Icon name="eye" />Xem chi tiết</button>
            <button disabled={!preview && item.email === user?.email && hasRole(item, 'ORGANIZER')} onClick={(e) => open(hasRole(item, 'ORGANIZER') ? 'revoke' : 'grant', item, e)}><Icon name="users" />{hasRole(item, 'ORGANIZER') ? 'Thu hồi vai trò ORGANIZER' : 'Cấp vai trò ORGANIZER'}</button>
            <button className={item.status === 'ACTIVE' ? 'danger-text' : ''} disabled={!preview && item.email === user?.email && item.status === 'ACTIVE'} onClick={(e) => open(item.status === 'ACTIVE' ? 'lock' : 'unlock', item, e)}><Icon name="edit" />{item.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</button>
          </div></details></td>
        </tr>)}</tbody></table>{!visible.length && <div className="au-empty"><Icon name="users" /><strong>{users.length ? 'Không tìm thấy người dùng phù hợp.' : 'Chưa có người dùng.'}</strong>{users.length > 0 && <button onClick={() => { setFilters(emptyFilters); setPage(0); }}>Xóa bộ lọc</button>}</div>}</div>
        <footer className="au-footer"><p>Hiển thị {filtered.length ? number(current * size + 1) : 0} - {number(Math.min((current + 1) * size, filtered.length))} của <strong>{number(filtered.length)}</strong> người dùng</p><nav aria-label="Phân trang người dùng"><button aria-label="Trang trước" disabled={current === 0} onClick={() => setPage(current - 1)}>‹</button>{[...new Set([0, current - 1, current, current + 1, pages - 1])].filter((n) => n >= 0 && n < pages).sort((a, b) => a - b).map((n, i, list) => <span key={n}>{i > 0 && n - list[i - 1] > 1 && <span className="au-ellipsis">…</span>}<button aria-label={`Trang ${n + 1}`} aria-current={current === n ? 'page' : undefined} onClick={() => setPage(n)}>{number(n + 1)}</button></span>)}<button aria-label="Trang sau" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>›</button></nav><select aria-label="Số người dùng mỗi trang" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>{[10, 20, 50].map((n) => <option key={n} value={n}>{n} / trang</option>)}</select></footer>
      </>}
    </div>
    {target && <UserDialog key={`${target.user.id}-${target.action}`} target={target} api={api} close={() => setTarget(null)} currentUser={user} changed={(updated, message) => { setUsers((items) => items.map((item) => item.id === updated.id ? updated : item)); setNotice(message); setTarget(null); }} />}
  </div>;
}

export default function AdminUsers({ preview = false }) {
  const { user } = useAuth();
  if (!preview && !hasRole(user, 'ADMIN')) return <div className="event-management"><div className="au-empty"><h1>Không có quyền truy cập</h1><p>Chỉ Quản trị viên (ADMIN) được quản lý người dùng.</p><Link to="/home">Về trang chủ</Link></div></div>;
  return <Workspace preview={preview} />;
}
