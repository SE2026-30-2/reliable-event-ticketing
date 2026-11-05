import { test, expect } from '@playwright/test';
import jsQR from 'jsqr';

const eventId = '11111111-1111-4111-8111-111111111111';
const reservationId = '22222222-2222-4222-8222-222222222222';
const typeId = '33333333-3333-4333-8333-333333333333';
const user = { email: 'buyer@example.test', fullName: 'Buyer Example', roles: ['USER'], emailVerified: true };
const event = { eventId, name: 'Buyer Test Concert', status: 'PUBLISHED', venue: 'Test Venue', description: 'Buyer regression', startsAt: '2028-01-01T09:00:00Z', endsAt: '2028-01-01T18:00:00Z', category: 'MUSIC' };
const type = { ticketTypeId: typeId, eventId, name: 'Buyer Ticket', priceCents: 10000000, remaining: 50, quota: 50, issuedCount: 0, bundleSize: 1 };
const payload = n => `ticket-service-key-1.${Buffer.from(JSON.stringify({ tid: `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`, eid: eventId, tt: typeId, vf: 1700000000, vu: 2000000000, me: 1 })).toString('base64url')}.${Buffer.from(Array.from({ length: 256 }, (_, i) => (n * 13 + i * 71) % 256)).toString('base64url')}`;
const makeTicket = (n, changes = {}) => ({ ticketId: `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`, eventId, ticketTypeId: typeId, reservationId, holderName: `Holder ${n}`, holderEmail: user.email, ownerEmail: user.email, priceCents: 10000000, status: 'ISSUED', qrPayload: payload(n), validFrom: event.startsAt, validUntil: event.endsAt, ...changes });

