import { fingerprint, verifyOffline } from './checkinCrypto';
import { readScans, readSetting, saveScan, saveSetting } from './checkinStore';

const base = (import.meta.env.VITE_TICKETING_SERVICE_URL || 'http://localhost:8091').replace(/\/$/, '');
async function request(path, key, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json', 'X-Device-Key': key } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Máy chủ trả lỗi ${response.status}. Lượt quét được giữ lại để thử lại.`);
  return response.json();
}
// One lock for scanning and flushing, shared across tabs on this browser.
const locked = (run) => navigator.locks ? navigator.locks.request('eventhub-checkin', run) : Promise.reject(new Error('Trình duyệt cần hỗ trợ Web Locks để soát vé an toàn. Hãy dùng Chrome, Edge hoặc Safari mới.'));
const bodyOf = ({ qrPayload, idempotencyKey, clientCheckinAt }) => ({ qrPayload, idempotencyKey, clientCheckinAt });
function confirmed(scan, response) {
  const outcomes = ['ACCEPTED', 'DUPLICATE', 'INVALID_SIGNATURE', 'WRONG_EVENT', 'EXPIRED_WINDOW', 'TICKET_VOIDED', 'DEVICE_NOT_FOUND', 'DEVICE_REVOKED'];
  if (!response || !outcomes.includes(response.outcome) || !Number.isFinite(Date.parse(response.serverReceivedAt)) ||
      (response.outcome === 'ACCEPTED' && (!response.ticketId || !Number.isInteger(response.entryNo) || response.entryNo < 1)) ||
      (scan.ticketId && response.ticketId && scan.ticketId !== response.ticketId) ||
      (response.idempotencyKey && response.idempotencyKey !== scan.idempotencyKey)) {
    throw new Error('Phản hồi soát vé không hợp lệ. Lượt quét vẫn được giữ để thử lại.');
  }
  return { ...scan, ticketId: response.ticketId, outcome: response.outcome, detail: response.detail, entryNo: response.entryNo, serverReceivedAt: response.serverReceivedAt, pending: false, localOutcome: scan.outcome, qrPayload: undefined,
    eventName: response.eventName, holderName: response.holderName, ticketTypeName: response.ticketTypeName, firstCheckinAt: response.firstCheckinAt };
}
export async function refreshCertificate() {
  const jwks = await request('/.well-known/jwks.json');
  if (!jwks.keys?.some((key) => key.kty === 'RSA')) throw new Error('Máy chủ chưa cung cấp chứng thư RSA.');
  const cached = { jwks, updatedAt: new Date().toISOString() };
  await saveSetting('certificate', cached);
  return cached;
}
export const getCertificate = () => readSetting('certificate');
export async function historyFor(key) {
  const device = await fingerprint(key);
  return (await readScans()).filter((s) => s.device === device).sort((a, b) => b.clientCheckinAt.localeCompare(a.clientCheckinAt));
}
export function submitScan(key, payload, eventId) {
  return locked(async () => {
    const device = await fingerprint(key);
    const certificate = await getCertificate();
    const verification = await verifyOffline(payload, certificate?.jwks, eventId);
    const previous = await readScans();
    const used = previous.filter((s) => s.ticketId === verification.ticketId && s.outcome === 'ACCEPTED');
    const count = Math.max(0, ...used.filter((s) => !s.pending).map((s) => s.entryNo || 1)) + used.filter((s) => s.pending).length;
    if (verification.outcome === 'ACCEPTED') {
      verification.outcome = count >= verification.maxEntries ? 'DUPLICATE' : 'ACCEPTED';
      verification.entryNo = count + 1;
      if (previous.some((s) => !s.pending && s.ticketId === verification.ticketId && s.outcome === 'DUPLICATE')) verification.outcome = 'DUPLICATE';
    }
    if (previous.some((s) => !s.pending && s.ticketId === verification.ticketId && s.outcome === 'TICKET_VOIDED')) verification.outcome = 'TICKET_VOIDED';
    const lastDeviceResult = previous.filter((s) => s.device === device && !s.pending).sort((a, b) => b.clientCheckinAt.localeCompare(a.clientCheckinAt))[0];
    if (['DEVICE_NOT_FOUND', 'DEVICE_REVOKED'].includes(lastDeviceResult?.outcome)) verification.outcome = lastDeviceResult.outcome;
    let scan = { ...verification, device, qrPayload: payload, idempotencyKey: crypto.randomUUID(), clientCheckinAt: new Date().toISOString(), pending: true };
    // Persist before making a network request, including invalid attempts.
    await saveScan(scan);
    let accepted;
    if (navigator.onLine) {
      try {
        accepted = confirmed(scan, await request('/api/checkin', key, bodyOf(scan)));
      } catch (error) { scan.networkError = error.message; }
    }
    // A storage failure is not a network error: keep the durable pending attempt and surface it.
    if (accepted) { await saveScan(accepted); return accepted; }
    return scan;
  });
}
export function syncScans(key) {
  return locked(async () => {
    const pending = (await historyFor(key)).filter((s) => s.pending).reverse();
    let total = 0;
    for (let i = 0; i < pending.length; i += 100) {
      const batch = pending.slice(i, i + 100);
      const responses = await request('/api/checkin/batch', key, batch.map(bodyOf));
      if (!Array.isArray(responses) || responses.length !== batch.length) throw new Error('Phản hồi đồng bộ không đầy đủ; giữ lại hàng đợi.');
      const verified = batch.map((scan, index) => confirmed(scan, responses[index]));
      for (const scan of verified) await saveScan(scan);
      total += batch.length;
    }
    return total;
  });
}
