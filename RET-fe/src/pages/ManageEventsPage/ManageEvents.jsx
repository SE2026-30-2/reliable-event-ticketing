import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import { manageEventService, managementError } from '../../services/manageEventService'
import './manage-events.css'

const emptyForm = { name: '', venue: '', description: '', startsAt: '', endsAt: '', bannerUrl: '' }
const tabs = [['ALL', 'Tất cả'], ['DRAFT', 'Đang nháp'], ['PUBLISHED', 'Đã xuất bản'], ['CANCELLED', 'Đã hủy']]
const number = new Intl.NumberFormat('vi-VN')
const previewEvents = [
  ['The Dreams Concert 2025', 'SVD Mỹ Đình, Hà Nội', 'PUBLISHED', '2025-10-25', '🎤', 12560, 15000],
  ['Viettel FC vs Hà Nội FC', 'SVD Hàng Đẫy, Hà Nội', 'PUBLISHED', '2025-10-26', '⚽', 8420, 12000],
  ['Tech Summit 2025', 'Trung tâm Hội nghị QG', 'DRAFT', '2025-10-28', '💻', 1250, 2000],
  ['Liên Hoan Phim Quốc Tế Hà Nội', 'CGV Vincom Phạm Ngọc Thạch', 'PUBLISHED', '2025-11-01', '🎬', 6800, 8000],
  ['Vũ. Live in Concert', 'Nhà hát Hòa Bình, TP.HCM', 'DRAFT', '2025-11-08', '🎙️', 3120, 5000],
  ['Hanoi Marathon 2025', 'Quận Hoàn Kiếm, Hà Nội', 'CANCELLED', '2025-11-16', '🏃', 0, 3000],
].map(([name, venue, status, date, art, sold, quota], i) => ({ eventId: `preview-${i}`, name, venue, status, startsAt: `${date}T12:00:00Z`, endsAt: `${date}T16:00:00Z`, art, sold, quota }))

function Icon({ name, ...props }) {
  const paths = {
    search: 'm21 21-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
    ticket: 'M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Zm8 0v3m0 3v4m0 3v3',
    image: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 14 6-6 4 4 3-3 5 5M8 7h.01',
    send: 'm22 2-7 20-4-9-9-4 20-7ZM11 13 22 2',
    plus: 'M12 5v14M5 12h14',
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.ticket} /></svg>
}

function localDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function ManageEvents({ preview = false }) {
  const { user, logout } = useAuth()
  const [events, setEvents] = useState(preview ? previewEvents : [])
  const [loading, setLoading] = useState(!preview)
  const [loadError, setLoadError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [stats, setStats] = useState({})
  const [tab, setTab] = useState('ALL')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('default')
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [imageFailed, setImageFailed] = useState(false)
  const nameInput = useRef(null)
  const formRef = useRef(null)
  const searchInput = useRef(null)
  const cancelDialog = useRef(null)

  useEffect(() => {
    if (preview) return
    const controller = new AbortController()
    manageEventService.list(controller.signal).then((data) => {
      setEvents(data)
      setLoadError('')
    }).catch((error) => {
      if (!controller.signal.aborted) setLoadError(managementError(error))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [preview, refresh])

  useEffect(() => {
    if (preview) return
    const controller = new AbortController()
    // Failed ticket statistics must not hide the event list or imply zero sales.
    Promise.all(events.map(async (event) => {
      try {
        const types = await manageEventService.ticketTypes(event.eventId, controller.signal)
        return [event.eventId, types.reduce((sum, type) => ({ sold: sum.sold + type.issuedCount, quota: sum.quota + type.quota }), { sold: 0, quota: 0 })]
      } catch { return [event.eventId, null] }
    })).then((entries) => { if (!controller.signal.aborted) setStats(Object.fromEntries(entries)) })
    return () => controller.abort()
  }, [events, preview])

  useEffect(() => {
    if (cancelTarget) cancelDialog.current?.showModal()
    else cancelDialog.current?.close()
  }, [cancelTarget])

  const visibleEvents = events.filter((event) => (tab === 'ALL' || event.status === tab) && `${event.name} ${event.venue || ''}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
  if (sort !== 'default') visibleEvents.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'vi') : new Date(a.startsAt) - new Date(b.startsAt))

  function openForm(event = null) {
    setEditing(event)
    setForm(event ? { name: event.name, venue: event.venue || '', description: event.description || '', bannerUrl: event.bannerUrl || '', startsAt: localDate(event.startsAt), endsAt: localDate(event.endsAt) } : emptyForm)
    setImageFailed(false)
    setNotice(null)
    nameInput.current?.focus()
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    if (event.target.name === 'bannerUrl') setImageFailed(false)
  }

  function replaceEvent(saved) {
    setEvents((current) => current.some((event) => event.eventId === saved.eventId) ? current.map((event) => event.eventId === saved.eventId ? saved : event) : [saved, ...current])
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const status = event.nativeEvent.submitter?.value || editing?.status || 'DRAFT'
    if (!form.name.trim() || !form.venue.trim() || !form.description.trim()) {
      setNotice({ error: true, text: 'Vui lòng nhập đầy đủ tên, mô tả và địa điểm sự kiện.' }); return
    }
    if (new Date(form.endsAt) <= new Date(form.startsAt)) {
      setNotice({ error: true, text: 'Thời gian kết thúc phải sau thời gian bắt đầu.' }); return
    }
    if (!editing && new Date(form.startsAt) <= new Date()) {
      setNotice({ error: true, text: 'Thời gian bắt đầu sự kiện mới phải ở tương lai.' }); return
    }
    if (form.bannerUrl && !/^https?:\/\//i.test(form.bannerUrl)) {
      setNotice({ error: true, text: 'Đường dẫn ảnh phải bắt đầu bằng http:// hoặc https://.' }); return
    }
    const body = { ...form, name: form.name.trim(), venue: form.venue.trim(), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() }
    if (!editing || editing.status !== status) body.status = status
    setBusy(true)
    setNotice(null)
    try {
      const saved = preview ? { ...editing, ...body, status, eventId: editing?.eventId || `preview-${Date.now()}` } : editing ? await manageEventService.update(editing.eventId, body) : await manageEventService.create(body)
      replaceEvent(saved)
      setEditing(null)
      setForm(emptyForm)
      setTab('ALL')
      setQuery('')
      setNotice({ text: `${preview ? 'Bản xem thử: ' : ''}${status === 'PUBLISHED' ? 'Đã lưu sự kiện đã xuất bản.' : 'Đã lưu bản nháp.'}` })
    } catch (error) { setNotice({ error: true, text: managementError(error) }) }
    finally { setBusy(false) }
  }

  async function cancelEvent() {
    if (!cancelTarget || busy) return
    setBusy(true)
    try {
      const saved = preview ? { ...cancelTarget, status: 'CANCELLED' } : await manageEventService.update(cancelTarget.eventId, { status: 'CANCELLED' })
      replaceEvent(saved)
      if (editing?.eventId === saved.eventId) { setEditing(null); setForm(emptyForm) }
      setCancelTarget(null)
      setNotice({ text: 'Đã hủy sự kiện.' })
    } catch (error) { setCancelTarget(null); setNotice({ error: true, text: managementError(error) }) }
    finally { setBusy(false) }
  }

  const canEdit = preview || (!loading && !loadError)
  return <div className="manage-page">
    <header className="manage-header">
      <Link className="manage-brand" to="/"><span><Icon name="ticket" /></span>EventHub</Link>
      <nav aria-label="Điều hướng chính"><Link to="/home">Trang chủ</Link><Link to="/home#events">Sự kiện</Link><Link to="/#features">Về chúng tôi</Link></nav>
      <div className="manage-account"><button type="button" className="manage-icon-button" aria-label="Tìm kiếm sự kiện" onClick={() => searchInput.current?.focus()}><Icon name="search" /></button>
        <details><summary><span className="manage-avatar">{(user?.name || user?.email || 'B').charAt(0).toUpperCase()}</span><span>Ban tổ chức</span><span aria-hidden="true">⌄</span></summary><div className="manage-account-menu"><span>{user?.email || 'Bản xem thử giao diện'}</span><Link to="/home">Trang chủ</Link>{!preview && <button type="button" onClick={logout}>Đăng xuất</button>}</div></details>
      </div>
    </header>
    {preview && <div className="manage-preview-note">Bản xem thử • Dữ liệu minh họa, thay đổi chỉ tồn tại trong phiên xem này.</div>}
    <div className="manage-grid">
      <section className="manage-main" aria-labelledby="manage-title">
        <div className="manage-intro"><p className="manage-eyebrow">QUẢN LÝ • TẠO MỚI • CHỈNH SỬA • THEO DÕI</p><h1 id="manage-title">Quản lý sự kiện</h1><div className="manage-intro-bottom"><p>Tạo, chỉnh sửa và theo dõi toàn bộ sự kiện của bạn.<br />Dễ dàng quản lý vé, doanh thu và người tham gia.</p><button type="button" className="manage-button primary" disabled={busy || !canEdit} onClick={() => openForm()}><Icon name="plus" />Tạo sự kiện mới</button></div></div>
        <div className="manage-list-panel">
          <div className="manage-tabs" aria-label="Lọc trạng thái">{tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label} ({key === 'ALL' ? events.length : events.filter((event) => event.status === key).length})</button>)}</div>
          <div className="manage-toolbar"><label className="manage-search"><Icon name="search" /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm sự kiện theo tên, địa điểm..." aria-label="Tìm kiếm theo tên hoặc địa điểm" /></label><select aria-label="Sắp xếp sự kiện" value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">Sắp xếp: Mặc định</option><option value="date">Ngày diễn ra: Gần nhất</option><option value="name">Tên: A – Z</option></select></div>
          {loading ? <div className="manage-empty" role="status">Đang tải sự kiện…</div> : loadError ? <div className="manage-empty" role="alert"><p>{loadError}</p><button className="manage-button secondary" type="button" onClick={() => { setLoading(true); setRefresh((value) => value + 1) }}>Thử lại</button><Link to="/login">Đăng nhập lại</Link></div> : !visibleEvents.length ? <div className="manage-empty"><Icon name="ticket" /><h2>{events.length ? 'Không tìm thấy sự kiện' : 'Sự kiện đầu tiên của bạn'}</h2><p>{events.length ? 'Thử tìm kiếm khác hoặc chọn trạng thái khác.' : 'Điền thông tin bên cạnh để bắt đầu tạo sự kiện.'}</p></div> : <ul className="manage-events">{visibleEvents.map((event, index) => {
            const count = preview ? event : stats[event.eventId]
            return <li key={event.eventId} className={editing?.eventId === event.eventId ? 'selected' : ''}>
              <div className={`manage-thumbnail art-${index % 6}`}>{event.bannerUrl ? <img src={event.bannerUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <span aria-hidden="true">{event.art || '♫'}</span>}</div>
              <div className="manage-event-info"><h2><Link to={`${preview ? '/manage/preview/events' : '/manage/events'}/${encodeURIComponent(event.eventId)}`}>{event.name}</Link></h2><p><time dateTime={event.startsAt}>{new Date(event.startsAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}</time><span className="manage-dot">•</span>{event.venue || 'Chưa có địa điểm'}</p><p className="manage-sales"><Icon name="ticket" />{count ? `${number.format(count.sold)} / ${number.format(count.quota)} vé đã bán` : 'Chưa tải được số liệu vé'}</p></div>
              <span className={`manage-status ${event.status.toLowerCase()}`}>{event.status}</span>
              {['DRAFT', 'PUBLISHED'].includes(event.status) && <details className="manage-row-menu"><summary aria-label={`Thao tác với ${event.name}`}>•••</summary><div><button type="button" disabled={busy} onClick={(e) => { e.currentTarget.closest('details').open = false; openForm(event) }}>Chỉnh sửa{event.status === 'DRAFT' ? ' / Xuất bản' : ''}</button><button type="button" className="danger" disabled={busy} onClick={(e) => { e.currentTarget.closest('details').open = false; setCancelTarget(event) }}>Hủy sự kiện</button></div></details>}
            </li>
          })}</ul>}
        </div>
      </section>
      <aside className="manage-form-panel" ref={formRef} aria-labelledby="event-form-title"><h2 id="event-form-title"><Icon name="ticket" />{editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}</h2><p className="manage-form-subtitle">Điền thông tin chi tiết để {editing ? 'cập nhật' : 'tạo'} sự kiện của bạn.</p>
        {notice && <div className={`manage-notice ${notice.error ? 'error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.text}</div>}
        <form onSubmit={submit}><fieldset disabled={busy || !canEdit}>
          <label className="manage-field">Tên sự kiện <b>*</b><input ref={nameInput} name="name" value={form.name} onChange={updateField} placeholder="Nhập tên sự kiện..." required maxLength={255} /></label>
          <label className="manage-field">Danh mục<select disabled aria-describedby="category-help"><option>♫ Chọn danh mục</option></select><small id="category-help">Danh mục sẽ được hỗ trợ sau.</small></label>
          <label className="manage-field">Mô tả sự kiện <b>*</b><textarea name="description" value={form.description} onChange={updateField} placeholder="Giới thiệu về sự kiện của bạn..." maxLength={1000} required rows={3} /><span className="manage-counter">{form.description.length}/1000</span></label>
          <label className="manage-field">Địa điểm <b>*</b><input name="venue" value={form.venue} onChange={updateField} placeholder="Nhập địa điểm tổ chức..." maxLength={255} required /></label>
          <div className="manage-field">Thời gian diễn ra <b>*</b><div className="manage-date-range"><label>Từ ngày<input aria-label="Ngày giờ bắt đầu" type="datetime-local" name="startsAt" value={form.startsAt} onChange={updateField} required /></label><span aria-hidden="true">→</span><label>Đến ngày<input aria-label="Ngày giờ kết thúc" type="datetime-local" name="endsAt" value={form.endsAt} min={form.startsAt} onChange={updateField} required /></label></div><small>Theo múi giờ thiết bị: {Intl.DateTimeFormat().resolvedOptions().timeZone}</small></div>
          <div className="manage-field">Thời gian mở bán vé<div className="manage-date-range unavailable"><span>▣ Từ ngày</span><span>→</span><span>Đến ngày</span></div><small>Lịch mở bán riêng sẽ được hỗ trợ sau.</small></div>
          <label className="manage-field">Ảnh bìa sự kiện<input name="bannerUrl" type="url" value={form.bannerUrl} onChange={updateField} placeholder="Dán đường dẫn ảnh https://..." maxLength={500} /><span className="manage-cover">{form.bannerUrl && /^https?:\/\//i.test(form.bannerUrl) && !imageFailed ? <img src={form.bannerUrl} alt="Xem trước ảnh bìa sự kiện" onError={() => setImageFailed(true)} /> : <><Icon name="image" /><span>{imageFailed ? 'Không tải được ảnh. Kiểm tra đường dẫn.' : 'Xem trước ảnh bìa sự kiện'}</span><small>Sử dụng đường dẫn ảnh JPG, PNG</small></>}</span></label>
          <div className="manage-form-actions">{!editing || editing.status === 'DRAFT' ? <><button className="manage-button secondary" type="submit" value="DRAFT">{busy ? 'Đang lưu…' : 'Lưu nháp'}</button><button className="manage-button primary" type="submit" value="PUBLISHED"><Icon name="send" />{busy ? 'Đang lưu…' : 'Xuất bản'}</button></> : <button className="manage-button primary" type="submit" value={editing.status}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>}</div>
          {editing && <button className="manage-reset" type="button" onClick={() => openForm()}>Bỏ chỉnh sửa</button>}
        </fieldset></form>
      </aside>
    </div>
    <dialog ref={cancelDialog} className="manage-dialog" onCancel={(event) => { event.preventDefault(); if (!busy) setCancelTarget(null) }} aria-labelledby="cancel-title"><h2 id="cancel-title">Hủy sự kiện?</h2><p>Bạn có chắc muốn hủy “{cancelTarget?.name}”? Sự kiện đã hủy không thể xuất bản lại.</p><div><button autoFocus type="button" className="manage-button secondary" disabled={busy} onClick={() => setCancelTarget(null)}>Quay lại</button><button type="button" className="manage-button destructive" disabled={busy} onClick={cancelEvent}>{busy ? 'Đang hủy…' : 'Hủy sự kiện'}</button></div></dialog>
  </div>
}
