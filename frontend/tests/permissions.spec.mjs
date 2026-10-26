import { test, expect } from '@playwright/test';

const baseUser = { email: 'user@example.com', fullName: 'Người dùng', emailVerified: true };
const adminPaths = ['/admin', '/admin/users', '/admin/devices', '/admin/payments'];
const managePaths = ['/manage', '/manage/events/00000000-0000-4000-8000-000000000001'];

async function setup(page, roles, profileRoles = roles) {
  const requests = [];
  await page.addInitScript((user) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('access_token', 'test-token');
  }, { ...baseUser, roles });
  await page.route('http://localhost:8091/api/**', (route) => {
    if (route.request().method() !== 'OPTIONS') requests.push(route.request().url());
    return route.fulfill({ json: [] });
  });
  await page.route('http://localhost:8087/api/user/me', (route) => route.fulfill({ json: { ...baseUser, roles: profileRoles } }));
  await page.route('http://localhost:8087/api/user/admin/users**', (route) => route.fulfill({ json: { content: [], totalPages: 0, totalElements: 0 } }));
  return requests;
}

for (const roles of [['USER'], ['ORGANIZER'], ['ADMIN'], []]) {
  test(`menu visibility matches roles ${JSON.stringify(roles)} on desktop and mobile`, async ({ page }) => {
    await setup(page, roles);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/home');
      await expect(page.getByRole('heading', { name: /Những sự kiện/ })).toBeVisible();
      for (const path of adminPaths.filter((path) => path !== '/admin')) {
        const links = page.locator(`header a[href="${path}"]`);
        await expect(links).toHaveCount(0);
      }
      const adminLink = page.locator('header a[href="/admin"]');
      if (roles.includes('ADMIN')) await expect(adminLink.filter({ visible: true })).toHaveCount(1);
      else await expect(adminLink).toHaveCount(0);
      const management = page.locator('header a[href="/manage"]');
      if (roles.includes('ADMIN') || roles.includes('ORGANIZER')) await expect(management.filter({ visible: true })).toHaveCount(1);
      else await expect(management).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

for (const roles of [['USER'], ['ORGANIZER'], []]) {
  test(`direct restricted URLs do not mount pages or request data for ${JSON.stringify(roles)}`, async ({ page }) => {
    const requests = await setup(page, roles);
    for (const path of [...adminPaths, ...(roles.includes('ORGANIZER') ? [] : managePaths)]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible();
      await expect(page.getByRole('button')).toHaveCount(0);
    }
    expect(requests).toEqual([]);
  });
}

test('organizer retains event management without platform administration', async ({ page }) => {
  const requests = await setup(page, ['ORGANIZER']);
  await page.goto('/manage');
  await expect(page.getByRole('heading', { name: 'Quản lý sự kiện', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo sự kiện mới' })).toBeEnabled();
  expect(requests.some((url) => url.endsWith('/api/manage/events'))).toBe(true);
  await expect(page.locator('a[href^="/admin/"]')).toHaveCount(0);
});

test('one system administration link opens persistent vertical navigation across all admin pages', async ({ page }) => {
  await setup(page, ['ADMIN']);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/home');
    await page.getByRole('link', { name: 'Quản trị hệ thống', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    const sidebar = page.getByRole('navigation', { name: 'Các mục quản trị hệ thống', exact: true });
    await expect(sidebar.getByRole('link')).toHaveCount(3);
    for (const [path, label, title] of [['devices', 'Quản trị thiết bị', 'Quản trị thiết bị toàn cầu'], ['payments', 'Quản trị giao dịch', 'Quản trị giao dịch & Hoàn tiền'], ['users', 'Quản trị người dùng', 'Quản trị người dùng']]) {
      await sidebar.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/${path}$`));
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
      await expect(page.locator('header a[href="/admin"]').filter({ visible: true })).toHaveAttribute('aria-current', 'page');
    }
    const boxes = await sidebar.getByRole('link').evaluateAll((links) => links.map((link) => { const { x, y } = link.getBoundingClientRect(); return { x, y }; }));
    expect(boxes[0].x).toBe(boxes[1].x); expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
    await page.reload();
    await expect(sidebar.getByRole('link', { name: 'Quản trị người dùng' })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `tmp/admin-navigation-${width > 700 ? 'desktop' : 'mobile'}.png`, fullPage: true });
  }
});

test('profile cannot expose admin links from a different profile role snapshot', async ({ page }) => {
  await setup(page, ['USER'], ['ADMIN']);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeVisible();
  await expect(page.locator('a[href^="/admin/"]')).toHaveCount(0);
  await expect(page.locator('a[href="/manage"]')).toHaveCount(0);
});

test('checkin keeps device login but hides event management from buyers', async ({ page }) => {
  await setup(page, ['USER']);
  await page.goto('/checkin');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('a[href="/manage"]')).toHaveCount(0);
});

test('restricted URLs preserve login redirect for anonymous visitors', async ({ page }) => {
  for (const path of [...adminPaths, ...managePaths]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});
