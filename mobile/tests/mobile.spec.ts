import { expect, test, type Page } from "@playwright/test";
const nativeTextErrorsByPage = new WeakMap<Page, string[]>();

const eventId = "11111111-1111-4111-8111-111111111111";
const typeId = "22222222-2222-4222-8222-222222222222";
const ticketId = "33333333-3333-4333-8333-333333333333";
const event = {
  eventId,
  name: "EventPass Live",
  venue: "Nhà hát Thành phố",
  startsAt: "2026-12-20T12:00:00Z",
  endsAt: "2026-12-20T16:00:00Z",
  status: "PUBLISHED",
  description: "Đêm nhạc kết nối những trải nghiệm.",
};
const profile = {
  id: "buyer",
  fullName: "Người mua thử",
  email: "buyer@example.com",
  roles: ["USER"],
  emailVerified: true,
  status: "ACTIVE",
};
const ticket = {
  ticketId,
  eventId,
  ticketTypeId: typeId,
  holderName: profile.fullName,
  holderEmail: profile.email,
  status: "ISSUED",
  qrPayload: "signed-ticket-payload",
  priceCents: 25000000,
  validFrom: event.startsAt,
  validUntil: event.endsAt,
};

test.beforeEach(async ({ page }) => {
  const nativeTextErrors: string[] = [];
  nativeTextErrorsByPage.set(page, nativeTextErrors);
  page.on("console", (message) => {
    if (message.text().includes("Unexpected text node"))
      nativeTextErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
      return;
    }
    let body: unknown;
    if (path === "/api/user/login")
      body = {
        accessToken: "test-access-token",
        refreshToken: "test-refresh-token",
      };
    else if (path === "/api/user/me") body = profile;
    else if (path === "/api/user/register") body = profile;
    else if (path === "/api/event") body = [event];
    else if (path === `/api/event/${eventId}`) body = event;
    else if (path.endsWith("/ticket-types"))
      body = [
        {
          ticketTypeId: typeId,
          name: "Tiêu chuẩn",
          priceCents: 25000000,
          remaining: 50,
          quota: 100,
          bundleSize: 1,
          maxEntries: 1,
        },
      ];
    else if (path.endsWith("/quote"))
      body = {
        grossCents: 25000000 * Number(url.searchParams.get("quantity")),
        discountCents: 0,
        totalCents: 25000000 * Number(url.searchParams.get("quantity")),
      };
    else if (path.endsWith("/reservations"))
      body = {
        reservationId: "reservation-one",
        tickets: [
          {
            ...ticket,
            status: "RESERVED",
            reservationExpiresAt: "2026-12-20T12:00:00Z",
          },
        ],
        totalCents: 25000000,
        discountCents: 0,
      };
    else if (path === "/api/my/tickets")
      body = { content: [ticket], totalPages: 1, totalElements: 1 };
    else if (path === "/api/my/waitlist")
      body = [
        {
          entryId: "entry-one",
          ticketTypeId: typeId,
          status: "WAITING",
          quantity: 1,
        },
      ];
    else if (path === `/api/ticket/${ticketId}`) body = ticket;
    else if (path === "/api/manage/events") {
      await route.fulfill({
        status: 403,
        json: { message: "Forbidden" },
        headers: { "access-control-allow-origin": "*" },
      });
      return;
    } else {
      await route.fulfill({
        status: 404,
        json: { message: `Unexpected API: ${method} ${path}` },
        headers: { "access-control-allow-origin": "*" },
      });
      return;
    }
    await route.fulfill({
      json: body,
      headers: { "access-control-allow-origin": "*" },
    });
  });
});

test.afterEach(async ({ page }) => {
  expect(nativeTextErrorsByPage.get(page)).toEqual([]);
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("EventPass Live", { exact: true })).toBeVisible();
}