async function setup(page, options = {}) {
  const calls = [], state = { tickets: options.tickets || [], payment: options.payment || null, waitlist: options.waitlist || [], readsAfterPayment: 0 };
  await page.addInitScript(({ user, navigationState }) => {
    localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('access_token', 'buyer-test-token');
    if (navigationState) history.replaceState({ usr: navigationState, key: 'buyer-test', idx: 0 }, '');
  }, { user, navigationState: options.navigationState });
  await page.route(/^https:\/\//, route => route.abort());
  page.on('dialog', dialog => dialog.accept());
  await page.route('http://localhost:8091/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    const body = req.postData() ? req.postDataJSON() : null;
    calls.push({ path, method: req.method(), params: url.searchParams, body });
    if (path === '/api/event') return route.fulfill({ json: [event, { ...event, eventId: 'sports', name: 'Sports Test', category: 'SPORTS' }] });
    if (path === `/api/event/${eventId}`) return route.fulfill({ json: event });
    if (path.endsWith('/ticket-types')) return route.fulfill({ json: [{ ...type, ...options.type }] });
    if (path.endsWith('/views')) return route.fulfill({ status: 204 });
    if (path.endsWith('/quote')) {
      if (options.quote) return options.quote(route);
      if (url.searchParams.get('coupon') === 'INVALID') return route.fulfill({ status: 400, json: { message: 'Mã giảm giá không hợp lệ' } });
      const gross = (options.type?.priceCents ?? type.priceCents) * Number(url.searchParams.get('quantity'));
      return route.fulfill({ json: { grossCents: gross, discountCents: 0, totalCents: gross, ticketCount: Number(url.searchParams.get('quantity')) * (options.type?.bundleSize || 1) } });
    }
    if (path.endsWith('/reservations')) {
      if (!body.holderName || !body.holderEmail) return route.fulfill({ status: 400, json: { message: 'Thiếu người nhận' } });
      const count = body.quantity * (options.type?.bundleSize || 1), totalCents = options.lockedTotal ?? (options.type?.priceCents ?? type.priceCents) * body.quantity;
      state.tickets = Array.from({ length: count }, (_, i) => makeTicket(i, { holderName: body.holderName, holderEmail: body.holderEmail, priceCents: Math.floor(totalCents / count) + (i < totalCents % count ? 1 : 0), status: 'RESERVED', qrPayload: null, reservationExpiresAt: new Date(Date.now() + 120000).toISOString() }));
      return route.fulfill({ status: 201, json: { reservationId, totalCents, discountCents: 0, tickets: state.tickets } });
    }
    const maybeIssue = () => {
      if (state.payment?.status === 'COMPLETED' && ++state.readsAfterPayment >= (options.issueAfter || 1)) state.tickets = state.tickets.map((ticket, i) => ({ ...ticket, status: 'ISSUED', qrPayload: payload(i) }));
    };
    if (path === '/api/my/tickets') {
      maybeIssue();
      const pageIndex = Number(url.searchParams.get('page') || 0), size = options.pageSize || Number(url.searchParams.get('size') || 20);
      return route.fulfill({ json: { content: state.tickets.slice(pageIndex * size, (pageIndex + 1) * size), totalPages: Math.ceil(state.tickets.length / size), totalElements: state.tickets.length } });
    }
    if (path.startsWith('/api/ticket/')) {
      maybeIssue();
      const ticket = state.tickets.find(ticket => ticket.ticketId === path.split('/')[3]);
      return route.fulfill({ status: ticket ? 200 : 404, json: ticket || {} });
    }
    if (path === '/api/my/waitlist') return route.fulfill({ json: state.waitlist });
    if (path.startsWith('/api/waitlist/')) {
      const entry = state.waitlist.find(entry => entry.entryId === path.split('/').at(-1));
      if (!entry) return route.fulfill({ status: 404, json: {} });
      entry.status = 'CANCELLED'; return route.fulfill({ json: entry });
    }
    if (path === '/api/payment/requests' && req.method() === 'POST') {
      state.payment ||= { paymentRequestId: '55555555-5555-4555-8555-555555555555', reservationId, status: 'COMPLETED', provider: state.tickets.reduce((sum, t) => sum + t.priceCents, 0) === 0 ? 'FREE' : 'MOCK', amountCents: state.tickets.reduce((sum, t) => sum + t.priceCents, 0) };
      return route.fulfill({ status: 201, json: state.payment });
    }
    if (path.includes('/api/payment/requests/by-reservation/')) return state.payment?.provider === 'VNPAY'
      ? route.fulfill({ json: state.payment }) : route.fulfill({ status: 404, json: { message: 'Online payments are not enabled' } });
    if (path.includes('/api/payment/vnpay/sync/')) {
      if (options.sync) return options.sync(route);
      return route.fulfill({ json: state.payment });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return { calls, state };
}

async function reserve(page) {
  await page.goto(`/events/${eventId}`);
  const button = page.getByRole('button', { name: /Đặt vé.*(Thanh toán|miễn phí)/ });
  await expect(button).toBeEnabled(); await button.click();
  await expect(page).toHaveURL(new RegExp(`/checkout/${reservationId}$`));
}

async function decodeQr(locator) {
  await expect(locator).toHaveAttribute('src', /^data:image\/png/);
  const data = await locator.evaluate(async image => {
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.getBoundingClientRect().width); canvas.height = Math.round(image.getBoundingClientRect().height);
    const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data), width: canvas.width, height: canvas.height };
  });
  return jsQR(new Uint8ClampedArray(data.data), data.width, data.height)?.data;
}

