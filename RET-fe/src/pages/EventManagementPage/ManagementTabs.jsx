import { useEffect, useRef, useState } from 'react';
import { ActionForm, Badge, Dialog, Field, Message, Panel, ResourceState, Stat, Table } from './managementUi';
import { useResource } from './useResource';
import { dateRange, dateTime, downloadCsv, localDate, money, number, parseGuests, requiredText, toCents } from './eventManagementUtils';
import { managementError } from '../../services/manageEventService';

function TypeSelect({ types, optional = false }) {
  return <Field label="Loại vé áp dụng"><select name="ticketTypeId" required={!optional} defaultValue=""><option value="">{optional ? 'Tất cả loại vé' : 'Chọn loại vé'}</option>{types.map((t) => <option key={t.ticketTypeId} value={t.ticketTypeId}>{t.name}</option>)}</select></Field>;
}
function DateFields({ from, until, required = true }) {
  return <div className="em-form-grid"><Field label="Từ ngày, giờ" name="validFrom" type="datetime-local" defaultValue={localDate(from)} required={required} /><Field label="Đến ngày, giờ" name="validUntil" type="datetime-local" defaultValue={localDate(until)} required={required} /></div>;
}
export function TicketTypes({ api, event, changed }) {
  const [refresh, setRefresh] = useState(0), [creating, setCreating] = useState(false);
  const resource = useResource(api.ticketTypes, [event.eventId], refresh);
  async function create(form) {
    const [validFrom, validUntil] = dateRange(form.validFrom, form.validUntil);
    return api.createTicketType(event.eventId, { name: requiredText(form.name, 'tên loại vé'), priceCents: toCents(form.price), quota: Number(form.quota), maxEntries: Number(form.maxEntries), bundleSize: Number(form.bundleSize), validFrom, validUntil });
  }
  return <Panel title="Loại vé" action={<button className="primary" disabled={event.status === 'CANCELLED'} onClick={() => setCreating(true)}>+ Tạo loại vé</button>}>
    <p className="em-muted">Giá theo đơn vị bán. Vé gói phát hành nhiều vé cho mỗi đơn vị; khung giờ bên dưới là thời gian check-in.</p>
    <ResourceState resource={resource} retry={() => setRefresh((n) => n + 1)} />
    {resource.data && <Table headers={['Tên loại vé', 'Giá / đơn vị', 'Quota', 'Đã phát hành', 'Còn lại', 'Lượt vào / vé', 'Vé / gói', 'Khung check-in']} rows={resource.data.map((t) => ({ key: t.ticketTypeId, cells: [<strong>{t.name}</strong>, money(t.priceCents), number(t.quota), number(t.issuedCount), number(t.remaining), t.maxEntries, t.bundleSize, <>{dateTime(t.validFrom)}<br />{dateTime(t.validUntil)}</>] }))} empty="Chưa có loại vé. Tạo loại vé đầu tiên để bắt đầu mở bán." />}
    {creating && <Dialog title="Tạo loại vé mới" close={() => setCreating(false)}><ActionForm submit={create} complete={() => changed('Đã tạo loại vé.')} cancel={() => setCreating(false)} label="Tạo loại vé"><Field label="Tên loại vé" name="name" required maxLength={255} /><div className="em-form-grid"><Field label="Giá (VNĐ / đơn vị)" name="price" type="number" min="0" step="1" required /><Field label="Quota (tổng số vé)" name="quota" type="number" min="1" step="1" required /><Field label="Số lượt vào / vé" name="maxEntries" type="number" min="1" max="50" defaultValue="1" required /><Field label="Số vé / gói" name="bundleSize" type="number" min="1" max="20" defaultValue="1" required /></div><DateFields from={event.startsAt} until={event.endsAt} /><p className="em-muted">Thời gian theo múi giờ thiết bị. Vé miễn phí có giá 0 VNĐ.</p></ActionForm></Dialog>}
  </Panel>;
}

