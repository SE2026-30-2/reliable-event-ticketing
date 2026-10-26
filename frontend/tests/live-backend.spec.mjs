import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// Explicit opt-in: these tests create isolated QA fixtures on a local backend.
const enabled = process.env.RUN_LIVE_TESTS === '1';
let prefix = `QA-${Date.now()}`;
let password = `QaLocal!${Date.now()}`;
const adminEmail = process.env.AUTH_TEST_EMAIL;
const adminPassword = process.env.AUTH_TEST_PASSWORD;
let admin, organizer, buyer, event, freeType, paidType, guestTicket, device;
const extraEvents = [], extraDevices = [], extraUsers = [], findings = [];
const cachePath = 'tmp/live-fixtures.private.json';
function persist() {
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ prefix, password, admin, organizer, buyer, event, freeType, paidType, guestTicket, device, extraEvents, extraDevices, extraUsers }));
}

async function call(request, path, { token, body, method = 'GET', port = 8091 } = {}) {
  const response = await request.fetch(`http://localhost:${port}${path}`, {
    method, headers: token ? { Authorization: `Bearer ${token}` } : {}, ...(body === undefined ? {} : { data: body }),
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { response, data, status: response.status() };
}
async function required(request, path, options) {
  const result = await call(request, path, options);
  expect(result.status, `${options?.method || 'GET'} ${path}: ${JSON.stringify(result.data)}`).toBeLessThan(300);
  return result.data;
}
async function loginApi(request, email, pass) {
  const tokens = await required(request, '/api/user/login', { port: 8087, method: 'POST', body: { email, password: pass } });
  const user = await required(request, '/api/user/me', { port: 8087, token: tokens.accessToken });
  return { ...tokens, user };
}
async function session(page, account) {
  await page.addInitScript(({ user, accessToken, refreshToken }) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }, account);
}
async function loginUi(page, email, pass) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(pass);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
const tab = (page, name) => page.getByRole('navigation', { name: 'Các mục quản trị sự kiện' }).getByRole('button', { name, exact: true }).click();

test.beforeAll(async ({ request }) => {
  test.skip(!enabled || !adminEmail || !adminPassword, 'Set RUN_LIVE_TESTS=1 and local admin credentials.');
  if (fs.existsSync(cachePath)) {
    const saved = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    ({ prefix, password, admin, organizer, buyer, event, freeType, paidType, guestTicket, device } = saved);
    extraEvents.push(...saved.extraEvents); extraDevices.push(...saved.extraDevices);
    extraUsers.push(...(saved.extraUsers || []));
    return;
  }
  admin = await loginApi(request, adminEmail, adminPassword);
  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/live-findings.json', '[]');
  expect(admin.user.roles).toContain('ADMIN');
  for (const role of ['buyer', 'organizer']) {
    const email = `${prefix.toLowerCase()}-${role}@example.test`;
    await required(request, '/api/user/register', { port: 8087, method: 'POST', body: { email, password, fullName: `${prefix} ${role}` } });
    let account = await loginApi(request, email, password);
    if (role === 'organizer') {
      await required(request, `/api/user/admin/users/${account.user.id}/roles`, { port: 8087, method: 'PATCH', token: admin.accessToken, body: { roles: ['USER', 'ORGANIZER'] } });
      account = await loginApi(request, email, password); organizer = account;
    } else buyer = account;
  }
  event = await required(request, '/api/event', { token: organizer.accessToken, method: 'POST', body: {
    name: `${prefix} integration`, venue: 'QA local test venue', description: 'Isolated test data; safe to cancel after QA.',
    startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 172800000).toISOString(), status: 'PUBLISHED',
  } });
  for (const price of [0, 5000000]) {
    const type = await required(request, `/api/event/${event.eventId}/ticket-types`, { token: organizer.accessToken, method: 'POST', body: {
      name: price ? `${prefix} Paid` : `${prefix} Free`, priceCents: price, quota: 20,
      validFrom: new Date(Date.now() - 600000).toISOString(), validUntil: new Date(Date.now() + 172800000).toISOString(), maxEntries: 1, bundleSize: 1,
    } });
    if (price) paidType = type; else freeType = type;
  }
  const guests = await required(request, `/api/manage/events/${event.eventId}/guests`, { token: organizer.accessToken, method: 'POST', body: { ticketTypeId: freeType.ticketTypeId, guests: [{ name: `${prefix} Guest`, email: buyer.user.email }] } });
  guestTicket = await required(request, `/api/ticket/${guests[0].ticketId}`, { token: admin.accessToken });
  device = await required(request, '/api/checkin/devices', { token: organizer.accessToken, method: 'POST', body: { eventId: event.eventId, label: `${prefix} Gate` } });
  persist();
});

