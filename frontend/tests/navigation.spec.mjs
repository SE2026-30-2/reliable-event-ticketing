import { test, expect } from '@playwright/test';

test('unsupported routes show a recovery link instead of a blank page', async ({ page }) => {
  for (const path of ['/history', '/my-tickets', '/checkout/test', '/payment/result', '/verify-email', '/forgot-password', '/reset-password', '/unknown-route']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
  }
  await page.getByRole('link', { name: 'Về trang chủ' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
});

test('public event header has guest actions and local image fallback', async ({ page }) => {
  await page.route('**/api/event/public-test', (route) => route.fulfill({ json: { eventId: 'public-test', name: 'Public event', description: 'Test', startsAt: '2027-01-01T10:00:00Z', endsAt: '2027-01-01T15:00:00Z', status: 'PUBLISHED', bannerUrl: '' } }));
  await page.route('**/api/event/public-test/ticket-types', (route) => route.fulfill({ json: [] }));
  await page.goto('/events/public-test');
  await expect(page.getByRole('heading', { name: 'Public event' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng ký', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toHaveCount(0);
  await expect(page.locator('a[href="/profile"], a[href="/history"], a[href^="/admin/"]')).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'Ảnh bìa mặc định cho Public event', exact: true })).toBeVisible();
});
