import { test, expect } from '@playwright/test';
import { createPreviewService } from '../src/pages/EventManagementPage/previewService.js';

async function setup(page, options = {}) {
  const api = createPreviewService(), requests = [];
  await page.addInitScript((roles) => {
    localStorage.setItem('access_token', 'test-access-token');
    localStorage.setItem('user', JSON.stringify({ email: 'organizer@example.com', fullName: 'Nhà tổ chức', roles }));
  }, options.roles || ['ORGANIZER']);
  await page.route('http://localhost:8091/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    const body = req.postData() ? req.postDataJSON() : null;
    requests.push({ path: url.pathname, method, body, query: url.searchParams, headers: req.headers() });
    let data;
    try {
      if (url.pathname === '/api/event/e1') {
        data = method === 'PATCH' ? await api.update('e1', body) : (await api.workspace()).event;
        data.eventId = 'e1';
        if (options.status) data.status = options.status;
      } else if (url.pathname.endsWith('/report')) data = (await api.workspace()).report;
      else if (url.pathname.endsWith('/analytics')) data = await api.analytics('e1', Number(url.searchParams.get('days')));
      else if (url.pathname.endsWith('/ticket-types')) data = method === 'POST' ? await api.createTicketType('e1', body) : await api.ticketTypes();
      else if (url.pathname.endsWith('/coupons')) data = method === 'POST' ? await api.createCoupon('e1', body) : await api.coupons();
      else if (url.pathname.includes('/coupons/')) data = await api.setCouponActive('e1', url.pathname.split('/').at(-1), body.active);
      else if (url.pathname.endsWith('/guests')) data = await api.inviteGuests('e1', body);
      else if (url.pathname.endsWith('/tickets')) { data = await api.tickets('e1', Number(url.searchParams.get('page'))); data.content = data.content.map((t) => ({ ...t, reservationId: '44444444-4444-4444-8444-444444444444', qrPayload: 'SENSITIVE-QR-MUST-NOT-RENDER' })); }
      else if (url.pathname.endsWith('/status')) data = await api.updateTicketStatus(url.pathname.split('/')[3], body);
      else if (url.pathname === '/api/checkin/devices') {
        data = method === 'POST' ? await api.createDevice(body.eventId, body.label) : await api.devices();
        if (method === 'POST' && options.missingKey) delete data.apiKey;
      }
      else if (url.pathname.endsWith('/revoke')) data = await api.revokeDevice(url.pathname.split('/')[4]);
      else if (url.pathname.endsWith('/stats')) data = (await api.live()).stats;
      else if (url.pathname.endsWith('/timeline')) data = (await api.live()).timeline;
      else if (url.pathname.endsWith('.csv')) return route.fulfill({ status: 200, contentType: 'text/csv', body: '\uFEFFname,email\r\nDemo,demo@example.com\r\n' });
      else return route.fulfill({ status: 404, json: { message: 'Unknown mock endpoint' } });
      await route.fulfill({ status: 200, json: data });
    } catch (error) { await route.fulfill({ status: 409, json: { message: error.message } }); }
  });
  await page.goto('/manage/events/e1');
  await expect(page.getByRole('heading', { name: 'The Dreams Concert 2026', exact: true })).toBeVisible();
  return requests;
}
const tab = (page, name) => page.getByRole('navigation', { name: 'Các mục quản trị sự kiện' }).getByRole('button', { name, exact: true }).click();

