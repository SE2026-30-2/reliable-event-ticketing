import { useEffect, useId, useRef, useState } from 'react';
import { managementError } from '../../services/manageEventService';

export function Icon({ name = 'ticket' }) {
  const paths = {
    ticket: 'M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Zm8 0v3m0 3v4m0 3v3',
    overview: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
    coupon: 'M3 3h9l9 9-9 9-9-9V3Zm5 4h.01',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    device: 'M6 2h12v20H6V2Zm0 15h12m-7 4h2',
    live: 'M2 12h4l4-9 4 18 4-9h4',
    report: 'M4 21V11h4v10m2 0V3h4v18m2 0V7h4v14',
    edit: 'm16 3 5 5-12 12H4v-5L16 3Zm-2 2 5 5',
    pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    calendar: 'M4 5h16v16H4V5Zm0 5h16M8 2v6m8-6v6',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    money: 'M12 2v20m5-16H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.ticket} /></svg>;
}
export function Field({ label, children, ...props }) {
  return <label className="em-field"><span>{label}</span>{children || <input {...props} />}</label>;
}
export function Panel({ title, action, children, className = '' }) {
  return <section className={`em-panel ${className}`}><div className="em-panel-heading"><h2>{title}</h2>{action}</div>{children}</section>;
}
export function Message({ error, children }) {
  return <div className={`em-message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div>;
}
export function ResourceState({ resource, retry }) {
  if (resource.loading) return <div className="em-empty" role="status"><span className="em-spinner" />Đang tải dữ liệu…</div>;
  if (resource.error) return <div className="em-empty"><Message error>{resource.error}</Message><button onClick={retry}>Thử lại</button></div>;
  return null;
}
export function Table({ headers, rows, empty = 'Chưa có dữ liệu.' }) {
  if (!rows.length) return <div className="em-empty">{empty}</div>;
  return <div className="em-table-scroll"><table><thead><tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key}>{row.cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
const statusLabels = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố', CANCELLED: 'Đã hủy', ISSUED: 'Đã phát hành', RESERVED: 'Đang giữ chỗ', VOID: 'Vô hiệu hóa', REFUNDED: 'Đã hoàn tiền', TRANSFERRED: 'Đã chuyển nhượng', ACTIVE: 'Hoạt động', REVOKED: 'Đã thu hồi' };
export function Badge({ status }) { return <span className={`em-badge ${String(status).toLowerCase()}`}>{statusLabels[status] || status}</span>; }
export function Stat({ icon, label, value, note, children }) { return <div className="em-stat"><span className="em-stat-icon"><Icon name={icon} /></span><p>{label}</p><strong>{value}</strong>{children}<small>{note}</small></div>; }
export function Dialog({ title, close, children, busy = false }) {
  const ref = useRef(null), titleId = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  const safeClose = () => { if (!busy && !ref.current?.querySelector('form[aria-busy="true"]')) close(); };
  return <dialog className="em-dialog" ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); safeClose(); }}><header><h2 id={titleId}>{title}</h2><button type="button" disabled={busy} aria-label="Đóng hộp thoại" onClick={safeClose}>×</button></header>{children}</dialog>;
}
export function ActionForm({ submit, complete, children, label = 'Lưu', cancel, danger = false, resetOnSuccess = false }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  async function handle(event) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const form = event.currentTarget;
    try { const result = await submit(Object.fromEntries(new FormData(form))); if (resetOnSuccess) form.reset(); complete?.(result); }
    catch (failure) { setError(failure.isAxiosError ? managementError(failure) : failure.message || 'Không thể hoàn tất thao tác.'); }
    finally { locked.current = false; setBusy(false); }
  }
  return <form onSubmit={handle} aria-busy={busy}>{error && <Message error>{error}</Message>}<fieldset disabled={busy}>{children}<div className="em-form-actions">{cancel && <button type="button" onClick={cancel}>Quay lại</button>}<button type="submit" className={danger ? 'danger' : 'primary'}>{busy ? 'Đang xử lý…' : label}</button></div></fieldset></form>;
}
