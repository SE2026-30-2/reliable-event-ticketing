import { test, expect } from '@playwright/test';

const profile = {
  id: 'admin-test', email: 'admin@example.com', fullName: 'Test Admin',
  roles: ['USER', 'ADMIN'], status: 'ACTIVE', emailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
};

async function submitLogin(page, email, password) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}

async function mockAuth(page, { profileStatus = 200, user = profile } = {}) {
  const calls = [];
  await page.route(/\/api\/event(?:\?|$)/, (route) => route.fulfill({ json: [] }));
  await page.route('http://localhost:8087/api/user/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204 });
    calls.push({ path, authorization: route.request().headers().authorization });
    if (path.endsWith('/login')) return route.fulfill({ json: {
      accessToken: 'new-access-token', refreshToken: 'new-refresh-token',
      tokenType: 'Bearer', expiresIn: 900,
    } });
    if (path.endsWith('/me')) return route.fulfill({
      status: profileStatus,
      json: profileStatus === 200 ? user : { message: 'Không tải được profile' },
    });
    if (path.endsWith('/admin/users')) return route.fulfill({ json: {
      content: [profile], totalPages: 1, totalElements: 1,
    } });
    return route.fulfill({ status: 404 });
  });
  return calls;
}

test('token-only login fetches profile before granting admin access, and survives reload', async ({ page }) => {
  const calls = await mockAuth(page);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/login$/);
  await submitLogin(page, profile.email, 'ExamplePassword123!');
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('heading', { name: 'Quản trị người dùng', exact: true })).toBeVisible();
  expect(calls.slice(0, 2).map((call) => call.path)).toEqual(['/api/user/login', '/api/user/me']);
  expect(calls[1].authorization).toBe('Bearer new-access-token');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('user')))).toEqual(profile);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quản trị người dùng', exact: true })).toBeVisible();
});

test('profile failure does not persist a partial login session', async ({ page }) => {
  await mockAuth(page, { profileStatus: 503 });
  await page.goto('/login');
  await submitLogin(page, profile.email, 'ExamplePassword123!');
  await expect(page.getByText('Không tải được profile', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ['user', 'access_token', 'refresh_token'].map((key) => localStorage.getItem(key)))).toEqual([null, null, null]);
  await expect(page).toHaveURL(/\/login$/);
});

for (const source of ['/admin/users', '/checkin']) {
  test(`about page keeps the signed-in account after navigation from ${source}`, async ({ page }) => {
    await mockAuth(page);
    await page.route('**/api/manage/events', (route) => route.fulfill({ json: [] }));
    await page.route('**/.well-known/jwks.json', (route) => route.fulfill({ status: 503 }));
    await page.goto('/login');
    await submitLogin(page, profile.email, 'ExamplePassword123!');
    await expect(page).toHaveURL(/\/home$/);
    await page.goto(source);
    // Check-in reaches the About link through event management.
    if (source === '/checkin') {
      await page.getByRole('link', { name: 'Quản lý sự kiện', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Về chúng tôi', exact: true }).click();
    await expect(page).toHaveURL(/\/#features$/);
    const header = page.locator('header');
    await expect(header.getByRole('link', { name: /Test Admin/ })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Đăng nhập', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(header.getByRole('link', { name: /Test Admin/ })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBe('new-access-token');
    await header.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(header.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Đăng ký', exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
  });
}

test('about page shows login and registration for guests', async ({ page }) => {
  await page.goto('/#features');
  const header = page.locator('header');
  await expect(header.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(header.getByRole('link', { name: 'Đăng ký', exact: true })).toBeVisible();
});

test('profile request uses the newly issued token rather than a stale stored token', async ({ page }) => {
  const calls = await mockAuth(page);
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('access_token', 'stale-token'));
  await submitLogin(page, profile.email, 'ExamplePassword123!');
  await expect(page).toHaveURL(/\/home$/);
  expect(calls[0].authorization).toBeUndefined();
  expect(calls[1].authorization).toBe('Bearer new-access-token');
});

test('event cards and both detail routes load the event and ticket types after merging main', async ({ page }) => {
  await mockAuth(page);
  const event = {
    eventId: 'merge-test-event', name: 'Merge Test Concert', status: 'PUBLISHED',
    venue: 'Test Venue', description: 'Test description',
    startsAt: '2026-11-01T12:00:00Z', endsAt: '2026-11-01T15:00:00Z',
  };
  await page.route(/\/api\/event(?:\?|$)/, (route) => route.fulfill({ json: { content: [event] } }));
  await page.route('**/api/event/merge-test-event', (route) => route.fulfill({ json: event }));
  await page.route('**/api/event/merge-test-event/ticket-types', (route) => route.fulfill({ json: [
    { ticketTypeId: 'vip', name: 'VIP from API', priceCents: 12000000, remaining: 12, bundleSize: 1 },
  ] }));
  await page.goto('/login');
  await submitLogin(page, profile.email, 'ExamplePassword123!');
  await page.getByRole('link', { name: 'Xem chi tiết', exact: true }).click();
  await expect(page).toHaveURL(/\/events\/merge-test-event$/);
  for (const path of ['/events/merge-test-event', '/event/merge-test-event']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: event.name, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'VIP from API', exact: true })).toBeVisible();
    await expect(page.getByText('Còn 12 vé', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  }
});

test('real backend: admin can log in and load screen 16 without injected storage', async ({ page }) => {
  test.skip(!process.env.AUTH_TEST_EMAIL || !process.env.AUTH_TEST_PASSWORD,
    'Set AUTH_TEST_EMAIL and AUTH_TEST_PASSWORD for a local ADMIN account.');
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/login$/);
  const loginResponse = page.waitForResponse((response) => response.url().endsWith('/api/user/login') && response.request().method() === 'POST');
  const profileResponse = page.waitForResponse((response) => response.url().endsWith('/api/user/me') && response.request().method() === 'GET');
  await submitLogin(page, process.env.AUTH_TEST_EMAIL, process.env.AUTH_TEST_PASSWORD);
  expect((await loginResponse).status()).toBe(200);
  const me = await profileResponse;
  expect(me.status()).toBe(200);
  expect((await me.json()).roles).toContain('ADMIN');
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('heading', { name: 'Quản trị người dùng', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
});
