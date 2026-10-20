export const number = (value) => new Intl.NumberFormat('vi-VN').format(value ?? 0);
export const money = (cents) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format((cents ?? 0) / 100);
export const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function toCents(value) {
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  if (!String(value).trim() || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents)) throw new Error('Số tiền VNĐ không hợp lệ.');
  return cents;
}
export function dateRange(from, until) {
  const start = new Date(from), end = new Date(until);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.');
  return [start.toISOString(), end.toISOString()];
}
export function parseGuests(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 200) throw new Error('Nhập từ 1 đến 200 khách, mỗi dòng: Họ tên, email.');
  return lines.map((line, index) => {
    const split = line.lastIndexOf(',');
    const name = line.slice(0, split).trim(), email = line.slice(split + 1).trim();
    if (split < 1 || !name || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email)) throw new Error(`Dòng ${index + 1} không hợp lệ. Dùng định dạng: Họ tên, email.`);
    return { name, email };
  });
}
export function requiredText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`Vui lòng nhập ${label}.`);
  return text;
}
export async function downloadCsv(api, id, kind) {
  const blob = await api.exportCsv(id, kind);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${kind}-${id}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