test('overview, screen 14 navigation and responsive layout', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  await expect(page.getByText('1.284.500.000', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'tmp/screen15-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'tmp/screen15-mobile.png', fullPage: true });
  await page.goto('/manage/preview');
  await page.getByRole('link', { name: 'The Dreams Concert 2025' }).click();
  await expect(page).toHaveURL(/\/manage\/preview\/events\/preview-0/);
  await expect(page.getByRole('heading', { name: 'The Dreams Concert 2026', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('edit validates time range and persists confirmed response', async ({ page }) => {
  const requests = await setup(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên sự kiện').fill('Sự kiện đã cập nhật');
  await dialog.getByLabel('Thời gian kết thúc').fill('2026-01-01T10:00');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Thời gian kết thúc phải sau');
  expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(0);
  await dialog.getByLabel('Thời gian kết thúc').fill('2027-01-01T10:00');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('heading', { name: 'Sự kiện đã cập nhật', exact: true })).toBeVisible();
  const patch = requests.find((r) => r.method === 'PATCH');
  expect(patch.body.status).toBeUndefined();
  expect(patch.body.endsAt).toMatch(/Z$/);
});

test('overview displays daily analytics, period selection and persists category and sale dates', async ({ page }) => {
  const requests = await setup(page);
  await expect(page.getByText('12.840', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Biểu đồ doanh thu và số vé mua theo ngày', exact: true })).toBeVisible();
  await page.getByLabel('Khoảng thời gian báo cáo').selectOption('30');
  await expect(page.getByLabel('Khoảng thời gian báo cáo')).toHaveValue('30');
  await page.getByText('Xem số liệu theo ngày', { exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Ngày', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Danh mục', exact: true }).selectOption('SPORTS');
  await dialog.getByLabel('Ngày giờ mở bán', { exact: true }).fill('2026-11-01T08:00');
  await dialog.getByLabel('Ngày giờ đóng bán', { exact: true }).fill('2026-12-24T18:00');
  await dialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText('Đã lưu thông tin sự kiện.', { exact: true })).toBeVisible();
  expect(requests.find((r) => r.method === 'PATCH').body).toMatchObject({ category: 'SPORTS', clearSalesSchedule: false });
  await expect(page.getByText('Thể thao', { exact: true }).first()).toBeVisible();
});

test('editing a categorized event cannot select an unsupported empty category', async ({ page }) => {
  const requests = await setup(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Danh mục' })).toHaveValue('MUSIC');
  await expect(dialog.locator('select[name="category"] option[value=""]')).toHaveJSProperty('disabled', true);
  await dialog.getByRole('combobox', { name: 'Danh mục' }).press('Home');
  await expect(dialog.getByRole('combobox', { name: 'Danh mục' })).toHaveValue('MUSIC');
  await dialog.getByLabel('Tên sự kiện').fill('Giữ danh mục hiện tại');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByText('Đã lưu thông tin sự kiện.', { exact: true })).toBeVisible();
  expect(requests.find((request) => request.method === 'PATCH').body.category).toBe('MUSIC');
});

test('cancel requires confirmation and disables further editing', async ({ page }) => {
  const requests = await setup(page);
  await page.getByRole('button', { name: 'Hủy sự kiện', exact: true }).click();
  expect(requests.some((r) => r.method === 'PATCH')).toBeFalsy();
  await page.getByRole('button', { name: 'Quay lại' }).click();
  await page.getByRole('button', { name: 'Hủy sự kiện', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận hủy sự kiện' }).click();
  await expect(page.getByText('Đã hủy sự kiện.', { exact: true })).toBeVisible();
  for (const button of await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).all()) await expect(button).toBeDisabled();
});

test('create ticket type converts VND to cents and preserves bundle fields', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Loại vé');
  await page.getByRole('button', { name: '+ Tạo loại vé' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên loại vé').fill('Gói gia đình');
  await dialog.getByLabel('Giá (VNĐ / đơn vị)').fill('50000');
  await dialog.getByLabel('Quota (tổng số vé)').fill('100');
  await dialog.getByLabel('Số vé / gói').fill('4');
  await dialog.getByLabel('Số lượt vào / vé').fill('2');
  await dialog.getByRole('button', { name: 'Tạo loại vé', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Gói gia đình', exact: true })).toBeVisible();
  const create = requests.find((r) => r.method === 'POST');
  expect(create.body).toMatchObject({ priceCents: 5000000, quota: 100, bundleSize: 4, maxEntries: 2 });
});

test('fixed coupon converts money and can be disabled', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Mã giảm giá');
  await page.getByRole('button', { name: '+ Tạo mã giảm giá' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mã giảm giá', { exact: true }).fill('summer50');
  await dialog.getByLabel('Hình thức').selectOption('FIXED');
  await dialog.getByLabel('Giá trị giảm (VNĐ / đơn vị vé)').fill('50000');
  await dialog.getByRole('button', { name: 'Tạo mã', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'SUMMER50' });
  await expect(row).toBeVisible();
  expect(requests.find((r) => r.method === 'POST').body).toMatchObject({ code: 'SUMMER50', value: 5000000, type: 'FIXED' });
  await row.getByRole('button', { name: 'Tắt', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'SUMMER50' })).toContainText('Đang tắt');
});

test('guests validates rows, submits batch and clears form on success', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Khách mời');
  await page.getByLabel('Loại vé áp dụng').selectOption('vip');
  await page.getByLabel('Danh sách khách mời').fill('invalid');
  await page.getByRole('button', { name: 'Phát vé mời', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Dòng 1');
  expect(requests.some((r) => r.method === 'POST')).toBeFalsy();
  await page.getByLabel('Danh sách khách mời').fill('Minh Anh, anh@example.com\nHoàng Nam, nam@example.com');
  await page.getByRole('button', { name: 'Phát vé mời', exact: true }).click();
  await expect(page.getByText('Thành công: 2 vé · Thất bại: 0 vé.')).toBeVisible();
  await expect(page.getByLabel('Danh sách khách mời')).toHaveValue('');
  expect(requests.find((r) => r.method === 'POST').body.guests).toHaveLength(2);
});

test('device key only appears once and revoke requires confirmation', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Thiết bị');
  await page.getByLabel('Tên thiết bị').fill('Cổng B');
  await page.getByRole('button', { name: 'Tạo thiết bị', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('preview-only-');
  await page.getByRole('button', { name: 'Đã lưu, đóng' }).click();
  await expect(page.locator('body')).not.toContainText('preview-only-');
  const row = page.getByRole('row').filter({ hasText: 'Cổng B' });
  await row.getByRole('button', { name: 'Thu hồi', exact: true }).click();
  expect(requests.some((r) => r.path.endsWith('/revoke'))).toBeFalsy();
  await page.getByRole('button', { name: 'Xác nhận thu hồi' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Cổng B' })).toContainText('Đã thu hồi');
  expect(requests.find((r) => r.method === 'POST').body.eventId).toBe('e1');
});

test('tickets paginate, hide QR and require reason for void', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Danh sách vé');
  await expect(page.getByText('Trang 1 / 2')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('SENSITIVE-QR');
  await page.getByRole('button', { name: 'Sau →' }).click();
  await expect(page.getByText('Trang 2 / 2')).toBeVisible();
  await page.getByRole('button', { name: 'Hủy vé', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  expect(requests.some((r) => r.path.endsWith('/status'))).toBeFalsy();
  await page.getByLabel('Lý do').fill('Yêu cầu của khách');
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Vô hiệu hóa' })).toBeVisible();
  expect(requests.find((r) => r.path.endsWith('/status')).body).toEqual({ status: 'VOID', reason: 'Yêu cầu của khách' });
});

test('reports download authenticated CSV', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Báo cáo');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải attendees.csv' }).click();
  expect((await downloaded).suggestedFilename()).toBe('attendees-e1.csv');
  expect(requests.find((r) => r.path.endsWith('/attendees.csv')).headers.authorization).toBe('Bearer test-access-token');
});

test('Live polls every five seconds and stops on tab exit', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Live Dashboard');
  await expect(page.getByText('Lượt quét trùng', { exact: true })).toBeVisible();
  const count = () => requests.filter((r) => r.path.endsWith('/stats')).length;
  const initial = count();
  await expect.poll(count, { timeout: 9000 }).toBeGreaterThan(initial);
  expect(requests.find((r) => r.path.endsWith('/timeline')).query.get('bucketMinutes')).toBe('15');
  await tab(page, 'Tổng quan');
  await expect(page.getByText('Tổng vé đã phát hành')).toBeVisible();
  const after = count();
  await page.waitForTimeout(5500);
  expect(count()).toBe(after);
});

test('denied management access never renders public event details', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('access_token', 'token'); localStorage.setItem('user', JSON.stringify({ email: 'organizer@example.com', roles: ['ORGANIZER'] })); });
  await page.route('http://localhost:8091/**', (route) => route.fulfill({ status: 403, json: { message: 'Forbidden' } }));
  await page.goto('/manage/events/e1');
  await expect(page.getByRole('alert')).toContainText('quyền Ban tổ chức');
  await expect(page.getByRole('navigation', { name: 'Các mục quản trị sự kiện' })).toHaveCount(0);
});

test('preview does not call backend and all tabs render', async ({ page }) => {
  const backend = [];
  page.on('request', (req) => { if (req.url().includes('/api/')) backend.push(req.url()); });
  await page.goto('/manage/preview/events/demo');
  await expect(page.getByRole('heading', { name: 'The Dreams Concert 2026', exact: true })).toBeVisible();
  for (const name of ['Loại vé', 'Mã giảm giá', 'Khách mời', 'Thiết bị', 'Danh sách vé', 'Live Dashboard', 'Báo cáo', 'Tổng quan']) {
    await tab(page, name);
    await expect(page.getByRole('navigation', { name: 'Các mục quản trị sự kiện' }).getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  expect(backend).toEqual([]);
});

test('publish draft sends only status after confirmation', async ({ page }) => {
  const requests = await setup(page);
  const seed = await createPreviewService().workspace();
  await page.route('http://localhost:8091/api/event/e1', async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      expect(req.postDataJSON()).toEqual({ status: 'PUBLISHED' });
      seed.event.status = 'PUBLISHED';
      requests.push({ method: 'PATCH', body: req.postDataJSON() });
    }
    await route.fulfill({ json: { ...seed.event, eventId: 'e1' } });
  });
  seed.event.status = 'DRAFT';
  await page.reload();
  await page.getByRole('button', { name: 'Xuất bản sự kiện ↗' }).click();
  expect(requests.some((r) => r.method === 'PATCH')).toBeFalsy();
  await page.getByRole('button', { name: 'Xác nhận xuất bản' }).click();
  await expect(page.getByText('Đã xuất bản sự kiện.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem trang sự kiện ↗' })).toHaveAttribute('href', '/events/e1');
});

test('failed mutation keeps dialog and data, no success message', async ({ page }) => {
  await setup(page);
  await page.route('http://localhost:8091/api/event/e1', (route) => route.request().method() === 'PATCH' ? route.fulfill({ status: 409, json: { message: 'Sự kiện đã được cập nhật bởi người khác.' } }) : route.fallback());
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).first().click();
  await page.getByRole('dialog').getByLabel('Tên sự kiện').fill('Tên chưa lưu');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('được cập nhật bởi người khác');
  await expect(page.getByRole('dialog').getByLabel('Tên sự kiện')).toHaveValue('Tên chưa lưu');
  await expect(page.getByText('Đã lưu thông tin sự kiện.', { exact: true })).toHaveCount(0);
});

test('organizer cannot mark a ticket refunded without a payment refund', async ({ page }) => {
  const requests = await setup(page);
  await tab(page, 'Danh sách vé');
  await expect(page.getByRole('button', { name: 'Hoàn tiền', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Hoàn tiền giao dịch' })).toHaveCount(0);
  expect(requests.some((r) => r.path.endsWith('/status'))).toBeFalsy();
});

test('admin gets a link to the payment refund screen for a purchased ticket', async ({ page }) => {
  await setup(page, { roles: ['ADMIN'] });
  await tab(page, 'Danh sách vé');
  await expect(page.getByRole('link', { name: 'Hoàn tiền giao dịch' }).first()).toHaveAttribute('href', '/admin/payments?reservationId=44444444-4444-4444-8444-444444444444');
});

test('loading failure supports retry and export failure remains visible', async ({ page }) => {
  await setup(page);
  let fail = true;
  await page.route('http://localhost:8091/api/event/e1/ticket-types', (route) => fail ? route.fulfill({ status: 500, json: { message: 'Thử lại sau.' } }) : route.fallback());
  await tab(page, 'Loại vé');
  await expect(page.getByRole('alert')).toContainText('Thử lại sau.');
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'VIP', exact: true })).toBeVisible();
  await page.route('http://localhost:8091/**/payments.csv', (route) => route.fulfill({ status: 500, json: { message: 'Không xuất được báo cáo' } }));
  await tab(page, 'Báo cáo');
  await page.getByRole('button', { name: 'Tải payments.csv' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('unknown guest issuance outcome does not claim all tickets failed', async ({ page }) => {
  await setup(page);
  await page.route('http://localhost:8091/api/manage/events/e1/guests', (route) => route.fulfill({ status: 500, json: { message: 'Server error' } }));
  await tab(page, 'Khách mời');
  await page.getByLabel('Loại vé áp dụng').selectOption('vip');
  await page.getByLabel('Danh sách khách mời').fill('An, an@example.com');
  await page.getByRole('button', { name: 'Phát vé mời', exact: true }).click();
  await expect(page.getByText('Chưa xác nhận được kết quả phát vé.', { exact: false })).toBeVisible();
  await expect(page.getByText('Thất bại: 1 vé.', { exact: false })).toHaveCount(0);
});

test('missing device key is reported instead of silently losing the new credential', async ({ page }) => {
  await setup(page, { missingKey: true });
  await page.getByRole('button', { name: 'Thiết bị', exact: true }).click();
  await page.getByLabel('Tên thiết bị', { exact: true }).fill('Gate without returned key');
  await page.getByRole('button', { name: 'Tạo thiết bị', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Máy chủ chưa trả khóa thiết bị');
  await expect(page.getByRole('dialog', { name: 'Lưu khóa thiết bị' })).toHaveCount(0);
  await expect(page.getByText('Gate without returned key', { exact: true })).toBeVisible();
});

test('completed events do not offer editing, ticket type creation or coupon creation', async ({ page }) => {
  await setup(page, { status: 'COMPLETED' });
  const editButtons = page.getByRole('button', { name: 'Chỉnh sửa', exact: true });
  await expect(editButtons).toHaveCount(2);
  for (const button of await editButtons.all()) await expect(button).toBeDisabled();
  await page.getByRole('button', { name: 'Loại vé', exact: true }).click();
  await expect(page.getByRole('button', { name: '+ Tạo loại vé', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Mã giảm giá', exact: true }).click();
  await expect(page.getByRole('button', { name: '+ Tạo mã giảm giá', exact: true })).toBeDisabled();
});
