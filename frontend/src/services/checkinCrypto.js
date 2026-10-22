export const outcomes = {
  ACCEPTED: ['CHO VÀO', 'Vé hợp lệ', 'success'],
  DUPLICATE: ['VÉ ĐÃ DÙNG HẾT LƯỢT', 'Vé đã sử dụng hết số lượt vào cổng.', 'warning'],
  INVALID_SIGNATURE: ['TỪ CHỐI', 'Mã QR không đúng định dạng hoặc chữ ký không hợp lệ.', 'danger'],
  EXPIRED_WINDOW: ['TỪ CHỐI', 'Vé chưa đến giờ sử dụng hoặc đã hết hạn.', 'danger'],
  TICKET_VOIDED: ['TỪ CHỐI', 'Vé đã bị hủy, hoàn tiền hoặc chuyển nhượng.', 'danger'],
  WRONG_EVENT: ['TỪ CHỐI', 'Vé không thuộc sự kiện của thiết bị.', 'danger'],
  DEVICE_NOT_FOUND: ['TỪ CHỐI', 'API Key thiết bị không hợp lệ.', 'danger'],
  DEVICE_REVOKED: ['TỪ CHỐI', 'Thiết bị đã bị thu hồi quyền soát vé.', 'danger'],
  PENDING: ['CHỜ XÁC MINH', 'Chưa có chứng thư để kiểm tra chữ ký. Chưa cho khách vào.', 'warning'],
};
function bytes(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}
export async function fingerprint(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyOffline(payload, jwks, eventId = '', now = Date.now()) {
  try {
    const parts = payload.split('.');
    if (parts.length !== 3) return { outcome: 'INVALID_SIGNATURE' };
    const [kid, data, signature] = parts;
    const jwk = jwks?.keys?.find((key) => key.kid === kid && key.kty === 'RSA');
    if (!jwk) return { outcome: 'PENDING' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(signature), new TextEncoder().encode(data))) return { outcome: 'INVALID_SIGNATURE' };
    const claims = JSON.parse(new TextDecoder().decode(bytes(data)));
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (![claims.tid, claims.eid, claims.tt].every((v) => typeof v === 'string' && uuid.test(v)) || !Number.isFinite(claims.vf) || !Number.isFinite(claims.vu)) return { outcome: 'INVALID_SIGNATURE' };
    const result = { ticketId: claims.tid, eventId: claims.eid, ticketTypeId: claims.tt, maxEntries: Number.isInteger(claims.me) && claims.me > 0 ? claims.me : 1 };
    if (eventId && claims.eid !== eventId) return { ...result, outcome: 'WRONG_EVENT' };
    if (now / 1000 < claims.vf || Math.floor(now / 1000) > claims.vu) return { ...result, outcome: 'EXPIRED_WINDOW' };
    return { ...result, outcome: 'ACCEPTED' };
  } catch { return { outcome: 'INVALID_SIGNATURE' }; }
}
