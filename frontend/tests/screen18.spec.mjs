import { test, expect } from '@playwright/test';

const reservationId = '20251025-0000-4000-8000-000000000123';
const paymentRequestId = '20251025-0000-4000-8000-000000000789';
const payment = { reservationId, paymentRequestId, provider: 'VNPAY', status: 'COMPLETED', amountCents: 220000000, createdAt: '2025-10-25T08:40:00Z', completedAt: '2025-10-25T08:42:00Z', txnRef: 'EH202510251542', failureReason: null };
const admin = { email: 'admin@example.com', fullName: 'Nguyễn Văn A', roles: ['ADMIN'] };

async function setup(page, options = {}) {
  const calls = [];
  await page.addInitScript((user) => { localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('access_token', 'test-token'); }, options.user || admin);
  await page.route('http://localhost:8091/api/payment/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    calls.push({ method: req.method(), url: req.url(), auth: req.headers().authorization, body: req.postData() });
    if (req.method() === 'GET') return route.fulfill({ status: options.lookupStatus || 200, json: options.lookupStatus ? {} : { ...payment, ...options.payment } });
    if (options.refund) return options.refund(route);
    return route.fulfill({ json: { ...payment, status: 'REFUNDED' } });
  });
  await page.goto('/admin/payments');
  return calls;
}

async function lookup(page) {
  await page.getByRole('textbox', { name: 'Mã đặt chỗ', exact: true }).fill(reservationId);
  await page.getByRole('button', { name: '⌕ Tra cứu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin giao dịch' })).toBeVisible();
}

test('requires login and ADMIN without calling the payment API', async ({ page }) => {
  await page.goto('/admin/payments');
  await expect(page).toHaveURL(/\/login/);
  const calls = await setup(page, { user: { ...admin, roles: ['ORGANIZER'] } });
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
  expect(calls).toHaveLength(0);
});

test('validates UUID, uses authenticated reservation lookup and converts cents correctly', async ({ page }) => {
  const calls = await setup(page);
  await page.getByRole('textbox', { name: 'Mã đặt chỗ', exact: true }).fill('RES20251025ABC123');
  await page.getByRole('button', { name: '⌕ Tra cứu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('UUID');
  expect(calls).toHaveLength(0);
  await expect(page.getByRole('radio', { name: /Payment ID/ })).toBeDisabled();
  await lookup(page);
  expect(calls).toEqual([{ method: 'GET', url: `http://localhost:8091/api/payment/requests/by-reservation/${reservationId}`, auth: 'Bearer test-token', body: null }]);
  await expect(page.locator('.ap-amount')).toHaveText(/2\.200\.000/);
  await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toBeEnabled();
});

test('refund waits for server confirmation, blocks double submit and prevents dismissal while busy', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const calls = await setup(page, { refund: async (route) => { await gate; await route.fulfill({ json: { ...payment, status: 'REFUNDED' } }); } });
  await lookup(page);
  await page.getByRole('button', { name: '↶ Hoàn tiền', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('2.200.000');
  await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
  expect(calls.filter((call) => call.method === 'POST')).toHaveLength(0);
  await page.getByRole('button', { name: '↶ Hoàn tiền', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận hoàn tiền', exact: true }).dblclick();
  await expect(dialog.getByRole('button', { name: 'Đang hoàn tiền…' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.ap-panel-title')).toContainText('Thanh toán thành công');
  expect(calls.filter((call) => call.method === 'POST')).toEqual([{ method: 'POST', url: `http://localhost:8091/api/payment/requests/${paymentRequestId}/refund`, auth: 'Bearer test-token', body: null }]);
  release();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.ap-panel-title')).toContainText('Đã hoàn tiền');
  await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toBeDisabled();
});

for (const change of [{ provider: 'MOCK' }, { provider: 'FREE', amountCents: 0 }, { status: 'PENDING' }, { status: 'FAILED' }, { status: 'REFUND_REQUIRED' }, { status: 'REFUNDED' }]) {
  test(`prevents ineligible refunds: ${JSON.stringify(change)}`, async ({ page }) => {
    await setup(page, { payment: change }); await lookup(page);
    await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toBeDisabled();
  });
}

for (const status of [401, 403, 404, 500]) {
  test(`renders lookup error ${status} without showing stale payment`, async ({ page }) => {
    await setup(page, { lookupStatus: status });
    await page.getByRole('textbox', { name: 'Mã đặt chỗ', exact: true }).fill(reservationId);
    await page.getByRole('button', { name: '⌕ Tra cứu', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thông tin giao dịch' })).toHaveCount(0);
  });
}

test('refund conflict keeps payment unchanged and requires lookup before retry', async ({ page }) => {
  await setup(page, { refund: (route) => route.fulfill({ status: 409, json: {} }) }); await lookup(page);
  await page.getByRole('button', { name: '↶ Hoàn tiền', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn tiền', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('tra cứu lại');
  await expect(page.locator('.ap-panel-title')).toContainText('Thanh toán thành công');
  await page.getByRole('button', { name: 'Đóng và tra cứu lại' }).click();
  await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toBeDisabled();
  await lookup(page);
  await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toBeEnabled();
});

for (const outcome of ['network', 'pending', 'wrong-payment']) {
  test(`requires lookup after an unconfirmed refund: ${outcome}`, async ({ page }) => {
    const calls = await setup(page, { refund: (route) => outcome === 'network' ? route.abort('failed') : route.fulfill({ json: { ...payment, status: outcome === 'pending' ? 'PENDING' : 'REFUNDED', paymentRequestId: outcome === 'wrong-payment' ? reservationId : paymentRequestId } }) });
    await lookup(page);
    await page.getByRole('button', { name: '↶ Hoàn tiền', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn tiền', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('tra cứu lại');
    await expect(page.locator('.ap-panel-title')).toContainText('Thanh toán thành công');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Xác nhận hoàn tiền', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Đóng và tra cứu lại' }).click();
    await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toBeDisabled();
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
  });
}

test('a failed second lookup removes the previous transaction', async ({ page }) => {
  await setup(page); await lookup(page);
  await page.route(`http://localhost:8091/api/payment/requests/by-reservation/${reservationId}`, (route) => route.fulfill({ status: 404, json: {} }));
  await page.getByRole('button', { name: '⌕ Tra cứu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy');
  await expect(page.getByRole('heading', { name: 'Thông tin giao dịch' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '↶ Hoàn tiền', exact: true })).toHaveCount(0);
});

test('preview uses no API, renders desktop and mobile without horizontal overflow', async ({ page }) => {
  let calls = 0;
  page.on('request', (request) => { if (request.url().includes('/api/')) calls++; });
  await page.goto('/admin/payments/preview');
  await page.getByRole('button', { name: '⌕ Tra cứu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thông tin giao dịch' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'tmp/screen18-desktop.png', fullPage: true });
  await page.getByRole('button', { name: '↶ Hoàn tiền', exact: true }).click();
  await page.screenshot({ path: 'tmp/screen18-refund.png', fullPage: true });
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'tmp/screen18-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls).toBe(0);
});
