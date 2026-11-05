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

test('screen 14 creates an event with category and sales window and can search without accents', async ({ page }) => {
  const mutations = await setup(page);
  await page.getByLabel('Tìm kiếm theo tên hoặc địa điểm').fill('su kien kiem thu');
  await expect(page.getByRole('link', { name: event.name, exact: true })).toBeVisible();
  await page.getByLabel('Tên sự kiện', { exact: false }).fill('Hội thảo mới');
  await page.getByLabel('Danh mục', { exact: false }).selectOption('SEMINAR');
  await page.getByLabel('Mô tả sự kiện', { exact: false }).fill('Mô tả hội thảo');
  await page.getByRole('textbox', { name: 'Địa điểm *', exact: true }).fill('Hà Nội');
  await page.getByLabel('Ngày giờ bắt đầu', { exact: true }).fill('2028-01-01T09:00');
  await page.getByLabel('Ngày giờ kết thúc', { exact: true }).fill('2028-01-01T18:00');
  await page.getByLabel('Ngày giờ mở bán', { exact: true }).fill('2027-12-01T09:00');
  await page.getByLabel('Ngày giờ đóng bán', { exact: true }).fill('2027-12-31T18:00');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByText('Đã lưu bản nháp.', { exact: true })).toBeVisible();
  expect(mutations[0].body).toMatchObject({ category: 'SEMINAR', status: 'DRAFT' });
  expect(mutations[0].body.salesStartAt).toMatch(/Z$/);
  expect(mutations[0].body.salesEndAt).toMatch(/Z$/);
});

test('screen 14 uploads a selected banner before persisting the event and rejects invalid files', async ({ page }) => {
  const mutations = await setup(page);
  await page.getByLabel(`Thao tác với ${event.name}`).click();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const file = page.getByLabel('Tải ảnh bìa', { exact: true });
  await file.setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toContainText('JPG hoặc PNG');
  await page.route('http://localhost:8091/api/manage/event-images', route => route.fulfill({ json: { url: '/api/event-images/11111111-1111-1111-1111-111111111111' } }));
  await file.setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: await page.screenshot() });
  await expect(page.getByAltText('Xem trước ảnh bìa sự kiện')).toHaveAttribute('src', /^data:image\/png/);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  await expect(page.getByText('Đã lưu sự kiện đã xuất bản.', { exact: true })).toBeVisible();
  expect(mutations[0].body.bannerUrl).toBe('http://localhost:8091/api/event-images/11111111-1111-1111-1111-111111111111');
});

async function delayOldBanner(page, stage) {
  await page.addInitScript((stage) => {
    if (stage === 'decode') {
      const original = window.createImageBitmap;
      window.createImageBitmap = async (...args) => {
        if (args[0].name !== 'old.png') return original(...args);
        window.oldBannerStarted = true;
        await new Promise((resolve) => { window.releaseOldBanner = resolve; });
        try { return await original(...args); }
        finally { window.oldBannerFinished = true; }
      };
    } else {
      const OriginalReader = window.FileReader;
      window.FileReader = class extends OriginalReader {
        readAsDataURL(file) {
          if (file.name !== 'old.png') return super.readAsDataURL(file);
          window.oldBannerStarted = true;
          this.addEventListener('loadend', () => { window.oldBannerFinished = true; }, { once: true });
          window.releaseOldBanner = () => super.readAsDataURL(file);
        }
      };
    }
  }, stage);
}

async function finishOldBanner(page) {
  await page.evaluate(() => window.releaseOldBanner());
  await page.waitForFunction(() => window.oldBannerFinished);
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

for (const stage of ['decode', 'read']) {
  test(`screen 14 discards an old ${stage} result when switching to another event form`, async ({ page }) => {
    await delayOldBanner(page, stage);
    const mutations = await setup(page);
    let uploads = 0;
    await page.route('http://localhost:8091/api/manage/event-images', (route) => {
      uploads++;
      return route.fulfill({ json: { url: '/api/event-images/11111111-1111-1111-1111-111111111111' } });
    });
    await page.getByLabel('Tải ảnh bìa', { exact: true }).setInputFiles({ name: 'old.png', mimeType: 'image/png', buffer: await page.screenshot() });
    await page.waitForFunction(() => window.oldBannerStarted);
    await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Xuất bản', exact: true })).toBeDisabled();
    await page.getByLabel(`Thao tác với ${event.name}`).click();
    await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    await finishOldBanner(page);
    await expect(page.getByAltText('Xem trước ảnh bìa sự kiện')).toHaveCount(0);
    await expect(page.getByText('Đang đọc ảnh bìa…', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(page.getByText('Đã lưu sự kiện đã xuất bản.', { exact: true })).toBeVisible();
    expect(mutations[0].body.bannerUrl).toBe('');
    expect(uploads).toBe(0);
  });
}

test('screen 14 resets pending images even when opening the new event form again', async ({ page }) => {
  await delayOldBanner(page, 'decode');
  await setup(page);
  await page.getByLabel('Tải ảnh bìa', { exact: true }).setInputFiles({ name: 'old.png', mimeType: 'image/png', buffer: await page.screenshot() });
  await page.waitForFunction(() => window.oldBannerStarted);
  await page.getByRole('button', { name: 'Tạo sự kiện mới', exact: true }).click();
  await finishOldBanner(page);
  await expect(page.getByAltText('Xem trước ảnh bìa sự kiện')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
});

test('screen 14 keeps the newest image if an older image finishes later', async ({ page }) => {
  await delayOldBanner(page, 'decode');
  await setup(page);
  const file = page.getByLabel('Tải ảnh bìa', { exact: true });
  const buffer = await page.screenshot();
  await file.setInputFiles({ name: 'old.png', mimeType: 'image/png', buffer });
  await page.waitForFunction(() => window.oldBannerStarted);
  await file.setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer });
  const preview = page.getByAltText('Xem trước ảnh bìa sự kiện');
  await expect(preview).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
  await page.getByLabel('Đường dẫn ảnh bìa', { exact: true }).fill('https://example.test/new-banner.png');
  await finishOldBanner(page);
  await expect(preview).toHaveAttribute('src', 'https://example.test/new-banner.png');
  await expect(page.getByLabel('Đường dẫn ảnh bìa', { exact: true })).toHaveValue('https://example.test/new-banner.png');
});
