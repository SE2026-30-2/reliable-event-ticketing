import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

// Local API fixtures for reproducible layout review, never shipped in the app.
const eventId = "11111111-1111-4111-8111-111111111111";
const typeId = "22222222-2222-4222-8222-222222222222";
const ticketId = "33333333-3333-4333-8333-333333333333";
const reservationId = "44444444-4444-4444-8444-444444444444";
const paymentId = "55555555-5555-4555-8555-555555555555";
const profile = {
  id: "review-admin",
  fullName: "Nguyễn Minh Anh",
  email: "minhanh@example.com",
  roles: ["ADMIN"],
  status: "ACTIVE",
  emailVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
};
const event = {
  eventId,
  name: "The Dreams Concert 2026",
  venue: "Sân vận động Quốc gia Mỹ Đình, Hà Nội",
  startsAt: "2026-12-20T12:00:00Z",
  endsAt: "2026-12-20T16:00:00Z",
  status: "PUBLISHED",
  bannerUrl: "http://localhost:8082/design-concert.jpg",
  description:
    "Đại nhạc hội kết nối những trải nghiệm. Cùng tận hưởng âm nhạc và những khoảnh khắc đáng nhớ.",
};
const ticket = {
  ticketId,
  eventId,
  ticketTypeId: typeId,
  reservationId: "issued-reservation",
  holderName: profile.fullName,
  holderEmail: profile.email,
  status: "ISSUED",
  priceCents: 25000000,
  qrPayload: "eventhub-layout-review-qr",
  validFrom: event.startsAt,
  validUntil: event.endsAt,
};
const payment = {
  paymentRequestId: paymentId,
  reservationId,
  amountCents: 25000000,
  provider: "VNPAY",
  status: "COMPLETED",
  txnRef: "layout-review",
  createdAt: "2026-11-02T01:00:00Z",
  completedAt: "2026-11-02T01:01:00Z",
};

