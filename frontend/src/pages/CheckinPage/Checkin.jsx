import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { canManageEvents } from '../../utils/permissions';
import { getCertificate, historyFor, refreshCertificate, submitScan, syncScans } from '../../services/checkinService';
import { outcomes } from '../../services/checkinCrypto';
import CameraScanner from './CameraScanner';
import './checkin.css';

const time = (value) => new Date(value).toLocaleTimeString('vi-VN');
function Feedback({ result }) {
  const [title, description, tone] = outcomes[result?.outcome] || (result ? ['TỪ CHỐI', 'Máy chủ trả về trạng thái chưa được hỗ trợ.', 'danger'] : ['SẴN SÀNG SOÁT VÉ', 'Quét mã QR để kiểm tra vé vào cổng', 'idle']);
  return <section className={`ci-feedback ${tone}`} aria-live="polite" aria-atomic="true"><div className="ci-result-symbol">{tone === 'success' ? '✓' : tone === 'danger' ? '×' : tone === 'warning' ? '!' : '⌁'}</div><h2>{title}</h2><p>{description}</p>{result && <><dl><div><dt>Mã vé</dt><dd>{result.ticketId || 'Không xác định'}</dd></div>{result.eventId && <div><dt>Mã sự kiện</dt><dd>{result.eventId}</dd></div>}{result.outcome === 'ACCEPTED' && <div><dt>Lượt vào</dt><dd className="ci-entry">Entry #{result.entryNo || 1}</dd></div>}<div><dt>Thời gian quét</dt><dd>{time(result.clientCheckinAt)}</dd></div><div><dt>Xác minh</dt><dd>{result.pending ? 'Tại thiết bị · Chờ đồng bộ' : 'Máy chủ đã xác nhận'}</dd></div></dl>{result.pending && <p className="ci-local-note">Kết quả ngoại tuyến chưa đối soát vé bị hủy, quyền thiết bị và lượt quét ở cổng khác.</p>}{!result.pending && result.localOutcome && result.localOutcome !== result.outcome && <p className="ci-local-note">Kết quả đã thay đổi sau khi đối soát máy chủ.</p>}</>}</section>;
}
export default function Checkin() {
  const { user } = useAuth();
  useEffect(() => {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest'; manifest.href = '/checkin.webmanifest'; document.head.appendChild(manifest);
    if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('/checkin-sw.js').catch(() => {});
    return () => manifest.remove();
  }, []);
  const [key, setKey] = useState(() => localStorage.getItem('eventhub-device-key') || '');
  const [draft, setDraft] = useState(key), [eventId, setEventId] = useState(() => localStorage.getItem('eventhub-gate-event') || '');
  const [savedEventId, setSavedEventId] = useState(eventId);
  const [mode, setMode] = useState('camera'), [input, setInput] = useState(''), [online, setOnline] = useState(navigator.onLine);
  const [certificate, setCertificate] = useState(null), [rows, setRows] = useState([]), [result, setResult] = useState(null);
  const [filter, setFilter] = useState('all'), [busy, setBusy] = useState(false), [syncing, setSyncing] = useState(false), [message, setMessage] = useState('');
  const inputRef = useRef(null), processing = useRef(false), last = useRef({}), currentKey = useRef(key);
  const reload = useCallback(async () => { if (key) { const data = await historyFor(key); if (currentKey.current === key) { setRows(data); setResult((old) => old ? data.find((s) => s.idempotencyKey === old.idempotencyKey) || old : old); } } }, [key]);
  const sync = useCallback(async () => {
    if (!key || !navigator.onLine) return;
    setSyncing(true);
    try { await syncScans(key); await reload(); }
    catch (e) { setMessage(e.message); }
    finally { setSyncing(false); }
  }, [key, reload]);
  useEffect(() => {
    let active = true;
    getCertificate().then((c) => { if (active) setCertificate(c); }).catch((e) => { if (active) setMessage(e.message); });
    async function refresh() {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        try { const c = await refreshCertificate(); if (active) setCertificate(c); }
        catch { if (active) setMessage('Chưa tải được chứng thư mới. Chứng thư đã lưu vẫn có thể dùng ngoại tuyến.'); }
        if (active) await sync();
      }
    }
    void reload().catch((e) => setMessage(e.message)); void refresh();
    const offline = () => setOnline(false);
    window.addEventListener('online', refresh); window.addEventListener('offline', offline);
    const timer = setInterval(() => { void sync(); }, 15000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('offline', offline); };
  }, [reload, sync]);
  useEffect(() => { if (mode === 'wedge' && !busy) inputRef.current?.focus(); }, [mode, busy]);
  async function scan(value) {
    const payload = value.trim();
    if (!payload || processing.current) return;
    if (!key) { setMessage('Lưu API Key thiết bị trước khi soát vé.'); return; }
    if (last.current.payload === payload && Date.now() - last.current.at < 3000) return;
    processing.current = true; setBusy(true); setMessage('');
    last.current = { payload, at: Date.now() };
    try {
      const record = await submitScan(key, payload, savedEventId);
      setResult(record); setInput('');
      if (record.networkError) setMessage('Chưa kết nối được máy chủ. Lượt quét đã lưu trên thiết bị và sẽ tự gửi lại.');
      await reload();
    } catch (e) { setResult(null); setMessage(`Không thể soát vé: ${e.message}`); }
    finally { processing.current = false; setBusy(false); }
  }
  function saveDevice(e) {
    e.preventDefault();
    if (!draft.trim()) { setMessage('Vui lòng nhập API Key thiết bị.'); return; }
    try {
      localStorage.setItem('eventhub-device-key', draft.trim()); localStorage.setItem('eventhub-gate-event', eventId.trim());
      setSavedEventId(eventId.trim());
      currentKey.current = draft.trim(); setKey(draft.trim()); setRows([]); setResult(null); last.current = {};
      setMessage('Đã lưu cấu hình thiết bị.');
      if (draft.trim() === key) void reload();
    } catch { setMessage('Không lưu được cấu hình. Kiểm tra quyền lưu trữ của trình duyệt.'); }
  }
  const pending = rows.filter((r) => r.pending).length;
  const visible = rows.filter((r) => filter === 'all' || (filter === 'pending' ? r.pending : filter === 'ACCEPTED' ? r.outcome === filter : r.outcome !== 'ACCEPTED'));
  return <div className="ci-page"><header className="ci-header"><Link className="ci-brand" to="/home"><span>◈</span> EventHub</Link><nav aria-label="Điều hướng chính"><Link to="/home">Trang chủ</Link>{canManageEvents(user) && <Link to="/manage">Quản lý sự kiện</Link>}<Link className="active" to="/checkin">Soát vé</Link></nav><div className="ci-operator"><span>♙</span> Nhân viên soát vé</div></header>
    <div className="ci-container"><section className="ci-intro"><div><p className="ci-eyebrow">SOÁT VÉ TẠI CỔNG • KIỂM SOÁT RA VÀO • SỰ KIỆN AN TOÀN</p><h1>Soát vé tại cổng</h1><p>Nhanh chóng • Chính xác • An toàn</p></div><div className="ci-device"><form onSubmit={saveDevice}><label>API Key thiết bị<div className="ci-key-row"><input type="password" autoComplete="off" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nhập khóa thiết bị của bạn" disabled={busy || syncing} /><button disabled={busy || syncing} type="submit">Lưu</button></div></label><span className={`ci-connection ${online ? 'on' : 'off'}`}><i />{online ? 'Có mạng' : 'Ngoại tuyến'}<small>{online ? 'Tự động đồng bộ' : 'Lưu tại thiết bị'}</small></span><details><summary>Cài đặt sự kiện</summary><label>Mã sự kiện (tùy chọn)<input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="UUID sự kiện để đối chiếu khi offline" disabled={busy || syncing} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" /></label></details></form><div className={`ci-certificate ${certificate ? 'ready' : ''}`}><span>◇</span><div><strong>{certificate ? 'Offline ready · Chứng thư đã sẵn sàng' : 'Chưa sẵn sàng xác minh ngoại tuyến'}</strong><p>{certificate ? `Chứng thư cập nhật: ${new Date(certificate.updatedAt).toLocaleString('vi-VN')}` : 'Kết nối máy chủ để tải chứng thư xác minh vé.'}</p></div></div></div></section>
    {message && <div className="ci-message" role="status">{message}<button aria-label="Đóng thông báo" onClick={() => setMessage('')}>×</button></div>}
    <div className="ci-workspace"><section className="ci-main"><div className="ci-tabs" role="tablist" aria-label="Chế độ nhận mã">{[['camera', '▣', 'Camera'], ['wedge', '⌗', 'Máy quét'], ['manual', '▤', 'Nhập tay']].map(([id, icon, label]) => <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}><span>{icon}</span>{label}</button>)}</div><div className="ci-scan-grid"><div>{mode === 'camera' ? <CameraScanner onScan={scan} disabled={!key} /> : <form className="ci-input-panel" onSubmit={(e) => { e.preventDefault(); void scan(input); }}><span className="ci-input-icon">{mode === 'wedge' ? '⌗' : '▤'}</span><h2>{mode === 'wedge' ? 'Kết nối máy quét của bạn' : 'Nhập mã vé'}</h2><p>{mode === 'wedge' ? 'USB hoặc Bluetooth · Quét mã và nhấn Enter. Giữ con trỏ trong ô nhận mã.' : 'Dán toàn bộ chuỗi nội dung QR để kiểm tra chữ ký và hiệu lực vé.'}</p><label htmlFor="ci-payload">Nội dung mã QR</label>{mode === 'wedge' ? <input id="ci-payload" ref={inputRef} autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} onBlur={(e) => { if (!e.relatedTarget) setTimeout(() => inputRef.current?.focus(), 0); }} disabled={busy} placeholder="Sẵn sàng nhận mã từ máy quét…" /> : <textarea id="ci-payload" value={input} onChange={(e) => setInput(e.target.value)} rows={5} placeholder="kid.payload.signature" disabled={busy} />}<button className="ci-primary" disabled={busy || !key || !input.trim()}>{busy ? 'Đang kiểm tra…' : 'Kiểm tra vé →'}</button></form>}<div className="ci-offline-info"><span>⌁</span><div><strong>Vẫn hoạt động khi mất mạng</strong><p>Lượt quét được lưu trên thiết bị trước khi gửi và tự đồng bộ khi kết nối trở lại.</p><p>Chống quét lặp trong 3 giây.</p></div></div></div><div className="ci-results">{busy && <div className="ci-processing" role="status">Đang kiểm tra vé…</div>}<Feedback result={result} /><div className="ci-guide warning"><b>!</b><div><strong>VÉ ĐÃ DÙNG HẾT LƯỢT</strong><p>Không cho vào khi vé đã dùng đủ lượt.</p></div></div><div className="ci-guide danger"><b>×</b><div><strong>VÉ KHÔNG HỢP LỆ</strong><p>Kiểm tra đúng sự kiện, thời gian và trạng thái vé.</p></div></div></div></div></section>
    <aside className="ci-history"><div className="ci-history-title"><h2>Lịch sử quét vé</h2><select aria-label="Lọc lịch sử" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Tất cả</option><option value="ACCEPTED">Cho vào</option><option value="rejected">Chưa cho vào</option><option value="pending">Chờ đồng bộ</option></select></div><div className="ci-sync"><span>{pending} lượt chờ đồng bộ</span><button onClick={sync} disabled={!online || syncing || !key}>{syncing ? 'Đang gửi…' : 'Đồng bộ'}</button></div><div className="ci-history-list">{!visible.length ? <div className="ci-history-empty"><span>◷</span><h3>Chưa có lượt quét</h3><p>Lịch sử trên thiết bị này sẽ xuất hiện tại đây.</p></div> : visible.slice(0, 100).map((row) => <button className={`ci-history-item ${row.idempotencyKey === result?.idempotencyKey ? 'selected' : ''}`} key={row.idempotencyKey} onClick={() => setResult(row)}><span className={`ci-history-icon ${outcomes[row.outcome]?.[2] || 'danger'}`}>{row.outcome === 'ACCEPTED' ? '✓' : '!'}</span><span className="ci-history-copy"><strong>{row.ticketId ? `Vé …${row.ticketId.slice(-8)}` : 'Mã vé không xác định'}</strong><small>{time(row.clientCheckinAt)} · {new Date(row.clientCheckinAt).toLocaleDateString('vi-VN')}</small><small>{row.pending ? '◷ Chờ đồng bộ' : 'Đã đối soát'}{row.entryNo && row.outcome === 'ACCEPTED' ? ` · Entry #${row.entryNo}` : ''}</small></span><span className={`ci-badge ${outcomes[row.outcome]?.[2] || 'danger'}`}>{row.outcome === 'ACCEPTED' ? 'Cho vào' : row.outcome === 'DUPLICATE' ? 'Hết lượt' : row.outcome === 'PENDING' ? 'Chờ' : 'Từ chối'}</span></button>)}</div><p className="ci-history-foot">Hiển thị tối đa 100 lượt gần nhất trên thiết bị này.</p></aside></div><footer className="ci-footer">EventHub Gate Check-in <span>Kiểm tra vé • Kết nối trải nghiệm</span></footer></div></div>;
}