test("ticket pagination can reach tickets beyond the first backend page", async ({
  page,
}) => {
  await page.route("**/api/my/tickets?**", (route) => {
    const second =
      new URL(route.request().url()).searchParams.get("page") === "1";
    return route.fulfill({
      json: {
        content: [
          {
            ...ticket,
            holderName: second ? "Người giữ vé trang hai" : profile.fullName,
          },
        ],
        totalPages: 2,
        totalElements: 21,
      },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await login(page);
  await page.goto("/tickets");
  await expect(page.getByText(profile.fullName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sau →", exact: true }).click();
  await expect(page.getByText("Người giữ vé trang hai")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sau →", exact: true }),
  ).toBeDisabled();
});

test("organizer can create a ticket type with cents and bundle rules", async ({
  page,
}) => {
  await page.route("**/api/user/me", (route) =>
    route.fulfill({
      json: { ...profile, roles: ["USER", "ORGANIZER"] },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("**/api/manage/events", (route) =>
    route.fulfill({
      json: [event],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route(`**/api/event/${eventId}/ticket-types`, (route) =>
    route.fulfill({
      json:
        route.request().method() === "POST"
          ? { ticketTypeId: typeId }
          : [
              {
                ticketTypeId: typeId,
                name: "Tiêu chuẩn",
                priceCents: 25000000,
                remaining: 50,
                quota: 100,
                bundleSize: 1,
                maxEntries: 1,
              },
            ],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await login(page);
  await page.goto(`/manage/${eventId}`);
  await page.getByRole("button", { name: "Loại vé", exact: true }).click();
  await page.getByLabel("Tên loại vé").fill("Gói gia đình");
  await page.getByLabel("Giá mỗi đơn vị (VNĐ)").fill("500000");
  await page.getByLabel("Hạn ngạch", { exact: true }).fill("100");
  await page.getByLabel("Số vé trong gói (1–20)").fill("4");
  await page.getByLabel("Số lượt vào cửa (1–50)").fill("2");
  const create = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().endsWith("/ticket-types"),
  );
  await page.getByRole("button", { name: "Tạo loại vé", exact: true }).click();
  expect((await create).postDataJSON()).toMatchObject({
    name: "Gói gia đình",
    priceCents: 50000000,
    quota: 100,
    bundleSize: 4,
    maxEntries: 2,
    validFrom: event.startsAt,
    validUntil: event.endsAt,
  });
  await expect(page.getByText("Đã lưu thay đổi.")).toBeVisible();
});

test("check-in retries a persisted attempt with the same idempotency key", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  await page.route("**/api/checkin", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    bodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: bodies.length === 1 ? 503 : 200,
      json:
        bodies.length === 1
          ? { message: "Máy chủ tạm gián đoạn" }
          : {
              ticketId,
              outcome: "ACCEPTED",
              entryNo: 1,
              serverReceivedAt: event.startsAt,
            },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/checkin");
  await page.getByLabel("Khóa thiết bị").fill("test-device-key");
  await page.getByLabel("Nội dung mã QR").fill("signed-ticket-payload");
  await page.getByRole("button", { name: "Kiểm tra vé", exact: true }).click();
  await expect(page.getByText("Máy chủ tạm gián đoạn")).toBeVisible();
  await page.reload();
  await expect(page.getByText("CHỜ MÁY CHỦ XÁC NHẬN")).toBeVisible();
  await page.getByLabel("Khóa thiết bị").fill("test-device-key");
  await page
    .getByRole("button", { name: "Thử lại lượt quét", exact: true })
    .click();
  await expect(page.getByText("VÉ HỢP LỆ", { exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
});

test("discovery renders the backend array and search filters through the API", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("EventPass Live", { exact: true })).toBeVisible();
  await expect(page.getByText("Không tìm thấy sự kiện phù hợp.")).toHaveCount(
    0,
  );
  await page.getByLabel("Tìm kiếm sự kiện").fill("Live");
  const search = page.waitForRequest((request) =>
    request.url().includes("/api/event?q=Live"),
  );
  await page.getByRole("button", { name: "Tìm kiếm →", exact: true }).click();
  await search;
  await expect(page.getByText("Kết quả: Live")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/discovery-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("login returns to event, reserves with authoritative quote, and shows QR ticket", async ({
  page,
}) => {
  await page.goto(`/events/${eventId}`);
  await page.getByRole("button", { name: "Đăng nhập để đặt vé" }).click();
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByLabel("Họ tên người nhận vé")).toHaveValue(
    profile.fullName,
  );
  const reservation = page.waitForRequest((request) =>
    request.url().endsWith("/reservations"),
  );
  await page.getByRole("button", { name: "Giữ vé", exact: true }).click();
  expect((await reservation).postDataJSON()).toEqual({
    quantity: 1,
    holderName: profile.fullName,
    holderEmail: profile.email,
  });
  await expect(page.getByText("Đã giữ vé", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Chức năng thanh toán trên mobile chưa được hỗ trợ.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Xem vé của tôi", exact: true })
    .click();
  await page.getByRole("button", { name: "Xem vé & mã QR" }).click();
  await expect(
    page.getByText("Chuyển nhượng vé", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Mã QR vé", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/ticket-mobile.png",
    fullPage: true,
  });
});

test("failed quote blocks reservation and does not fabricate discounts", async ({
  page,
}) => {
  await page.route("**/api/ticket-types/*/quote?**", (route) =>
    route.fulfill({
      status: 400,
      json: { message: "Mã ưu đãi không hợp lệ" },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("EventPass Live", { exact: true })).toBeVisible();
  await page.goto(`/events/${eventId}`);
  await expect(page.getByText("Mã ưu đãi không hợp lệ")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Giữ vé", exact: true }),
  ).toBeDisabled();
});

test("anonymous and buyer accounts cannot access management routes", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page.getByText("Chào bạn đến EventPass")).toBeVisible();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("EventPass Live", { exact: true })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
});