export function Coupons({ api, event, changed, types }) {
  const [refresh, setRefresh] = useState(0), [creating, setCreating] = useState(false), [discountType, setDiscountType] = useState('PERCENT');
  const resource = useResource(api.coupons, [event.eventId], refresh);
  async function create(form) {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error('Mã gồm 3–40 ký tự A–Z, 0–9, _ hoặc -.');
    const body = { code, type: form.type, value: form.type === 'FIXED' ? toCents(form.value) : Number(form.value) };
    if (form.ticketTypeId) body.ticketTypeId = form.ticketTypeId;
    if (form.maxRedemptions) body.maxRedemptions = Number(form.maxRedemptions);
    if (form.validFrom) body.validFrom = new Date(form.validFrom).toISOString();
    if (form.validUntil) body.validUntil = new Date(form.validUntil).toISOString();
    if (form.validFrom && form.validUntil) dateRange(form.validFrom, form.validUntil);
    return api.createCoupon(event.eventId, body);
  }
  return <Panel title="Mã giảm giá" action={<button className="primary" disabled={event.status === 'CANCELLED'} onClick={() => setCreating(true)}>+ Tạo mã giảm giá</button>}><ResourceState resource={resource} retry={() => setRefresh((n) => n + 1)} />
    {resource.data && <Table headers={['Mã', 'Giảm giá', 'Đã dùng / giới hạn', 'Loại vé', 'Hiệu lực', 'Trạng thái', 'Thao tác']} rows={resource.data.map((c) => ({ key: c.couponId, cells: [<span className="em-code">{c.code}</span>, c.type === 'PERCENT' ? `${c.value}%` : money(c.value), `${number(c.redeemedCount)} / ${c.maxRedemptions ?? 'Không giới hạn'}`, c.ticketTypeId ? types.find((t) => t.ticketTypeId === c.ticketTypeId)?.name || c.ticketTypeId : 'Tất cả', <>{dateTime(c.validFrom)}<br />{dateTime(c.validUntil)}</>, c.active ? 'Đang bật' : 'Đang tắt', <ActionForm submit={() => api.setCouponActive(event.eventId, c.couponId, !c.active)} complete={() => changed(`Đã ${c.active ? 'tắt' : 'bật'} mã ${c.code}.`)} label={c.active ? 'Tắt' : 'Bật'} />] }))} empty="Chưa có mã giảm giá." />}
    {creating && <Dialog title="Tạo mã giảm giá" close={() => setCreating(false)}><ActionForm submit={create} complete={() => changed('Đã tạo mã giảm giá.')} cancel={() => setCreating(false)} label="Tạo mã"><Field label="Mã giảm giá" name="code" required minLength={3} maxLength={40} placeholder="VD: DREAMS20" /><div className="em-form-grid"><Field label="Hình thức"><select name="type" value={discountType} onChange={(e) => setDiscountType(e.target.value)}><option value="PERCENT">Phần trăm (%)</option><option value="FIXED">Số tiền (VNĐ)</option></select></Field><Field label={discountType === 'PERCENT' ? 'Giá trị giảm (%)' : 'Giá trị giảm (VNĐ / đơn vị vé)'} name="value" type="number" min="1" max={discountType === 'PERCENT' ? 100 : undefined} step="1" required /></div><TypeSelect types={types} optional /><Field label="Giới hạn lượt dùng (để trống = không giới hạn)" name="maxRedemptions" type="number" min="1" step="1" /><DateFields required={false} /></ActionForm></Dialog>}
  </Panel>;
}

