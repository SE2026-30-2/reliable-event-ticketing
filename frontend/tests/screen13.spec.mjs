import { test, expect } from '@playwright/test';
import { webcrypto } from 'node:crypto';
const pair = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwks = { keys: [{ ...await webcrypto.subtle.exportKey('jwk', pair.publicKey), kid: 'test-key' }] };
async function ticket(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = { tid: crypto.randomUUID(), eid: crypto.randomUUID(), tt: crypto.randomUUID(), vf: now - 60, vu: now + 3600, ...overrides };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(payload));
  return `test-key.${payload}.${Buffer.from(signature).toString('base64url')}`;
}
async function setup(page, context, outcome = 'ACCEPTED') {
  const submissions = [];
  await context.route('http://localhost:8091/**', async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/.well-known/jwks.json') return route.fulfill({ json: jwks });
    if (path.startsWith('/api/checkin')) {
      const body = request.postDataJSON(); submissions.push({ path, body, key: request.headers()['x-device-key'] });
      const answer = (b) => ({ ticketId: (() => { try { return JSON.parse(Buffer.from(b.qrPayload.split('.')[1], 'base64url')).tid; } catch { return null; } })(), outcome, serverReceivedAt: new Date().toISOString(), entryNo: outcome === 'ACCEPTED' ? 1 : null });
      return route.fulfill({ json: Array.isArray(body) ? body.map(answer) : answer(body) });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('/checkin');
  await page.getByLabel('API Key thiết bị').fill('device-test-key');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Offline ready · Chứng thư đã sẵn sàng')).toBeVisible();
  await page.getByRole('tab', { name: 'Nhập tay' }).click();
  return submissions;
}
async function scan(page, payload) {
  await page.getByLabel('Nội dung mã QR').fill(payload);
  await page.getByRole('button', { name: 'Kiểm tra vé →' }).click();
}
test('online manual scan, device header, history, and responsive layout', async ({ page, context }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const requests = await setup(page, context);
  await scan(page, await ticket());
  await expect(page.getByRole('heading', { name: 'CHO VÀO', exact: true })).toBeVisible();
  await expect(page.getByText('Máy chủ đã xác nhận')).toBeVisible();
  expect(requests[0].key).toBe('device-test-key');
  expect(requests[0].body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await page.screenshot({ path: 'tmp/screen13-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'tmp/screen13-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('offline verification persists before sending, survives reload and reconciles through batch', async ({ page, context }) => {
  const requests = await setup(page, context, 'TICKET_VOIDED');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await scan(page, await ticket());
  await expect(page.getByRole('heading', { name: 'CHO VÀO', exact: true })).toBeVisible();
  await expect(page.getByText('1 lượt chờ đồng bộ')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Soát vé tại cổng', exact: true })).toBeVisible();
  await expect(page.getByText('1 lượt chờ đồng bộ')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText('0 lượt chờ đồng bộ')).toBeVisible({ timeout: 20000 });
  const batch = requests.find((r) => r.path.endsWith('/batch'));
  expect(batch.body).toHaveLength(1); expect(batch.key).toBe('device-test-key');
  await page.getByRole('button').filter({ hasText: 'Đã đối soát' }).click();
  await expect(page.getByRole('heading', { name: 'TỪ CHỐI', exact: true })).toBeVisible();
  await expect(page.getByText('Kết quả đã thay đổi sau khi đối soát máy chủ.')).toBeVisible();
});
test('offline multi-entry exhaustion and invalid signatures', async ({ page, context }) => {
  await setup(page, context); await context.setOffline(true);
  const payload = await ticket({ me: 2 });
  await scan(page, payload); await expect(page.getByText('Entry #1', { exact: true })).toBeVisible();
  await page.waitForTimeout(3100);
  await scan(page, payload); await expect(page.getByText('Entry #2', { exact: true })).toBeVisible();
  await page.waitForTimeout(3100);
  await scan(page, payload); await expect(page.getByRole('heading', { name: 'VÉ ĐÃ DÙNG HẾT LƯỢT', exact: true })).toBeVisible();
  await scan(page, 'broken-qr'); await expect(page.getByRole('heading', { name: 'TỪ CHỐI', exact: true })).toBeVisible();
});
test('wedge Enter submission and key-isolated offline queues', async ({ page, context }) => {
  await setup(page, context); await context.setOffline(true);
  await page.getByRole('tab', { name: 'Máy quét' }).click();
  const field = page.getByLabel('Nội dung mã QR'); await expect(field).toBeFocused();
  await field.fill(await ticket()); await field.press('Enter');
  await expect(page.getByText('1 lượt chờ đồng bộ')).toBeVisible();
  await page.getByLabel('API Key thiết bị').fill('different-device');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('0 lượt chờ đồng bộ')).toBeVisible();
  await page.getByLabel('API Key thiết bị').fill('device-test-key');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('1 lượt chờ đồng bộ')).toBeVisible();
});

test('server exhaustion is remembered offline and camera failure offers a fallback', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('Denied', 'NotAllowedError'); } });
  });
  await setup(page, context, 'DUPLICATE');
  const payload = await ticket();
  await scan(page, payload);
  await expect(page.getByRole('heading', { name: 'VÉ ĐÃ DÙNG HẾT LƯỢT', exact: true })).toBeVisible();
  await context.setOffline(true); await page.waitForTimeout(3100);
  await scan(page, payload);
  await expect(page.getByText('Tại thiết bị · Chờ đồng bộ')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'VÉ ĐÃ DÙNG HẾT LƯỢT', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Camera' }).click();
  await page.getByRole('button', { name: 'Bật camera', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa được cấp quyền camera');
  await page.screenshot({ path: 'tmp/screen13-camera.png', fullPage: true });
});
