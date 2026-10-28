import { test, expect } from '@playwright/test';

const events = [{ eventId: 'event-1', name: 'Đêm nhạc Hà Nội', status: 'PUBLISHED' }];
const initial = [
  { deviceId: 'device-global', label: 'Cổng chính', eventId: null, status: 'ACTIVE', createdAt: '2026-10-20T08:00:00Z', lastSeenAt: null, revokedAt: null },
  { deviceId: 'device-event', label: 'iPad sân khấu', eventId: 'event-1', status: 'ACTIVE', createdAt: '2026-10-20T08:00:00Z', lastSeenAt: '2026-10-22T08:00:00Z', revokedAt: null },
  { deviceId: 'device-revoked', label: 'Máy quét cũ', eventId: null, status: 'REVOKED', createdAt: '2026-10-20T08:00:00Z', lastSeenAt: null, revokedAt: '2026-10-21T08:00:00Z' },
];
const user = { id: 'admin-1', fullName: 'Quản trị viên', email: 'admin@example.com', roles: ['USER', 'ADMIN'], emailVerified: true };

async function setup(page, options = {}) {
  const calls = [];
  let devices = (options.devices || initial).map((device) => ({ ...device }));
  await page.addInitScript((profile) => {
    localStorage.setItem('user', JSON.stringify(profile));
    localStorage.setItem('access_token', 'test-access-token');
  }, options.user || user);
  await page.route('http://localhost:8091/api/manage/events', (route) => route.fulfill({
    status: options.eventsStatus || 200, json: options.eventsStatus ? { message: 'Sự kiện tạm thời không tải được' } : events,
  }));
  await page.route('http://localhost:8091/api/checkin/devices**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    calls.push({ method: request.method(), url: request.url(), auth: request.headers().authorization, body: request.postDataJSON() });
    if (request.method() === 'GET') return route.fulfill({ status: options.listStatus || 200, json: options.listStatus ? { message: 'Không có quyền' } : devices });
    if (request.method() === 'POST') {
      if (options.create) return options.create(route);
      const result = { ...request.postDataJSON(), deviceId: 'device-new', apiKey: 'test-one-time-key' };
      devices = [{ ...result, status: 'ACTIVE', createdAt: new Date().toISOString() }, ...devices];
      return route.fulfill({ status: 201, json: result });
    }
    if (options.revoke) return options.revoke(route);
    const id = new URL(request.url()).pathname.split('/').at(-2);
    devices = devices.map((device) => device.deviceId === id ? { ...device, status: 'REVOKED', revokedAt: new Date().toISOString() } : device);
    return route.fulfill({ json: devices.find((device) => device.deviceId === id) });
  });
  return calls;
}

test('requires a session and ADMIN role before requesting global device data', async ({ page }) => {
  await page.goto('/admin/devices');
  await expect(page).toHaveURL(/\/login$/);
  const calls = await setup(page, { user: { ...user, roles: ['ORGANIZER'] } });
  await page.goto('/admin/devices');
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
  expect(calls).toHaveLength(0);
});

