import { expect, test, type Page } from "@playwright/test";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyOffline, type Certificate } from "../src/lib/checkin-crypto";
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
const reservationId = "44444444-4444-4444-8444-444444444444";
const payment = {
  paymentRequestId: "55555555-5555-4555-8555-555555555555",
  reservationId,
  amountCents: 25000000,
  status: "PENDING",
  provider: "VNPAY",
  txnRef: "test-transaction",
  paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1",
  createdAt: "2026-11-01T00:00:00Z",
};

async function mockReserved(page: Page) {
  await page.route("**/api/my/tickets?**", (route) =>
    route.fulfill({
      json: {
        content: [
          {
            ...ticket,
            reservationId,
            status: "RESERVED",
            reservationExpiresAt: new Date(Date.now() + 600000).toISOString(),
          },
        ],
        totalPages: 1,
        totalElements: 1,
      },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
}

test("checkout creates a payment, keeps pending distinct, and verifies completion", async ({
  page,
}) => {
  await login(page);
  await mockReserved(page);
  let created = false;
  await page.route("**/api/payment/**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/payment/requests") {
      expect(route.request().postDataJSON()).toEqual({ reservationId });
      created = true;
    }
    const sync = path.includes("/sync/");
    return route.fulfill({
      status: !created && !sync ? 404 : 200,
      json:
        !created && !sync
          ? { message: "Not found" }
          : { ...payment, status: sync ? "COMPLETED" : "PENDING" },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(`/checkout/${reservationId}`);
  await page
    .getByRole("button", { name: "Xác nhận thanh toán", exact: true })
    .click();
  await expect(
    page.getByText("Đang chờ thanh toán", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Thanh toán thành công", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mở cổng thanh toán VNPay", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Kiểm tra trạng thái thanh toán",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Thanh toán thành công", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("free and mock completion uses the server amount without a forced outcome", async ({
  page,
}) => {
  await login(page);
  await mockReserved(page);
  await page.route("**/api/payment/**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    const create = route.request().method() === "POST";
    if (create)
      expect(route.request().postDataJSON()).toEqual({ reservationId });
    return route.fulfill({
      status: create ? 201 : 404,
      json: create
        ? {
            ...payment,
            provider: "MOCK",
            status: "COMPLETED",
            amountCents: 0,
            txnRef: null,
            paymentUrl: null,
          }
        : { message: "Not found" },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(`/checkout/${reservationId}`);
  await page
    .getByRole("button", { name: "Xác nhận thanh toán", exact: true })
    .click();
  await expect(
    page.getByText("Thanh toán thành công", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tổng thanh toán: 0", { exact: false }),
  ).toBeVisible();
});

test("callback success code cannot override a pending or failed backend verdict", async ({
  page,
}) => {
  await login(page);
  let status = "PENDING";
  await page.route("**/api/payment/vnpay/sync/**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    return route.fulfill({
      json: { ...payment, status },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(
    "/payment-result?vnp_TxnRef=test-transaction&vnp_ResponseCode=00",
  );
  await expect(
    page.getByText("Đang chờ xác nhận", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Kết quả đang chờ xác nhận", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Thanh toán thành công", { exact: true }),
  ).toHaveCount(0);
  status = "FAILED";
  await page.reload();
  await expect(page.getByText("FAILED", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Kết quả không thành công", exact: true }),
  ).toBeVisible();
  await page.goto("/payment-result?vnp_ResponseCode=00");
  await expect(
    page.getByText("Thiếu mã giao dịch.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Thanh toán thành công", { exact: true }),
  ).toHaveCount(0);
});

test("lost payment response requires status lookup before another create", async ({
  page,
}) => {
  await login(page);
  await mockReserved(page);
  let attempted = false;
  await page.route("**/api/payment/**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    if (route.request().method() === "POST") {
      attempted = true;
      return route.abort("failed");
    }
    return route.fulfill({
      status: attempted ? 200 : 404,
      json: attempted ? payment : { message: "Not found" },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(`/checkout/${reservationId}`);
  await page
    .getByRole("button", { name: "Xác nhận thanh toán", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Xác nhận thanh toán", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Kiểm tra trạng thái thanh toán",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Đang chờ thanh toán", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận thanh toán", exact: true }),
  ).toHaveCount(0);
});

test("account recovery submits backend contracts and validates password confirmation", async ({
  page,
}) => {
  const bodies: { path: string; body: unknown }[] = [];
  await page.route(
    /\/api\/user\/(password\/(forgot|reset)|email\/verify)$/,
    (route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      expect(route.request().headers().authorization).toBeUndefined();
      bodies.push({
        path: new URL(route.request().url()).pathname,
        body: route.request().postDataJSON(),
      });
      return route.fulfill({
        status: 204,
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Quên mật khẩu", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Quên mật khẩu", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(profile.email);
  await page
    .getByRole("button", { name: "Gửi hướng dẫn", exact: true })
    .click();
  await expect(
    page.getByText("Nếu email tồn tại", { exact: false }),
  ).toBeVisible();
  await page.goto("/reset-password?token=reset-token-from-email");
  await expect(page.getByLabel("Token từ email", { exact: true })).toHaveValue(
    "reset-token-from-email",
  );
  await page
    .getByLabel("Mật khẩu mới", { exact: true })
    .fill("new-password-123");
  await page
    .getByLabel("Xác nhận mật khẩu mới", { exact: true })
    .fill("different-password");
  await page
    .getByRole("button", { name: "Lưu mật khẩu mới", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .getByText("Mật khẩu cần ít nhất 8 ký tự", { exact: false }),
  ).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page
    .getByLabel("Xác nhận mật khẩu mới", { exact: true })
    .fill("new-password-123");
  await page
    .getByRole("button", { name: "Lưu mật khẩu mới", exact: true })
    .click();
  await expect(
    page.getByText("Đã đặt lại mật khẩu.", { exact: false }),
  ).toBeVisible();
  await page.goto("/verify-email?token=verify-token-from-email");
  await page
    .getByRole("button", { name: "Xác minh email", exact: true })
    .click();
  await expect(
    page.getByText("Xác minh email thành công.", { exact: true }),
  ).toBeVisible();
  expect(bodies).toEqual([
    { path: "/api/user/password/forgot", body: { email: profile.email } },
    {
      path: "/api/user/password/reset",
      body: {
        token: "reset-token-from-email",
        newPassword: "new-password-123",
      },
    },
    {
      path: "/api/user/email/verify",
      body: { token: "verify-token-from-email" },
    },
  ]);
});

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const cert: Certificate = {
  jwks: {
    keys: [
      {
        ...keys.publicKey.export({ format: "jwk" }),
        kid: "test-key",
        kty: "RSA",
      } as Certificate["jwks"]["keys"][number],
    ],
  },
  updatedAt: new Date().toISOString(),
};
const claims = {
  tid: ticketId,
  eid: eventId,
  tt: typeId,
  vf: Math.floor(Date.now() / 1000) - 60,
  vu: Math.floor(Date.now() / 1000) + 3600,
  me: 1,
};
function signedPayload(value = claims) {
  const data = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `test-key.${data}.${sign("RSA-SHA256", Buffer.from(data), keys.privateKey).toString("base64url")}`;
}

test("offline RSA verifier rejects tampering, wrong events, invalid windows and unknown keys", () => {
  const payload = signedPayload();
  expect(verifyOffline(payload, cert, eventId).outcome).toBe("ACCEPTED");
  expect(verifyOffline(payload, cert, typeId).outcome).toBe("WRONG_EVENT");
  expect(
    verifyOffline(payload, cert, eventId, (claims.vu + 1) * 1000).outcome,
  ).toBe("EXPIRED_WINDOW");
  expect(
    verifyOffline(signedPayload({ ...claims, tid: "invalid" }), cert, eventId)
      .outcome,
  ).toBe("INVALID_SIGNATURE");
  expect(
    verifyOffline(payload.replace("test-key", "unknown-key"), cert, eventId)
      .outcome,
  ).toBe("PENDING");
  const parts = payload.split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...claims, me: 1000 })).toString(
    "base64url",
  );
  expect(verifyOffline(parts.join("."), cert, eventId).outcome).toBe(
    "INVALID_SIGNATURE",
  );
});

test("checkout blocks expired reservations and finds a waitlist offer beyond the first page", async ({
  page,
}) => {
  await login(page);
  let expired = true;
  await page.route("**/api/my/tickets?**", (route) => {
    const second =
      new URL(route.request().url()).searchParams.get("page") === "1";
    return route.fulfill({
      json: {
        content: second
          ? [
              {
                ...ticket,
                reservationId,
                status: "RESERVED",
                reservationExpiresAt: new Date(
                  Date.now() + (expired ? -60000 : 600000),
                ).toISOString(),
              },
            ]
          : [{ ...ticket, reservationId: "different-order" }],
        totalPages: 2,
        totalElements: 2,
      },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto(`/checkout/${reservationId}`);
  await expect(
    page.getByText("Không có vé đang giữ hoặc đã hết hạn giữ vé."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận thanh toán", exact: true }),
  ).toHaveCount(0);
  expired = false;
  await page.route("**/api/my/waitlist", (route) =>
    route.fulfill({
      json: [
        {
          entryId: "offer-one",
          ticketTypeId: typeId,
          quantity: 1,
          status: "OFFERED",
          reservationId,
        },
      ],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/tickets");
  await page
    .getByRole("button", { name: "Danh sách chờ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Thanh toán vé được mời", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Xác nhận thanh toán", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Số vé: 1", { exact: true })).toBeVisible();
});

test("legacy pending scan migrates and an incomplete batch never removes it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("EventPass Live", { exact: true })).toBeVisible();
  const oldBody = {
    qrPayload: "legacy-payload",
    idempotencyKey: "legacy-idempotency-key",
    clientCheckinAt: event.startsAt,
  };
  await page.evaluate(
    async ({ oldBody }) => {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("legacy-device"),
      );
      const device = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      sessionStorage.setItem(
        "eventpass.pending-scan",
        JSON.stringify({ device, body: oldBody }),
      );
    },
    { oldBody },
  );
  const attempts: unknown[] = [];
  await page.route("**/api/checkin/batch", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    attempts.push(route.request().postDataJSON());
    return route.fulfill({
      json: [],
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/checkin");
  await page
    .getByRole("button", { name: "Cài đặt thiết bị", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tự đồng bộ: Bật", exact: true })
    .click();
  await page.getByLabel("Khóa thiết bị", { exact: true }).fill("legacy-device");
  await expect(page.getByText("CHỜ ĐỒNG BỘ: 1", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Đồng bộ lượt quét", exact: true })
    .click();
  await expect(
    page.getByText("Phản hồi đồng bộ không đầy đủ. Giữ lại hàng đợi."),
  ).toBeVisible();
  await expect(page.getByText("CHỜ ĐỒNG BỘ: 1", { exact: true })).toBeVisible();
  expect(attempts).toEqual([[oldBody]]);
  expect(
    await page.evaluate(() => sessionStorage.getItem("eventpass.pending-scan")),
  ).toBeNull();
});

test("offline signed scans persist, detect duplicates and keep device queues separate", async ({
  page,
}) => {
  await page.route("**/.well-known/jwks.json", (route) =>
    route.fulfill({
      json: cert.jwks,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("**/api/checkin", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    return route.fulfill({
      status: 503,
      json: { message: "Offline test" },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/checkin");
  await page
    .getByRole("button", { name: "Cài đặt thiết bị", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tự đồng bộ: Bật", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cập nhật chứng thư offline", exact: true })
    .click();
  await expect(
    page.getByText("Đã lưu chứng thư xác minh chữ ký QR."),
  ).toBeVisible();
  await page.getByLabel("Khóa thiết bị", { exact: true }).fill("device-a");
  await page.getByLabel("Mã sự kiện để kiểm tra offline").fill(eventId);
  await page.getByLabel("Nội dung mã QR").fill(signedPayload());
  await page.getByRole("button", { name: "Kiểm tra vé", exact: true }).click();
  await expect(
    page.getByText("Chữ ký hợp lệ · Tạm chấp nhận", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Nội dung mã QR").fill(signedPayload());
  await page.getByRole("button", { name: "Kiểm tra vé", exact: true }).click();
  await expect(
    page.getByText("KHÔNG CHẤP NHẬN", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("CHỜ ĐỒNG BỘ: 2", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Cài đặt thiết bị", exact: true })
    .click();
  await expect(page.getByLabel("Khóa thiết bị", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Khóa thiết bị", { exact: true }).fill("device-b");
  await expect(page.getByText("CHỜ ĐỒNG BỘ: 0", { exact: true })).toBeVisible();
  await page.getByLabel("Khóa thiết bị", { exact: true }).fill("device-a");
  await expect(page.getByText("CHỜ ĐỒNG BỘ: 2", { exact: true })).toBeVisible();
});

test.beforeEach(async ({ page }) => {
  const nativeTextErrors: string[] = [];
  nativeTextErrorsByPage.set(page, nativeTextErrors);
  page.on("pageerror", (error) => nativeTextErrors.push(error.message));
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
    else if (path.endsWith("/report"))
      body = {
        generatedAt: event.startsAt,
        ticketTypes: [],
        totals: {
          ticketsIssued: 1,
          checkedIn: 0,
          noShow: 1,
          netRevenueCents: 0,
          collectedCents: 0,
          refundedCents: 0,
        },
      };
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
    validFrom: new Date(event.startsAt).toISOString(),
    validUntil: new Date(event.endsAt).toISOString(),
  });
  await expect(page.getByText("Đã lưu thay đổi.")).toBeVisible();
});

test("check-in retries a persisted attempt with the same idempotency key", async ({
  page,
}) => {
  const bodies: unknown[] = [];
  await page.route(/\/api\/checkin(?:\/batch)?$/, (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    const body = route.request().postDataJSON();
    bodies.push(Array.isArray(body) ? body[0] : body);
    return route.fulfill({
      status: bodies.length === 1 ? 503 : 200,
      json:
        bodies.length === 1
          ? { message: "Máy chủ tạm gián đoạn" }
          : [
              {
                ticketId,
                outcome: "ACCEPTED",
                entryNo: 1,
                serverReceivedAt: event.startsAt,
              },
            ],
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/checkin");
  await page
    .getByRole("button", { name: "Cài đặt thiết bị", exact: true })
    .click();
  await page
    .getByLabel("Khóa thiết bị", { exact: true })
    .fill("test-device-key");
  await page.getByLabel("Nội dung mã QR").fill("signed-ticket-payload");
  await page.getByRole("button", { name: "Kiểm tra vé", exact: true }).click();
  await expect(page.getByText("Máy chủ tạm gián đoạn")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Cài đặt thiết bị", exact: true })
    .click();
  await page
    .getByLabel("Khóa thiết bị", { exact: true })
    .fill("test-device-key");
  await expect(page.getByText("CHỜ ĐỒNG BỘ: 1", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Đồng bộ lượt quét", exact: true })
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
    page.getByRole("button", { name: "Tiếp tục thanh toán", exact: true }),
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
  await expect(page.getByText("Chào bạn đến EventHub")).toBeVisible();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(profile.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("EventPass Live", { exact: true })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByText("Không có quyền truy cập")).toBeVisible();
});