test('prefilled buyer can reserve, sees locked amount/expiry, pays and receives a decodable ticket QR', async ({ page }, testInfo) => {
  const { calls, state } = await setup(page, { lockedTotal: 8000000 });
  await reserve(page);
  expect(calls.find(call => call.path.endsWith('/reservations')).body).toMatchObject({ holderName: user.fullName, holderEmail: user.email });
  await expect(page.getByLabel('Thời gian giữ chỗ')).toHaveText(/0[12]:\d{2}/);
  const pay = page.getByRole('button', { name: /Thanh toán ngay/ });
  await expect(pay).toContainText('80.000');
  await page.screenshot({ path: testInfo.outputPath('checkout-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('checkout-mobile.png'), fullPage: true });
  await pay.click();
  await expect(page.getByRole('heading', { name: 'Vé đã được phát hành', exact: true })).toBeVisible();
  expect(calls.find(call => call.path === '/api/payment/requests' && call.method === 'POST').body).toEqual({ reservationId });
  expect(await decodeQr(page.getByRole('img', { name: `QR vé ${state.tickets[0].ticketId}` }))).toBe(state.tickets[0].qrPayload);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('result-mobile.png'), fullPage: true });
});

test('free bundle issues every ticket and renders a distinct real QR per ticket', async ({ page }) => {
  const { state } = await setup(page, { type: { priceCents: 0, bundleSize: 2 } });
  await reserve(page);
  await page.getByRole('button', { name: 'Xác nhận (miễn phí)', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vé đã được phát hành', exact: true })).toBeVisible();
  const images = page.getByRole('img', { name: /^QR vé / }); await expect(images).toHaveCount(2);
  const decoded = await Promise.all([decodeQr(images.nth(0)), decodeQr(images.nth(1))]);
  expect(decoded).toEqual(state.tickets.map(ticket => ticket.qrPayload)); expect(decoded[0]).not.toBe(decoded[1]);
});

test('an email checkout loads an owned reservation beyond the first API page and survives reload', async ({ page }) => {
  const tickets = Array.from({ length: 25 }, (_, i) => makeTicket(i, { reservationId: i === 24 ? reservationId : 'another', status: 'RESERVED', qrPayload: null, reservationExpiresAt: new Date(Date.now() + 120000).toISOString() }));
  const { calls } = await setup(page, { tickets, pageSize: 7 });
  await page.goto(`/checkout/${reservationId}`);
  await expect(page.getByText('Holder 24', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Thanh toán ngay/ })).toBeEnabled();
  expect(calls.filter(call => call.path === '/api/my/tickets')).toHaveLength(4);
  await page.reload(); await expect(page.getByRole('button', { name: /Thanh toán ngay/ })).toBeEnabled();
});

for (const backendStatus of ['PENDING', 'FAILED', 'REFUND_REQUIRED', 'REFUNDED']) {
  test(`callback query cannot override backend ${backendStatus}`, async ({ page }) => {
    await setup(page, { payment: { paymentRequestId: 'payment', reservationId, provider: 'VNPAY', amountCents: 10000000, status: backendStatus, txnRef: 'buyer-txn' } });
    await page.goto('/payment/result?vnp_TxnRef=buyer-txn&vnp_ResponseCode=00');
    await expect(page.getByRole('heading', { name: /Giao dịch|Thanh toán không thành công/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thanh toán thành công!', exact: true })).toHaveCount(0);
    await expect(page.getByRole('img', { name: /^QR vé / })).toHaveCount(0);
  });
}

test('missing transaction and failed synchronization never claim success', async ({ page }) => {
  await setup(page, { sync: route => route.abort('failed') });
  await page.goto('/payment-result');
  await expect(page.getByRole('heading', { name: 'Chưa có giao dịch để tra cứu', exact: true })).toBeVisible();
  await page.goto('/payment-result?vnp_TxnRef=buyer-txn&vnp_ResponseCode=00');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công!', exact: true })).toHaveCount(0);
});

test('completed payment waits for asynchronous ticket issuance before exposing QR', async ({ page }) => {
  const { state } = await setup(page, { issueAfter: 3 });
  await reserve(page); await page.getByRole('button', { name: /Thanh toán ngay/ }).click();
  await expect(page.getByRole('img', { name: /^QR vé / })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Vé đã được phát hành', exact: true })).toBeVisible({ timeout: 10000 });
  expect(await decodeQr(page.getByRole('img', { name: /^QR vé / }))).toBe(state.tickets[0].qrPayload);
});

test('invalid coupon shows the API error and blocks purchase instead of inventing a discount', async ({ page }) => {
  const { calls } = await setup(page); await page.goto(`/events/${eventId}`);
  await page.getByPlaceholder('MÃ GIẢM GIÁ').fill('INVALID'); await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Mã giảm giá không hợp lệ');
  await expect(page.getByRole('button', { name: /Đặt vé.*Thanh toán/ })).toBeDisabled();
  await expect(page.getByText('Giảm: -10.000đ', { exact: true })).toHaveCount(0);
  expect(calls.some(call => call.path.endsWith('/reservations'))).toBe(false);
});

test('gateway polling continues while the countdown changes and stops after navigation', async ({ page }) => {
  const payment = { paymentRequestId: 'payment', reservationId, provider: 'VNPAY', status: 'PENDING', amountCents: 10000000, txnRef: 'buyer-txn', paymentUrl: 'https://sandbox.vnpayment.vn/synthetic-test' };
  const { calls } = await setup(page, { payment, navigationState: { ...payment, expiresAt: new Date(Date.now() + 120000).toISOString() } });
  await page.goto('/payment-gateway');
  await expect(page.getByRole('link', { name: 'Mở trang thanh toán VNPay', exact: true })).toHaveAttribute('href', payment.paymentUrl);
  await expect.poll(() => calls.filter(call => call.path.includes('/sync/')).length, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
  await page.getByRole('link', { name: 'Trang chủ', exact: true }).first().click();
  const count = calls.filter(call => call.path.includes('/sync/')).length;
  await page.waitForTimeout(3300);
  expect(calls.filter(call => call.path.includes('/sync/'))).toHaveLength(count);
});

test('waitlist uses entryId, cancels one entry, and offered checkout uses reservationId', async ({ page }) => {
  const waitlist = [{ entryId: 'wait-1', ticketTypeId: typeId, quantity: 1, status: 'WAITING' }, { entryId: 'offer-1', ticketTypeId: typeId, quantity: 1, status: 'OFFERED', reservationId }];
  const { calls } = await setup(page, { waitlist, tickets: [makeTicket(0, { status: 'RESERVED', qrPayload: null, reservationExpiresAt: new Date(Date.now() + 120000).toISOString() })] });
  await page.goto('/my-tickets'); await page.getByRole('button', { name: /danh sách chờ/i }).click();
  await page.getByRole('button', { name: 'Rời danh sách', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rời danh sách', exact: true })).toHaveCount(0);
  expect(calls.find(call => call.method === 'DELETE').path).toBe('/api/waitlist/wait-1');
  await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/checkout/${reservationId}$`));
  await expect(page.getByRole('button', { name: /Thanh toán ngay/ })).toBeEnabled();
});

test('personal tickets show later API pages and only ISSUED tickets expose decodable QR', async ({ page }, testInfo) => {
  const tickets = Array.from({ length: 25 }, (_, i) => makeTicket(i, i === 24 ? { status: 'REFUNDED', qrPayload: null } : {}));
  await setup(page, { tickets, pageSize: 7 }); await page.goto('/my-tickets');
  const firstQr = page.getByRole('img', { name: `QR vé ${tickets[0].ticketId}` });
  expect(await decodeQr(firstQr)).toBe(tickets[0].qrPayload);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await decodeQr(firstQr)).toBe(tickets[0].qrPayload);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('tickets-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '7', exact: true }).click();
  await expect(page.getByText('Holder 24', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /^QR vé / })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('home categories filter real event categories', async ({ page }) => {
  await setup(page); await page.goto('/home'); await expect(page.getByText('Sports Test', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Âm nhạc', exact: true }).click();
  await expect(page.getByText(event.name, { exact: true })).toBeVisible();
  await expect(page.getByText('Sports Test', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hội thảo', exact: true }).click();
  await expect(page.getByText('Không tìm thấy sự kiện nào phù hợp.', { exact: true })).toBeVisible();
});