export function Guests({ api, event, changed, types }) {
  const [outcome, setOutcome] = useState(null);
  async function issue(form) {
    const guests = parseGuests(form.guests);
    setOutcome(null);
    try {
      const result = await api.inviteGuests(event.eventId, { ticketTypeId: form.ticketTypeId, guests });
      setOutcome({ success: result.length, failed: 0 });
      return result;
    } catch (error) {
      // Network/5xx failures may occur after issuance; do not claim that zero tickets were issued.
      const definitive = [400, 403, 404, 409, 422, 429].includes(error.response?.status);
      setOutcome(definitive ? { success: 0, failed: guests.length } : { uncertain: true });
      throw error;
    }
  }
  const unavailable = !types.length || event.status === 'CANCELLED' || new Date(event.endsAt) <= new Date();
  return <Panel title="Phát vé mời"><p className="em-muted">Mỗi dòng gồm họ tên và email, phân cách bằng dấu phẩy. Tối đa 200 khách. Vé mời trừ quota; hệ thống gửi email cho khách sau khi phát hành.</p>
    {outcome && <Message error={Boolean(outcome.failed || outcome.uncertain)}>{outcome.uncertain ? 'Chưa xác nhận được kết quả phát vé. Kiểm tra danh sách vé trước khi thử lại để tránh phát trùng.' : `Thành công: ${outcome.success} vé · Thất bại: ${outcome.failed} vé.`}</Message>}
    {unavailable ? <Message>Chỉ phát vé mời khi sự kiện chưa kết thúc, chưa bị hủy và đã có loại vé.</Message> : <ActionForm submit={issue} label="Phát vé mời" resetOnSuccess><TypeSelect types={types} /><Field label="Danh sách khách mời"><textarea name="guests" required rows={9} placeholder={'Nguyễn Minh Anh, anh@example.com\nTrần Hoàng Nam, nam@example.com'} /></Field><p className="em-muted">Cả danh sách được xử lý cùng nhau. Nếu không đủ quota, không vé nào trong yêu cầu được phát hành.</p></ActionForm>}
    {outcome?.success > 0 && <button className="em-refresh-link" onClick={() => changed('Đã cập nhật số lượng vé sau khi phát vé mời.')}>Cập nhật số liệu sự kiện</button>}
  </Panel>;
}

export function Devices({ api, event, changed }) {
  const [refresh, setRefresh] = useState(0), [secret, setSecret] = useState(null), [target, setTarget] = useState(null), [copyState, setCopyState] = useState('');
  const resource = useResource(api.devices, [event.eventId], refresh);
  async function copy() {
    try { await navigator.clipboard.writeText(secret); setCopyState('Đã sao chép API Key.'); }
    catch { setCopyState('Không thể sao chép tự động. Hãy chọn và sao chép khóa bên dưới.'); }
  }
  return <div className="em-split"><Panel title="Thiết bị soát vé"><ResourceState resource={resource} retry={() => setRefresh((n) => n + 1)} />{resource.data && <Table headers={['Thiết bị', 'Trạng thái', 'Hoạt động lần cuối', 'Thao tác']} rows={resource.data.map((d) => ({ key: d.deviceId, cells: [<><strong>{d.label}</strong><small>{d.deviceId}</small></>, <Badge status={d.status} />, dateTime(d.lastSeenAt), d.status === 'ACTIVE' ? <button className="danger-text" onClick={() => setTarget(d)}>Thu hồi</button> : '—'] }))} empty="Chưa có thiết bị cho sự kiện này." />}</Panel>
    <Panel title="Đăng ký thiết bị"><ActionForm submit={(form) => api.createDevice(event.eventId, requiredText(form.label, 'tên thiết bị'))} complete={(device) => { setSecret(device.apiKey); setCopyState(''); setRefresh((n) => n + 1); }} label="Tạo thiết bị"><Field label="Tên thiết bị" name="label" required maxLength={255} placeholder="VD: Cổng A · Máy 01" /><p className="em-muted">Thiết bị chỉ được soát vé cho sự kiện này. Khóa truy cập chỉ hiển thị một lần sau khi tạo.</p></ActionForm></Panel>
    {secret && <Dialog title="Lưu khóa thiết bị" close={() => setSecret(null)}><Message>API Key chỉ hiển thị trong lần này. Hãy lưu ở nơi an toàn trước khi đóng.</Message><code className="em-secret">{secret}</code><div className="em-form-actions"><button onClick={copy}>Copy API Key</button><button className="primary" onClick={() => setSecret(null)}>Đã lưu, đóng</button></div>{copyState && <Message>{copyState}</Message>}</Dialog>}
    {target && <Dialog title="Thu hồi thiết bị?" close={() => setTarget(null)}><ActionForm submit={() => api.revokeDevice(target.deviceId)} complete={() => changed('Đã thu hồi thiết bị.')} cancel={() => setTarget(null)} label="Xác nhận thu hồi" danger><p>Thiết bị <strong>{target.label}</strong> sẽ không thể soát vé. Thao tác này không thể khôi phục.</p></ActionForm></Dialog>}
  </div>;
}