test.afterAll(async () => {
  if (!admin) return;
  fs.mkdirSync('tmp', { recursive: true });
  const previous = fs.existsSync('tmp/live-findings.json') ? JSON.parse(fs.readFileSync('tmp/live-findings.json', 'utf8')) : [];
  fs.writeFileSync('tmp/live-findings.json', JSON.stringify([...previous, ...findings]));
});

test('real admin login, profile reload, users page, and logout', async ({ page }) => {
  await loginUi(page, adminEmail, adminPassword);
  await page.reload();
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeVisible();
  await page.locator('header').getByRole('link', { name: 'Quản trị hệ thống', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Quản trị người dùng', exact: true })).toBeVisible();
  await page.goto('/home');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();
});

test('buyer real login hides admin UI and backend rejects privileged APIs', async ({ page, request }) => {
  await loginUi(page, buyer.user.email, password);
  await expect(page.locator('a[href^="/admin/"], a[href="/manage"]')).toHaveCount(0);
  for (const path of ['/manage', `/manage/events/${event.eventId}`, '/admin/users', '/admin/devices', '/admin/payments']) {
    await page.goto(path); await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
  }
  for (const [path, port] of [['/api/manage/events', 8091], ['/api/checkin/devices', 8091], ['/api/user/admin/users', 8087]]) {
    expect((await call(request, path, { token: buyer.accessToken, port })).status).toBe(403);
  }
});

test('real registration validates password confirmation, signs in, and rejects duplicate email', async ({ page }) => {
  await page.goto('/register');
  const email = `${prefix.toLowerCase()}-ui@example.test`;
  await page.getByLabel('Họ và tên', { exact: true }).fill(`${prefix} UI User`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('different-password');
  await page.getByRole('button', { name: 'Đăng ký tài khoản', exact: true }).click();
  await expect(page.getByText('Mật khẩu nhập lại không khớp.', { exact: true })).toBeVisible();
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng ký tài khoản', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const saved = await page.evaluate(() => ({ user: JSON.parse(localStorage.getItem('user')), accessToken: localStorage.getItem('access_token'), refreshToken: localStorage.getItem('refresh_token') }));
  extraUsers.push(saved); persist();
  expect(saved.user.roles).toEqual(['USER']);
  await page.goto('/register');
  await page.getByLabel('Họ và tên', { exact: true }).fill(`${prefix} UI User`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(password);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/user/register'));
  await page.getByRole('button', { name: 'Đăng ký tài khoản', exact: true }).click();
  expect((await response).status()).toBe(409);
  await expect(page.locator('.bg-red-50')).toBeVisible();
});

test('real admin grants, revokes, locks and unlocks only a QA user', async ({ page }) => {
  test.skip(!extraUsers.length, 'Needs the synthetic UI account created in the registration test.');
  const account = extraUsers[0];
  await session(page, admin); await page.goto('/admin/users');
  await page.getByRole('searchbox').fill(account.user.email);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  for (const action of ['Cấp vai trò ORGANIZER', 'Thu hồi vai trò ORGANIZER', 'Khóa tài khoản', 'Mở khóa tài khoản']) {
    await page.locator('tbody summary').click();
    await page.getByRole('button', { name: action, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('status')).toContainText('thành công');
  }
  await expect(page.locator('tbody')).toContainText('ACTIVE');
});

test('organizer creates a draft through screen 14 and publishes through screen 15', async ({ page }) => {
  await session(page, organizer); await page.goto('/manage');
  await page.getByLabel('Tên sự kiện', { exact: false }).fill(`${prefix} UI draft`);
  await page.getByLabel('Mô tả sự kiện', { exact: false }).fill('QA event created through the real frontend');
  await page.getByRole('textbox', { name: 'Địa điểm *', exact: true }).fill('QA venue');
  await page.getByLabel('Ngày giờ bắt đầu').fill('2027-10-25T10:00');
  await page.getByLabel('Ngày giờ kết thúc').fill('2027-10-25T15:00');
  const created = page.waitForResponse((r) => r.url().endsWith('/api/event') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const result = await created; expect(result.status()).toBe(201);
  const data = await result.json(); extraEvents.push(data.eventId); persist();
  await page.getByRole('link', { name: `${prefix} UI draft`, exact: true }).click();
  await page.getByRole('button', { name: 'Xuất bản sự kiện ↗' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận xuất bản' }).click();
  await expect(page.locator('.em-hero')).toContainText('Đã công bố');
});

test('all 8 screen 15 tabs render against real APIs and reports download', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await session(page, organizer); await page.goto(`/manage/events/${event.eventId}`);
  await expect(page.getByRole('heading', { name: event.name, exact: true })).toBeVisible();
  for (const label of ['Tổng quan', 'Loại vé', 'Mã giảm giá', 'Khách mời', 'Thiết bị', 'Danh sách vé', 'Live Dashboard', 'Báo cáo']) {
    await tab(page, label);
    await expect(page.getByRole('navigation', { name: 'Các mục quản trị sự kiện' }).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.em-tab-content')).not.toBeEmpty();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  for (const file of ['attendees', 'payments']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: `Tải ${file}.csv` }).click();
    const result = await download; expect(await result.failure()).toBeNull();
    await result.saveAs(`tmp/live-${file}.csv`);
  }
  await page.screenshot({ path: 'tmp/live-screen15.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('real coupon create and toggle through screen 15', async ({ page }) => {
  await session(page, organizer); await page.goto(`/manage/events/${event.eventId}?tab=coupons`);
  await page.getByRole('button', { name: '+ Tạo mã giảm giá' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mã giảm giá', { exact: true }).fill(`QA${Date.now()}`);
  await dialog.getByLabel('Giá trị giảm (%)').fill('10');
  await dialog.getByRole('button', { name: 'Tạo mã', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Tắt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bật', exact: true })).toBeVisible();
});

test('admin creates and revokes only a QA device through screen 17', async ({ page }) => {
  await session(page, admin); await page.goto('/admin/devices');
  await page.getByRole('button', { name: '＋ Tạo thiết bị mới' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên thiết bị', { exact: true }).fill(`${prefix} Global UI`);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/checkin/devices') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Tạo thiết bị', exact: true }).click();
  const data = await (await response).json(); extraDevices.push(data.deviceId); persist();
  await expect(dialog.getByLabel('API key thiết bị')).not.toHaveValue('');
  await dialog.getByRole('button', { name: 'Đã lưu key, đóng' }).click();
  await expect(page.locator('table')).not.toContainText(data.apiKey);
  await page.getByRole('searchbox', { name: 'Tìm thiết bị' }).fill(`${prefix} Global UI`);
  await page.getByRole('button', { name: `Thu hồi ${prefix} Global UI`, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận thu hồi' }).click();
  await expect(page.locator('tbody')).toContainText('Đã thu hồi');
});

test('real signed guest QR is accepted online and rejected as duplicate on second request', async ({ page, request }) => {
  await page.goto('/checkin');
  await page.getByLabel('API Key thiết bị').fill(device.apiKey);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Offline ready · Chứng thư đã sẵn sàng')).toBeVisible();
  await page.getByRole('tab', { name: 'Nhập tay' }).click();
  await page.getByLabel('Nội dung mã QR').fill(guestTicket.qrPayload);
  await page.getByRole('button', { name: 'Kiểm tra vé →' }).click();
  await expect(page.locator('.ci-feedback')).toContainText('CHO VÀO');
  await expect(page.locator('.ci-history-list')).toContainText('Đã đối soát');
  const duplicate = await request.post('http://localhost:8091/api/checkin', { headers: { 'X-Device-Key': device.apiKey }, data: { qrPayload: guestTicket.qrPayload, idempotencyKey: crypto.randomUUID(), clientCheckinAt: new Date().toISOString() } });
  const data = await duplicate.json(); expect(duplicate.ok(), JSON.stringify(data)).toBe(true); expect(data.outcome).toBe('DUPLICATE');
});

test('real reservation and free payment publish the ticket through Kafka', async ({ request }) => {
  const result = await call(request, `/api/ticket-types/${freeType.ticketTypeId}/reservations`, { token: buyer.accessToken, method: 'POST', body: { quantity: 1, holderName: buyer.user.fullName, holderEmail: buyer.user.email } });
  if (result.status === 403) {
    findings.push({ code: 'EMAIL_VERIFICATION_REQUIRED', detail: 'Real buyer cannot reserve until email is verified; no SMTP token access available.' });
    test.skip(true, 'Backend requires verified email; email verification UI and SMTP access are unavailable.');
  }
  expect(result.status, JSON.stringify(result.data)).toBe(201);
  const payment = await required(request, '/api/payment/requests', { token: buyer.accessToken, method: 'POST', body: { reservationId: result.data.reservationId } });
  expect(payment.provider).toBe('FREE'); expect(payment.status).toBe('COMPLETED');
  await expect.poll(async () => (await required(request, `/api/ticket/${result.data.tickets[0].ticketId}`, { token: buyer.accessToken })).status, { timeout: 20000, intervals: [1000] }).toBe('ISSUED');
});

test('screen 18 handles real unavailable lookup and preserves disabled refund', async ({ page, request }) => {
  await session(page, admin); await page.goto('/admin/payments');
  await page.getByRole('textbox', { name: 'Mã đặt chỗ', exact: true }).fill(crypto.randomUUID());
  await page.getByRole('button', { name: '⌕ Tra cứu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy');
  await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toHaveCount(0);
  const result = await call(request, `/api/payment/requests/${crypto.randomUUID()}/refund`, { token: buyer.accessToken, method: 'POST' });
  expect(result.status).toBe(403);
});

test('real paid mock payment is idempotent and issues tickets asynchronously', async ({ request }) => {
  const reservation = await required(request, `/api/ticket-types/${paidType.ticketTypeId}/reservations`, { token: buyer.accessToken, method: 'POST', body: { quantity: 1, holderName: buyer.user.fullName, holderEmail: buyer.user.email } });
  const options = { token: buyer.accessToken, method: 'POST', body: { reservationId: reservation.reservationId, forceOutcome: 'COMPLETED' } };
  const result = await call(request, '/api/payment/requests', options);
  if (result.status === 400) {
    findings.push({ code: 'MOCK_FORCING_DISABLED', detail: 'Backend does not allow forced mock payment outcomes.' });
    test.skip(true, 'Force-outcome is disabled; real paid transactions are not attempted.');
  }
  expect(result.status, JSON.stringify(result.data)).toBe(201);
  expect(result.data.amountCents).toBe(5000000);
  expect(result.data.status).toBe('COMPLETED');
  expect(result.data.provider).toBe('MOCK');
  const again = await required(request, '/api/payment/requests', options);
  expect(again.paymentRequestId).toBe(result.data.paymentRequestId);
  await expect.poll(async () => (await required(request, `/api/ticket/${reservation.tickets[0].ticketId}`, { token: buyer.accessToken })).status, { timeout: 20000, intervals: [1000] }).toBe('ISSUED');
});

test('failed mock payment cancels the reservation and returns its quota', async ({ request }) => {
  const before = await required(request, `/api/event/${event.eventId}/ticket-types`);
  const available = before.find((type) => type.ticketTypeId === paidType.ticketTypeId).remaining;
  const reservation = await required(request, `/api/ticket-types/${paidType.ticketTypeId}/reservations`, { token: buyer.accessToken, method: 'POST', body: { quantity: 1, holderName: buyer.user.fullName, holderEmail: buyer.user.email } });
  const result = await call(request, '/api/payment/requests', { token: buyer.accessToken, method: 'POST', body: { reservationId: reservation.reservationId, forceOutcome: 'FAILED' } });
  test.skip(result.status === 400, 'Forced mock outcomes are disabled.');
  expect(result.status).toBe(201); expect(result.data.status).toBe('FAILED');
  await expect.poll(async () => (await required(request, `/api/ticket/${reservation.tickets[0].ticketId}`, { token: buyer.accessToken })).status, { timeout: 20000, intervals: [1000] }).toBe('CANCELLED');
  const after = await required(request, `/api/event/${event.eventId}/ticket-types`);
  expect(after.find((type) => type.ticketTypeId === paidType.ticketTypeId).remaining).toBe(available);
});

test('backend rejects invalid tokens and organizer access to another owners event', async ({ request }) => {
  expect((await call(request, '/api/manage/events', { token: 'invalid-token' })).status).toBe(401);
  const foreign = await required(request, '/api/event', { token: admin.accessToken, method: 'POST', body: { name: `${prefix} Other owner`, venue: 'QA', status: 'DRAFT', startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 172800000).toISOString() } });
  extraEvents.push(foreign.eventId); persist();
  for (const path of [`/api/event/${foreign.eventId}`, `/api/manage/events/${foreign.eventId}/report`]) {
    expect((await call(request, path, { token: organizer.accessToken })).status).toBe(404);
  }
  expect((await call(request, `/api/event/${foreign.eventId}`, { token: organizer.accessToken, method: 'PATCH', body: { name: 'Unauthorized edit' } })).status).toBe(404);
  expect((await call(request, '/api/checkin/devices', { token: organizer.accessToken, method: 'POST', body: { label: `${prefix} forbidden global`, eventId: null } })).status).toBe(403);
});

test('public event and buyer pages use real data and remain within the mobile viewport', async ({ page }) => {
  await session(page, buyer);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/home', '/profile', `/events/${event.eventId}`]) {
      await page.goto(path);
      await expect(page.locator('header')).toBeVisible();
      if (path.includes('/events/')) await expect(page.getByRole('heading', { name: event.name, exact: true })).toBeVisible();
      else if (path === '/profile') await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeVisible();
      else await expect(page.getByRole('heading', { name: /Những sự kiện/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} width=${width}`).toBe(true);
    }
  }
  await page.screenshot({ path: 'tmp/live-event-mobile.png', fullPage: true });
  const buyButtons = await page.getByRole('button', { name: /Mua vé|Đặt vé|Thanh toán/ }).count();
  if (!buyButtons) findings.push({ code: 'NO_BUY_ACTION', detail: 'Event detail displays ticket prices and availability but has no reservation or checkout action.' });
});
