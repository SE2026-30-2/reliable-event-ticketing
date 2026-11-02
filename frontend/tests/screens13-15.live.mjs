import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

// Explicit local integration run. Creates one QA event, cancels it and revokes its device afterwards.
const base = process.env.TICKETING_TEST_URL || 'http://localhost:8091';
const identity = process.env.IDENTITY_TEST_URL || 'http://localhost:8087';
const email = process.env.AUTH_TEST_EMAIL, password = process.env.AUTH_TEST_PASSWORD;
assert.ok(email && password, 'Set AUTH_TEST_EMAIL and AUTH_TEST_PASSWORD for a local ADMIN/ORGANIZER.');
const login = await fetch(`${identity}/api/user/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
assert.equal(login.status, 200, 'Login failed');
const { accessToken } = await login.json();
let event, device, issuedTicket;
async function call(path, { body, method = body ? 'POST' : 'GET', expected = 200, key, auth = true } = {}) {
  const form = body instanceof FormData;
  const response = await fetch(`${base}${path}`, { method, headers: { ...(auth ? { Authorization: `Bearer ${accessToken}` } : {}), ...(body && !form ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'X-Device-Key': key } : {}) }, ...(body ? { body: form ? body : JSON.stringify(body) } : {}) });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const iso = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();
function pngFixture() {
  const chunk = (name, data) => {
    const payload = Buffer.concat([Buffer.from(name), data]), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
    let crc = 0xffffffff;
    for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    length.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, payload, checksum]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 99, 70, 255]))), chunk('IEND', Buffer.alloc(0))]);
}
try {
  const form = new FormData();
  const bytes = pngFixture();
  form.append('file', new Blob([bytes], { type: 'image/png' }), 'banner.png');
  const image = await call('/api/manage/event-images', { body: form });
  const saved = await fetch(`${base}${image.url}`);
  assert.equal(saved.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await saved.arrayBuffer()), bytes);
  const invalid = new FormData(); invalid.append('file', new Blob(['bad'], { type: 'image/png' }), 'fake.png');
  await call('/api/manage/event-images', { body: invalid, expected: 400 });
  event = await call('/api/event', { expected: 201, body: { name: `QA screens 13-15 ${Date.now()}`, venue: 'Local QA', description: 'Integration fixture', category: 'SEMINAR', bannerUrl: `${base}${image.url}`, startsAt: iso(86400), endsAt: iso(90000), salesStartAt: iso(3600), salesEndAt: iso(7200), status: 'DRAFT' } });
  assert.equal((await call(`/api/event/${event.eventId}`)).category, 'SEMINAR');
  const type = await call(`/api/event/${event.eventId}/ticket-types`, { expected: 201, body: { name: 'QA', priceCents: 0, quota: 5, validFrom: iso(-3600), validUntil: iso(90000), maxEntries: 1, bundleSize: 1 } });
  await call(`/api/event/${event.eventId}`, { method: 'PATCH', body: { status: 'PUBLISHED' } });
  const reservationBody = { quantity: 1, holderName: 'QA Holder', holderEmail: email };
  await call(`/api/ticket-types/${type.ticketTypeId}/reservations`, { body: reservationBody, expected: 409 });
  await call(`/api/event/${event.eventId}`, { method: 'PATCH', body: { clearSalesSchedule: true } });
  const reservation = await call(`/api/ticket-types/${type.ticketTypeId}/reservations`, { body: reservationBody, expected: 201 });
  await call('/api/payment/requests', { body: { reservationId: reservation.reservationId }, expected: 201 });
  for (let i = 0; i < 30; i++) {
    issuedTicket = await call(`/api/ticket/${reservation.tickets[0].ticketId}`);
    if (issuedTicket.status === 'ISSUED') break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(issuedTicket.status, 'ISSUED');
  device = await call('/api/checkin/devices', { expected: 201, body: { label: 'QA screens 13-15', eventId: event.eventId } });
  const scan = { qrPayload: issuedTicket.qrPayload, idempotencyKey: crypto.randomUUID(), clientCheckinAt: iso(0) };
  const accepted = await call('/api/checkin', { auth: false, key: device.apiKey, body: scan });
  assert.equal(accepted.outcome, 'ACCEPTED'); assert.equal(accepted.holderName, 'QA Holder');
  assert.equal(accepted.eventName, event.name); assert.equal(accepted.ticketTypeName, 'QA');
  assert.equal(accepted.idempotencyKey, scan.idempotencyKey);
  const duplicate = await call('/api/checkin', { auth: false, key: device.apiKey, body: { ...scan, idempotencyKey: crypto.randomUUID() } });
  assert.equal(duplicate.outcome, 'DUPLICATE'); assert.ok(duplicate.firstCheckinAt);
  const replay = await call('/api/checkin/batch', { auth: false, key: device.apiKey, body: [scan] });
  assert.equal(replay[0].entryNo, 1);
  const rejected = await call('/api/checkin', { auth: false, key: 'invalid', body: { ...scan, idempotencyKey: crypto.randomUUID() } });
  assert.equal(rejected.holderName, null);
  await call(`/api/event/${event.eventId}/views`, { auth: false, method: 'POST', expected: 204 });
  await call(`/api/event/${event.eventId}/views`, { auth: false, method: 'POST', expected: 204 });
  const analytics = await call(`/api/manage/events/${event.eventId}/analytics?days=7&timezone=Asia%2FHo_Chi_Minh`);
  assert.equal(analytics.views, 2); assert.equal(analytics.daily.length, 7);
  assert.equal(analytics.daily.reduce((n, d) => n + d.ticketsSold, 0), 1);
  const report = await call(`/api/manage/events/${event.eventId}/report`);
  assert.equal(report.totals.checkedIn, 1);
  console.log('PASS: image validation/storage, event persistence, sales enforcement, ticket issuance, scan metadata/idempotency/batch, analytics and report');
} finally {
  if (issuedTicket?.status === 'ISSUED') await call(`/api/ticket/${issuedTicket.ticketId}/status`, { method: 'PATCH', body: { status: 'VOID', reason: 'QA cleanup' } });
  if (device) await call(`/api/checkin/devices/${device.deviceId}/revoke`, { method: 'PATCH' });
  if (event) await call(`/api/event/${event.eventId}`, { method: 'PATCH', body: { status: 'CANCELLED' } });
}