export function Tickets({ api, event, types }) {
  const [page, setPage] = useState(0), [refresh, setRefresh] = useState(0), [target, setTarget] = useState(null), [notice, setNotice] = useState('');
  const resource = useResource(api.tickets, [event.eventId, page], refresh);
  return <Panel title="Danh sách vé" action={<span className="em-muted">{resource.data ? `${number(resource.data.totalElements)} vé` : ''}</span>}>
    {notice && <Message>{notice}</Message>}<ResourceState resource={resource} retry={() => setRefresh((n) => n + 1)} />
    {resource.data && <><Table headers={['Mã vé', 'Người sở hữu / giữ vé', 'Loại vé', 'Trạng thái', 'Phát hành', 'Thao tác']} rows={resource.data.content.map((t) => ({ key: t.ticketId, cells: [<code>{t.ticketId}</code>, <><strong>{t.holderName || '—'}</strong><small>{t.holderEmail}</small><small>Chủ: {t.ownerEmail || 'Vé mời'}</small></>, types.find((type) => type.ticketTypeId === t.ticketTypeId)?.name || t.ticketTypeId, <Badge status={t.status} />, dateTime(t.issuedAt), t.status === 'ISSUED' ? <div className="em-row-actions"><button onClick={() => setTarget({ ...t, nextStatus: 'VOID' })}>Hủy vé</button><button onClick={() => setTarget({ ...t, nextStatus: 'REFUNDED' })}>Hoàn tiền</button></div> : '—'] }))} empty="Chưa có vé nào trong sự kiện." /><div className="em-pagination"><button disabled={page === 0} onClick={() => setPage((n) => n - 1)}>← Trước</button><span>Trang {page + 1} / {Math.max(1, resource.data.totalPages)}</span><button disabled={page + 1 >= resource.data.totalPages} onClick={() => setPage((n) => n + 1)}>Sau →</button></div></>}
    {target && <Dialog title={target.nextStatus === 'VOID' ? 'Hủy vé?' : 'Xác nhận trạng thái hoàn tiền'} close={() => setTarget(null)}><ActionForm submit={(form) => api.updateTicketStatus(target.ticketId, { status: target.nextStatus, reason: requiredText(form.reason, 'lý do') })} complete={() => { setNotice('Đã cập nhật trạng thái vé.'); setTarget(null); setRefresh((n) => n + 1); }} cancel={() => setTarget(null)} label="Xác nhận" danger><p>Vé của <strong>{target.holderName}</strong> sẽ không còn hợp lệ để vào cổng.</p>{target.nextStatus === 'REFUNDED' && <Message>Thao tác này cập nhật trạng thái vé REFUNDED; không thực hiện giao dịch hoàn tiền qua VNPay. Hoàn tiền thanh toán cần xử lý tại màn quản trị thanh toán.</Message>}<Field label="Lý do"><textarea name="reason" rows={3} required maxLength={1000} /></Field></ActionForm></Dialog>}
  </Panel>;
}

