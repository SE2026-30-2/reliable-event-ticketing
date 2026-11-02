import { test, expect } from '@playwright/test';

const event = { eventId: 'event-14', name: 'Sự kiện kiểm thử', venue: 'Hà Nội', description: 'Mô tả ban đầu', status: 'PUBLISHED', startsAt: '2027-12-20T12:00:00Z', endsAt: '2027-12-20T16:00:00Z', bannerUrl: '' };
async function setup(page, options = {}) {
  const mutations = [];
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'screen14-token');
    localStorage.setItem('user', JSON.stringify({ email: 'organizer@example.test', fullName: 'Organizer', roles: ['ORGANIZER'] }));
  });
  await page.route('http://localhost:8091/**', async (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (path === '/api/manage/events') return route.fulfill({ json: [event, { ...event, eventId: 'completed', name: 'Sự kiện đã kết thúc', status: 'COMPLETED' }] });
    if (path.endsWith('/ticket-types')) return route.fulfill({ json: [{ issuedCount: 1, quota: 10 }] });
    if (['POST', 'PATCH'].includes(req.method())) {
      mutations.push({ method: req.method(), body: req.postDataJSON() });
      if (options.wait) await options.wait;
      return route.fulfill({ json: { ...event, ...req.postDataJSON() } });
    }
    return route.fulfill({ status: 404 });
  });
  await page.goto('/manage');
  await expect(page.getByRole('heading', { name: 'Quản lý sự kiện', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: event.name, exact: true })).toBeVisible();
  return mutations;
}

test('screen 14 filters completed events and does not offer mutations on final states', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Đã kết thúc (1)', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sự kiện đã kết thúc', exact: true })).toBeVisible();
  await expect(page.getByLabel('Thao tác với Sự kiện đã kết thúc')).toHaveCount(0);
  await expect(page.getByRole('link', { name: event.name, exact: true })).toHaveCount(0);
});

test('screen 14 preserves descriptions longer than 1000 characters when editing', async ({ page }) => {
  const mutations = await setup(page);
  await page.getByLabel(`Thao tác với ${event.name}`).click();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const description = 'Nội dung sự kiện. '.repeat(100);
  await page.getByLabel('Mô tả sự kiện', { exact: false }).fill(description);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText('Đã lưu sự kiện đã xuất bản.')).toBeVisible();
  expect(mutations[0].body.description).toBe(description);
  expect(mutations[0].body.status).toBeUndefined();
});

test('screen 14 sends one cancellation after confirmation and blocks repeated submission', async ({ page }) => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const mutations = await setup(page, { wait });
  await page.getByLabel(`Thao tác với ${event.name}`).click();
  await page.getByRole('button', { name: 'Hủy sự kiện', exact: true }).click();
  expect(mutations).toHaveLength(0);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Hủy sự kiện', exact: true }).dblclick();
  await expect(dialog.getByRole('button', { name: 'Đang hủy…', exact: true })).toBeDisabled();
  expect(mutations).toHaveLength(1);
  release();
  await expect(page.getByText('Đã hủy sự kiện.', { exact: true })).toBeVisible();
  expect(mutations[0].body).toEqual({ status: 'CANCELLED' });
});
