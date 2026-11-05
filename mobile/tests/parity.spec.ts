import { expect, test, type Route } from "@playwright/test";

const eid = "11111111-1111-4111-8111-111111111111";
const event = {
  eventId: eid,
  name: "Mobile parity concert",
  venue: "Hà Nội",
  category: "MUSIC",
  startsAt: "2099-12-20T12:00:00Z",
  endsAt: "2099-12-20T16:00:00Z",
  status: "PUBLISHED",
  salesStartAt: "2020-01-01T00:00:00Z",
  salesEndAt: "2099-12-20T12:00:00Z",
};
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
};
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, json: body, headers });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "eventpass.tokens",
      JSON.stringify({ accessToken: "test-token" }),
    ),
  );
  await page.route("**/api/**", (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (path === "/api/user/me")
      return json(route, {
        id: "admin",
        email: "admin@example.test",
        fullName: "Admin",
        roles: ["ADMIN"],
        emailVerified: true,
        status: "ACTIVE",
      });
    if (path === "/api/event")
      return json(route, {
        content: [
          event,
          {
            ...event,
            eventId: "sport",
            name: "Mobile parity sports",
            category: "SPORTS",
          },
        ],
        totalPages: 1,
        totalElements: 2,
      });
    if (path === `/api/event/${eid}`) return json(route, event);
    if (path.endsWith("/views")) return route.fulfill({ status: 204, headers });
    if (path.endsWith("/ticket-types"))
      return json(route, [
        {
          ticketTypeId: "type",
          name: "Standard",
          priceCents: 10000,
          remaining: 10,
          quota: 10,
          maxEntries: 1,
          bundleSize: 1,
        },
      ]);
    if (path.endsWith("/quote"))
      return json(route, {
        grossCents: 10000,
        discountCents: 0,
        totalCents: 10000,
      });
    if (path.endsWith("/report"))
      return json(route, {
        generatedAt: event.startsAt,
        ticketTypes: [],
        totals: {
          ticketsIssued: 1,
          checkedIn: 0,
          noShow: 1,
          netRevenueCents: 10000,
          collectedCents: 10000,
          refundedCents: 0,
        },
      });
    if (path.endsWith("/analytics"))
      return json(route, {
        views: 42,
        timezone: "Asia/Ho_Chi_Minh",
        daily: [{ date: "2026-11-05", ticketsSold: 3, revenueCents: 30000 }],
      });
    return json(route, { message: `Unexpected: ${path}` }, 404);
  });
});

test("discovery filters actual category values and can reset", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(event.name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thể thao", exact: true }).click();
  await expect(page.getByText(event.name, { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Mobile parity sports", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tất cả danh mục", exact: true })
    .click();
  await expect(page.getByText(event.name, { exact: true })).toBeVisible();
});

test("event editing preserves category and schedule, rejects incomplete schedule, and can clear it", async ({
  page,
}) => {
  const writes: Record<string, unknown>[] = [];
  await page.route(`**/api/event/${eid}`, (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const body = route.request().postDataJSON();
    writes.push(body);
    return json(route, { ...event, ...body });
  });
  await page.goto(`/manage/${eid}`);
  await page.getByRole("button", { name: "Thông tin", exact: true }).click();
  await expect(
    page.getByLabel("Ngày giờ mở bán", { exact: false }),
  ).toHaveValue(event.salesStartAt);
  await page.getByRole("button", { name: "Thể thao", exact: true }).click();
  await page.getByLabel("Ngày giờ đóng bán", { exact: false }).fill("");
  await page.getByRole("button", { name: "Lưu sự kiện", exact: true }).click();
  await expect(page.getByText(/Nhập đủ lịch mở bán/)).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.getByLabel("Ngày giờ mở bán", { exact: false }).fill("");
  await page.getByRole("button", { name: "Lưu sự kiện", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({
    category: "SPORTS",
    clearSalesSchedule: true,
  });
  expect(writes[0]).not.toHaveProperty("salesStartAt");
  expect(writes[0]).not.toHaveProperty("salesEndAt");
});

test("banner stays local until save and uses authenticated multipart upload", async ({
  page,
}) => {
  const uploads: string[] = [],
    saves: Record<string, unknown>[] = [];
  await page.route("**/api/manage/event-images", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    expect(route.request().headers().authorization).toBe("Bearer test-token");
    expect(route.request().headers()["content-type"]).toContain(
      "multipart/form-data; boundary=",
    );
    uploads.push(route.request().postData() || "");
    return json(route, { url: `/api/event-images/${eid}` });
  });
  await page.route(`**/api/event/${eid}`, (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    saves.push(route.request().postDataJSON());
    return json(route, { ...event, ...saves.at(-1) });
  });
  await page.goto(`/manage/${eid}`);
  await page.getByRole("button", { name: "Thông tin", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Chọn ảnh bìa từ thiết bị", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "banner.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByRole("button", { name: "Lưu sự kiện", exact: true }),
  ).toBeEnabled();
  expect(uploads).toHaveLength(0);
  await page.getByRole("button", { name: "Lưu sự kiện", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain('name="file"');
  expect(saves[0].bannerUrl).toMatch(new RegExp(`/api/event-images/${eid}$`));
});

for (const [label, schedule, message] of [
  [
    "future",
    { salesStartAt: "2099-12-19T00:00:00Z" },
    "Chưa đến thời gian mở bán.",
  ],
  [
    "closed",
    { salesEndAt: "2020-12-20T00:00:00Z" },
    "Đã hết thời gian mở bán.",
  ],
] as const) {
  test(`booking blocks ${label} sales windows and records one public view`, async ({
    page,
  }) => {
    const views: string[] = [];
    await page.route(`**/api/event/${eid}`, (route) =>
      json(route, { ...event, ...schedule }),
    );
    await page.route(`**/api/event/${eid}/views`, (route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      expect(route.request().headers().authorization).toBeUndefined();
      views.push(route.request().method());
      return route.fulfill({ status: 204, headers });
    });
    await page.goto(`/events/${eid}`);
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Giữ vé", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(page.getByText("Số lượng: 2", { exact: true })).toBeVisible();
    expect(views).toEqual(["POST"]);
  });
}

test("analytics switches date ranges, sends timezone and displays server figures", async ({
  page,
}) => {
  await page.goto(`/manage/${eid}`);
  await expect(
    page.getByText("Lượt xem sự kiện: 42", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Xem số liệu theo ngày", exact: true })
    .click();
  await expect(page.getByText(/2026-11-05: 3 vé/)).toBeVisible();
  const req = page.waitForRequest(
    (r) => new URL(r.url()).searchParams.get("days") === "30",
  );
  await page.getByRole("button", { name: "30 ngày", exact: true }).click();
  expect(new URL((await req).url()).searchParams.get("timezone")).toBeTruthy();
  await expect(
    page.getByText("Vé mua trong kỳ: 3", { exact: true }),
  ).toBeVisible();
});

test("analytics failure does not hide event report and supports retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/analytics?**", (route) =>
    fail
      ? json(route, { message: "Analytics unavailable" }, 503)
      : route.fallback(),
  );
  await page.goto(`/manage/${eid}`);
  await expect(
    page.getByText("Analytics unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(event.name, { exact: true })).toBeVisible();
  fail = false;
  await page
    .getByRole("button", { name: "Làm mới thống kê doanh thu", exact: true })
    .click();
  await expect(
    page.getByText("Lượt xem sự kiện: 42", { exact: true }),
  ).toBeVisible();
});