test('admin can reach devices from the home navigation on desktop and mobile', async ({ page }) => {
  await setup(page);
  await page.route('http://localhost:8091/api/event**', (route) => route.fulfill({ json: [] }));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/home');
    await page.getByRole('link', { name: 'Quản trị hệ thống', exact: true }).filter({ visible: true }).click();
    await page.getByRole('navigation', { name: 'Các mục quản trị hệ thống', exact: true }).getByRole('link', { name: 'Quản trị thiết bị' }).click();
    await expect(page.getByRole('heading', { name: 'Quản trị thiết bị toàn cầu' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('filters across all pages by event name, accent-insensitive device name, type and status', async ({ page }) => {
  const calls = await setup(page, { devices: [...initial, ...Array.from({ length: 10 }, (_, i) => ({ ...initial[0], deviceId: `extra-${i}`, label: `Máy phụ ${i}` }))] });
  await page.goto('/admin/devices');
  await expect(page.getByRole('button', { name: 'Tất cả thiết bị (13)' })).toBeVisible();
  expect(calls[0].auth).toBe('Bearer test-access-token');
  expect(new URL(calls[0].url).search).toBe('');
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.getByText('Trang 2 / 2', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Tìm thiết bị' }).fill('dem nhac ha noi');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('iPad sân khấu');
  await expect(page.getByText('Trang 1 / 1', { exact: true })).toBeVisible();
  await page.getByRole('searchbox').fill('cong chinh');
  await expect(page.locator('tbody')).toContainText('Cổng chính');
  await page.getByRole('searchbox').fill('');
  await page.getByLabel('Trạng thái thiết bị').selectOption('REVOKED');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Thu hồi Máy quét cũ' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thiết bị theo sự kiện (1)' }).click();
  await expect(page.getByText('Không tìm thấy thiết bị phù hợp.')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(10);
});

test('creates global device with null eventId and exposes key only in the success dialog', async ({ page, context }) => {
  const calls = await setup(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/admin/devices');
  await page.getByRole('button', { name: 'Tạo thiết bị mới' }).click();
  await page.getByLabel('Tên thiết bị', { exact: true }).fill('   Cổng mới   ');
  await page.getByRole('button', { name: 'Tạo thiết bị', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Tạo thiết bị thành công' })).toBeVisible();
  expect(calls.find((call) => call.method === 'POST').body).toEqual({ label: 'Cổng mới', eventId: null });
  await expect(page.getByLabel('API key thiết bị', { exact: true })).toHaveValue('test-one-time-key');
  await page.getByRole('button', { name: 'Sao chép', exact: true }).click();
  await expect(page.getByText('Đã sao chép API key.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('test-one-time-key');
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('test-one-time-key');
  await page.getByRole('button', { name: 'Đã lưu key, đóng' }).click();
  await page.getByRole('button', { name: 'Chi tiết Cổng mới', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toContainText('test-one-time-key');
  await expect(page.getByLabel('API key thiết bị', { exact: true })).toHaveCount(0);
});

test('validates event selection, prevents duplicate submission, and retains form on API failure', async ({ page }) => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  const calls = await setup(page, { create: async (route) => { await pending; await route.fulfill({ status: 409, json: { message: 'Không thể tạo thiết bị lúc này' } }); } });
  await page.goto('/admin/devices');
  await page.getByRole('button', { name: 'Tạo thiết bị mới' }).click();
  await page.getByLabel('Tên thiết bị', { exact: true }).fill('iPad mới');
  await page.getByRole('radio', { name: /Thiết bị theo sự kiện/ }).check();
  await page.getByRole('button', { name: 'Tạo thiết bị', exact: true }).click();
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  await page.getByLabel('Gắn sự kiện').selectOption('event-1');
  await page.getByRole('button', { name: 'Tạo thiết bị', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang tạo…' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Đóng hộp thoại' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  finish();
  await expect(page.getByRole('alert')).toHaveText('Không thể tạo thiết bị lúc này');
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  expect(calls.find((call) => call.method === 'POST').body).toEqual({ label: 'iPad mới', eventId: 'event-1' });
  await expect(page.getByLabel('Tên thiết bị', { exact: true })).toHaveValue('iPad mới');
});

test('revocation requires confirmation, preserves data on failure, and updates only after success', async ({ page }) => {
  let fail = true;
  const calls = await setup(page, { revoke: (route) => route.fulfill({ status: fail ? 503 : 200, json: fail ? { message: 'Thử lại sau' } : { ...initial[0], status: 'REVOKED', revokedAt: '2026-10-22T08:00:00Z' } }) });
  await page.goto('/admin/devices');
  await page.getByRole('button', { name: 'Thu hồi Cổng chính', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Thao tác này là vĩnh viễn');
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0);
  await page.getByRole('button', { name: 'Thu hồi Cổng chính', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click();
  await expect(page.getByRole('alert')).toHaveText('Thử lại sau');
  fail = false;
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('tbody tr').filter({ hasText: 'Cổng chính' })).toContainText('Đã thu hồi');
  await expect(page.getByRole('button', { name: 'Thu hồi Cổng chính', exact: true })).toHaveCount(0);
  expect(calls.filter((call) => call.method === 'PATCH').every((call) => call.url.endsWith('/device-global/revoke'))).toBe(true);
});

test('list errors show unavailable counts, block creation and allow retry', async ({ page }) => {
  await setup(page, { listStatus: 401 });
  await page.goto('/admin/devices');
  await expect(page.getByRole('alert')).toContainText('Phiên đăng nhập đã hết hạn');
  await expect(page.getByRole('button', { name: 'Tạo thiết bị mới' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tất cả thiết bị (—)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có thiết bị check-in.', { exact: true })).toHaveCount(0);
});

test('event lookup failure preserves device IDs and permits only global creation', async ({ page }) => {
  await setup(page, { eventsStatus: 503 });
  await page.goto('/admin/devices');
  await expect(page.locator('tbody')).toContainText('event-1');
  await page.getByRole('button', { name: 'Tạo thiết bị mới' }).click();
  await page.getByRole('radio', { name: /Thiết bị theo sự kiện/ }).check();
  await expect(page.getByRole('button', { name: 'Tạo thiết bị', exact: true })).toBeDisabled();
  await page.getByRole('radio', { name: /Thiết bị toàn cầu/ }).check();
  await expect(page.getByRole('button', { name: 'Tạo thiết bị', exact: true })).toBeEnabled();
});

test('preview supports creating and revoking locally, desktop and mobile stay within viewport', async ({ page }, testInfo) => {
  const requests = [];
  page.on('request', (request) => { if (/\/api\//.test(request.url())) requests.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/devices/preview');
  await expect(page.getByRole('button', { name: 'Tất cả thiết bị (5)' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Tạo thiết bị mới' }).click();
  await page.getByLabel('Tên thiết bị', { exact: true }).fill('Thiết bị mẫu mới');
  await page.getByRole('radio', { name: /Thiết bị theo sự kiện/ }).check();
  await page.getByLabel('Gắn sự kiện').selectOption('demo-concert');
  await page.screenshot({ path: testInfo.outputPath('mobile-create.png'), fullPage: true });
  await page.getByRole('button', { name: 'Tạo thiết bị', exact: true }).click();
  await expect(page.getByLabel('API key thiết bị', { exact: true })).toHaveValue(/^demo_only_/);
  await page.screenshot({ path: testInfo.outputPath('mobile-key.png'), fullPage: true });
  await page.getByRole('button', { name: 'Đã lưu key, đóng' }).click();
  await page.getByRole('button', { name: 'Thu hồi Thiết bị mẫu mới', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click();
  await expect(page.getByRole('button', { name: 'Thu hồi Thiết bị mẫu mới', exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
});