export function Timeline({ points }) {
  if (!points.length) return <div className="em-empty">Chưa có lượt check-in.</div>;
  const width = 720, height = 190, max = Math.max(1, ...points.flatMap((p) => [p.accepted, p.duplicate, p.rejected]));
  const x = (i) => 42 + i * (width - 66) / Math.max(1, points.length - 1);
  const y = (n) => height - 25 - n / max * (height - 50);
  return <><div className="em-chart-legend"><span>● Hợp lệ</span><span>● Quét trùng</span><span>● Từ chối</span></div><svg className="em-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ lượt check-in theo khoảng 15 phút">{[0, .25, .5, .75, 1].map((f) => <g key={f}><line x1="42" x2="700" y1={y(f * max)} y2={y(f * max)} stroke="#edf0fa" /><text x="4" y={y(f * max) + 4}>{Math.round(f * max)}</text></g>)}{['accepted', 'duplicate', 'rejected'].map((key, series) => <g key={key} stroke={['#6346ff', '#8da5ff', '#f07e9b'][series]}><polyline fill="none" strokeWidth="2.5" points={points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ')} />{points.map((p, i) => <circle key={p.bucketStart} cx={x(i)} cy={y(p[key])} r="3" fill="white"><title>{dateTime(p.bucketStart)}: {p[key]} {key}</title></circle>)}</g>)}{points.map((p, i) => (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0) && <text key={p.bucketStart} x={x(i)} y={height - 3} textAnchor="middle">{new Date(p.bucketStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</text>)}</svg><details className="em-chart-data"><summary>Xem dữ liệu biểu đồ</summary><Table headers={['Khoảng thời gian', 'Hợp lệ', 'Trùng', 'Từ chối']} rows={points.map((p) => ({ key: p.bucketStart, cells: [dateTime(p.bucketStart), p.accepted, p.duplicate, p.rejected] }))} /></details></>;
}

export function Live({ api, event }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [updated, setUpdated] = useState(null);
  const refreshNow = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer, busy = false;
    const load = async () => {
      if (busy || controller.signal.aborted) return;
      busy = true; clearTimeout(timer);
      try {
        const result = await api.live(event.eventId, controller.signal);
        if (!controller.signal.aborted) { setData(result); setError(''); setUpdated(new Date()); }
      } catch (failure) { if (!controller.signal.aborted) setError(managementError(failure)); }
      finally { busy = false; if (!controller.signal.aborted) timer = setTimeout(load, 5000); }
    };
    refreshNow.current = load;
    void load();
    return () => { controller.abort(); clearTimeout(timer); refreshNow.current = null; };
  }, [api, event.eventId]);
  const stats = data?.stats;
  // acceptedCount counts entries, not distinct attendees; multi-entry tickets can exceed 100%.
  const ratio = stats?.totalIssued ? Math.round(stats.acceptedCount / stats.totalIssued * 100) : null;
  return <><div className="em-live-heading"><p><span className="em-live-dot" />Tự động cập nhật mỗi 5 giây {updated && `· Lần cuối ${updated.toLocaleTimeString('vi-VN')}`}</p><button onClick={() => refreshNow.current?.()}>Làm mới</button></div>{error && <Message error>{error}{data && ' Đang hiển thị số liệu từ lần cập nhật thành công gần nhất.'}</Message>}{!data && !error && <div className="em-empty" role="status">Đang tải check-in…</div>}{stats && <><div className="em-stats"><Stat icon="users" label="Lượt vào / vé hợp lệ" value={ratio === null ? '—' : `${ratio}%`} note={`${number(stats.acceptedCount)} lượt / ${number(stats.totalIssued)} vé`} /><Stat icon="ticket" label="Lượt quét trùng" value={number(stats.duplicateCount)} /><Stat icon="device" label="Từ chối do thiết bị" value={number(stats.deviceRejectedCount)} /><Stat icon="live" label="Lượt quét vé lỗi" value={number(stats.invalidCount)} /></div><p className="em-muted">Một vé có thể vào nhiều lượt; tỷ lệ lượt vào có thể vượt 100%. Số khách đã check-in riêng biệt nằm ở Tổng quan.</p><Panel title="Lưu lượng check-in" action={<span className="em-muted">Mỗi khoảng 15 phút</span>}><Timeline points={data.timeline} /></Panel></>}</>;
}

export function Reports({ api, event, report }) {
  return <><div className="em-stats three"><Stat icon="money" label="Doanh thu thuần" value={money(report.totals.netRevenueCents)} /><Stat icon="money" label="Tiền đã hoàn" value={money(report.totals.refundedCents)} /><Stat icon="coupon" label="Giá trị giảm giá coupon" value={money(report.totals.couponDiscountCents)} /></div><Panel title="Doanh thu theo loại vé" action={<span className="em-muted">Cập nhật: {dateTime(report.generatedAt)}</span>}><Table headers={['Loại vé', 'Giá / đơn vị', 'Quota', 'Phát hành', 'Giữ chỗ', 'Còn lại', 'Vé mời', 'Check-in', 'Hoàn / Hủy', 'Tiền thu']} rows={report.ticketTypes.map((t) => ({ key: t.ticketTypeId, cells: [t.name, money(t.priceCents), number(t.quota), number(t.issued), number(t.reserved), number(t.remaining), number(t.guests), number(t.checkedIn), `${t.refunded} / ${t.voided}`, money(t.revenueCents)] }))} /></Panel><Panel title="Xuất báo cáo"><p className="em-muted">CSV chứa dữ liệu toàn sự kiện. Tiền trong file xuất sử dụng đơn vị cents theo báo cáo gốc.</p><div className="em-export-actions"><ActionForm submit={() => downloadCsv(api, event.eventId, 'attendees')} label="Tải attendees.csv" /><ActionForm submit={() => downloadCsv(api, event.eventId, 'payments')} label="Tải payments.csv" /></div></Panel></>;
}
