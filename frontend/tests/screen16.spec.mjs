import { test, expect } from '@playwright/test';

const endpoint = 'http://localhost:8087/api/user/admin/users';
const makeUsers = () => Array.from({ length: 13 }, (_, i) => ({
  id: `u${i}`, fullName: i === 0 ? 'Nguyễn Văn An' : `Người dùng ${i}`, email: `user${i}@example.com`,
  roles: i === 0 ? ['USER', 'ADMIN'] : i === 1 ? ['ORGANIZER'] : ['USER'],
  status: i === 2 ? 'LOCKED' : 'ACTIVE', emailVerified: i % 2 === 0,
  createdAt: '2026-01-12T08:00:00Z', failedLoginAttempts: 0,
}));

async function login(page, roles = ['ADMIN']) {
  await page.addInitScript((roles) => {
    localStorage.setItem('access_token', 'screen16-token');
    localStorage.setItem('user', JSON.stringify({ id: 'self', fullName: 'Admin', email: 'admin@example.com', roles }));
  }, roles);
}

async function setup(page, options = {}) {
  const users = makeUsers(), requests = [];
  await login(page);
  await page.route(`${endpoint}**`, async (route) => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    requests.push({ method: req.method(), path: url.pathname, query: url.search, body: req.postDataJSON(), auth: req.headers().authorization });
    if (options.failList && url.pathname === '/api/user/admin/users') return route.fulfill({ status: 503, json: { message: 'Máy chủ đang bảo trì' } });
    if (url.pathname === '/api/user/admin/users') {
      // Exercise multiple API pages even though the browser asks for size=200.
      const pageIndex = Number(url.searchParams.get('page'));
      return route.fulfill({ json: { content: users.slice(pageIndex * 7, (pageIndex + 1) * 7), totalPages: 2, totalElements: users.length } });
    }
    const parts = url.pathname.split('/'), id = parts[5];
    const item = users.find((u) => u.id === id);
    if (!item) return route.fulfill({ status: 404, json: { message: 'Không tồn tại' } });
    if (req.method() === 'PATCH') {
      if (options.failPatch) return route.fulfill({ status: 403, json: { message: 'Forbidden' } });
      Object.assign(item, req.postDataJSON());
    }
    return route.fulfill({ json: item });
  });
  await page.goto('/admin/users');
  if (!options.failList) await expect(page.getByRole('cell', { name: 'user0@example.com', exact: true })).toBeVisible();
  return { users, requests };
}

async function action(page, name, label) {
  await page.getByLabel(`Thao tác với ${name}`, { exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('global filters, statistics, pagination and responsive layout', async ({ page }) => {
  const { requests } = await setup(page);
  await expect(page.getByText('Hiển thị 1 - 10 của')).toBeVisible();
  expect(requests.filter((r) => r.path === '/api/user/admin/users')).toHaveLength(2);
  expect(requests.every((r) => r.auth === 'Bearer screen16-token')).toBeTruthy();
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'user12@example.com', exact: true })).toBeVisible();
  await page.getByLabel('Tìm kiếm theo tên hoặc email').fill('nguyen van an');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Trạng thái email', { exact: true }).selectOption('false');
  await expect(page.getByText('Không tìm thấy người dùng phù hợp.')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await page.getByLabel('Vai trò', { exact: true }).selectOption('ORGANIZER');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Vai trò', { exact: true }).selectOption('');
  await page.screenshot({ path: 'tmp/screen16-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'tmp/screen16-mobile.png', fullPage: true });
});

test('detail, granting and revoking organizer preserve other roles', async ({ page }) => {
  const { requests } = await setup(page);
  await action(page, 'Nguyễn Văn An', 'Xem chi tiết');
  await expect(page.getByRole('dialog').getByText('u0', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng hộp thoại' }).click();
  await action(page, 'Nguyễn Văn An', 'Cấp vai trò ORGANIZER');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.find((r) => r.method === 'PATCH').body.roles).toEqual(['USER', 'ADMIN', 'ORGANIZER']);
  await action(page, 'Nguyễn Văn An', 'Thu hồi vai trò ORGANIZER');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.filter((r) => r.method === 'PATCH').at(-1).body.roles).toEqual(['USER', 'ADMIN']);
  await action(page, 'Người dùng 1', 'Thu hồi vai trò ORGANIZER');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.filter((r) => r.method === 'PATCH').at(-1).body.roles).toEqual(['USER']);
});

test('locking, cancellation and unlocking use correct status requests', async ({ page }) => {
  const { requests } = await setup(page);
  await action(page, 'Người dùng 3', 'Khóa tài khoản');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  expect(requests.some((r) => r.method === 'PATCH')).toBeFalsy();
  await action(page, 'Người dùng 3', 'Khóa tài khoản');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.find((r) => r.method === 'PATCH').body).toEqual({ status: 'LOCKED' });
  await action(page, 'Người dùng 3', 'Mở khóa tài khoản');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.filter((r) => r.method === 'PATCH').at(-1).body).toEqual({ status: 'ACTIVE' });
});

test('failed mutation displays error without changing the table', async ({ page }) => {
  await setup(page, { failPatch: true });
  await action(page, 'Người dùng 3', 'Khóa tài khoản');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Quản trị viên');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'user3@example.com' }).getByText('ACTIVE', { exact: true })).toBeVisible();
});

test('list errors can be retried', async ({ page }) => {
  await setup(page, { failList: true });
  await expect(page.getByRole('alert')).toContainText('Máy chủ đang bảo trì');
  await page.unroute(`${endpoint}**`);
  await page.route(`${endpoint}**`, (route) => route.fulfill({ json: { content: [], totalPages: 0, totalElements: 0 } }));
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Chưa có người dùng.')).toBeVisible();
});

test('non-admins cannot load admin data', async ({ page }) => {
  let requests = 0;
  await page.route(`${endpoint}**`, (route) => { requests++; return route.fulfill({ json: {} }); });
  await login(page, ['ORGANIZER']);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
  expect(requests).toBe(0);
});

test('guests go to login', async ({ page }) => {
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/login$/);
});

test('preview works without making admin API requests', async ({ page }) => {
  let requests = 0;
  await page.route(`${endpoint}**`, (route) => { requests++; return route.abort(); });
  await page.goto('/admin/users/preview');
  await expect(page.getByText('Nguyễn Văn A', { exact: true })).toBeVisible();
  await action(page, 'Trần Thị B', 'Cấp vai trò ORGANIZER');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests).toBe(0);
});