test("all 18 reference screens render at phone width without overflow or runtime errors", async ({
  page,
}) => {
  test.setTimeout(240000);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "eventpass.tokens",
      JSON.stringify({ accessToken: "local-layout-review" }),
    ),
  );
  await page.route("**/design-concert.jpg", (route) =>
    route.fulfill({
      path: resolve("assets/eventhub/concert.jpg"),
      contentType: "image/jpeg",
    }),
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    let body: unknown;
    if (path === "/api/user/me") body = profile;
    else if (path === "/api/user/login")
      body = { accessToken: "local-layout-review" };
    else if (
      path === "/api/user/email/verify" ||
      path === "/api/user/password/forgot"
    )
      return route.fulfill({ status: 204, headers });
    else if (path === "/api/event" || path === "/api/manage/events")
      body = [
        event,
        {
          ...event,
          eventId: "second-event",
          name: "Workshop Tổ chức sự kiện 4.0",
          status: "DRAFT",
        },
      ];
    else if (path === `/api/event/${eventId}`) body = event;
    else if (path.endsWith("/ticket-types"))
      body = [
        {
          ticketTypeId: typeId,
          eventId,
          name: "VIP",
          priceCents: 25000000,
          remaining: 120,
          quota: 200,
          maxEntries: 1,
          bundleSize: 1,
        },
        {
          ticketTypeId: "standard",
          eventId,
          name: "Tiêu chuẩn",
          priceCents: 10000000,
          remaining: 250,
          quota: 500,
          maxEntries: 1,
          bundleSize: 1,
        },
      ];
    else if (path.endsWith("/quote"))
      body = { grossCents: 25000000, totalCents: 25000000, discountCents: 0 };
    else if (path === "/api/my/tickets")
      body = {
        content: [
          ticket,
          {
            ...ticket,
            ticketId: "reserved-ticket",
            reservationId,
            status: "RESERVED",
            qrPayload: undefined,
            reservationExpiresAt: new Date(Date.now() + 900000).toISOString(),
          },
        ],
        totalPages: 1,
        totalElements: 2,
      };
    else if (path === `/api/ticket/${ticketId}`) body = ticket;
    else if (path === "/api/my/waitlist")
      body = [
        {
          entryId: "layout-waitlist",
          ticketTypeId: typeId,
          quantity: 2,
          status: "WAITING",
        },
      ];
    else if (path === `/api/payment/requests/by-reservation/${reservationId}`)
      return route.fulfill({
        status: 404,
        json: { message: "Not found" },
        headers,
      });
    else if (path.includes("/sync/") || path.startsWith("/api/admin/payments/"))
      body = payment;
    else if (path === "/api/user/admin/users")
      body = {
        content: [
          profile,
          {
            ...profile,
            id: "organizer",
            fullName: "Trần Quốc Bảo",
            email: "bao@example.com",
            roles: ["ORGANIZER"],
          },
          {
            ...profile,
            id: "buyer",
            fullName: "Lê Hồng Nhung",
            email: "nhung@example.com",
            roles: ["USER"],
          },
        ],
        totalPages: 1,
        totalElements: 3,
      };
    else if (path === "/api/checkin/devices")
      body =
        req.method() === "POST"
          ? {
              deviceId: "new-device",
              apiKey: "layout-review-key-only",
              label: "Cổng B",
              status: "ACTIVE",
            }
          : [
              {
                deviceId: "gate-a",
                label: "Check-in Gate A",
                status: "ACTIVE",
                createdAt: profile.createdAt,
              },
              {
                deviceId: "gate-vip",
                label: "Cửa vào VIP",
                eventId,
                status: "REVOKED",
                createdAt: profile.createdAt,
              },
            ];
    else if (path.endsWith("/report"))
      body = {
        generatedAt: profile.createdAt,
        ticketTypes: [],
        totals: {
          ticketsIssued: 120,
          checkedIn: 84,
          noShow: 36,
          netRevenueCents: 3000000000,
          collectedCents: 3000000000,
          refundedCents: 0,
        },
      };
    else
      return route.fulfill({
        status: 404,
        json: { message: `Unmocked review endpoint: ${path}` },
        headers,
      });
    return route.fulfill({ json: body, headers });
  });
  await mkdir("test-results/eventhub", { recursive: true });
  async function capture(name: string) {
    await expect(
      page.getByText("Đang tải dữ liệu…", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("EventHub", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator("img")
          .evaluateAll((images: HTMLImageElement[]) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `test-results/eventhub/${name}.png`,
      fullPage: false,
      animations: "disabled",
    });
  }
  await page.goto("/login");
  await capture("01-dang-nhap");
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Password123!");
  await page
    .getByRole("button", { name: "Hiện mật khẩu", exact: true })
    .click();
  expect(
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .evaluate((element: HTMLInputElement) => element.type),
  ).toBe("text");
  await page.goto("/register");
  await capture("02-dang-ky");
  await page.goto("/verify-email?token=review-token");
  await page
    .getByRole("button", { name: "Xác minh email", exact: true })
    .click();
  await expect(page.getByText("Email đã được xác minh!")).toBeVisible();
  await capture("03-xac-minh-email");
  await page.goto("/forgot-password");
  await capture("04-quen-mat-khau");
  await page.goto("/reset-password?token=review-token");
  await capture("05-dat-lai-mat-khau");
  await page.goto("/profile");
  await capture("06-ho-so");
  await page.goto("/");
  await capture("07-su-kien");
  await page.goto(`/events/${eventId}`);
  await capture("08-chi-tiet-su-kien");
  await page.goto(`/checkout/${reservationId}`);
  await capture("09-thanh-toan");
  await page.goto("/payment-result?txnRef=layout-review");
  await capture("10-ket-qua");
  await page.goto("/tickets");
  await capture("11-ve-cua-toi");
  await page.goto(`/tickets/${ticketId}`);
  await capture("12-ve-qr");
  await page.goto("/checkin");
  await capture("13-soat-ve");
  await page.goto("/manage");
  await capture("14-quan-ly-su-kien");
  await page
    .getByRole("button", { name: "+ Tạo sự kiện", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Đóng tạo sự kiện mới", exact: true }),
  ).toBeVisible();
  await capture("14b-tao-su-kien");
  await page
    .getByRole("button", { name: "Đóng tạo sự kiện mới", exact: true })
    .click();
  await page.goto(`/manage/${eventId}`);
  await capture("15-quan-tri-su-kien");
  await page.goto("/admin");
  await capture("16-nguoi-dung");
  await page
    .getByRole("button", { name: "Thao tác với Nguyễn Minh Anh", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Khóa tài khoản", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Thiết bị", exact: true }).click();
  await capture("17-thiet-bi");
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await page
    .getByLabel("Mã đặt vé (reservation ID)", { exact: true })
    .fill(reservationId);
  await page
    .getByRole("button", { name: "Tra cứu giao dịch", exact: true })
    .click();
  await expect(
    page.getByText(`Mã giao dịch: ${paymentId}`, { exact: true }),
  ).toBeVisible();
  await capture("18-thanh-toan-quan-tri");
  await page
    .getByRole("button", { name: "Hoàn tiền toàn bộ", exact: true })
    .click();
  await capture("18b-xac-nhan-hoan-tien");
  expect(failures).toEqual([]);
});
