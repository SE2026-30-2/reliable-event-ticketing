import { expect, test, type Page, type Route } from "@playwright/test";

const eid = "11111111-1111-4111-8111-111111111111";
const typeId = "22222222-2222-4222-8222-222222222222";
const tid = "33333333-3333-4333-8333-333333333333";
const reservationId = "44444444-4444-4444-8444-444444444444";
const paymentId = "55555555-5555-4555-8555-555555555555";
const secondId = "66666666-6666-4666-8666-666666666666";
const event = {
  eventId: eid,
  name: "Sự kiện kiểm thử",
  venue: "Hà Nội",
  status: "PUBLISHED",
  startsAt: "2026-12-20T12:00:00Z",
  endsAt: "2026-12-20T16:00:00Z",
};
const admin = {
  id: "admin",
  email: "admin@example.test",
  fullName: "Quản trị viên",
  roles: ["ADMIN"],
  status: "ACTIVE",
  emailVerified: true,
};
const buyer = {
  id: "buyer",
  email: "buyer@example.test",
  fullName: "Nguyễn Thị An",
  roles: ["USER"],
  status: "ACTIVE",
  emailVerified: false,
  failedLoginAttempts: 2,
};
const payment = {
  paymentRequestId: paymentId,
  reservationId,
  amountCents: 25000000,
  provider: "VNPAY",
  status: "COMPLETED",
  createdAt: "2026-11-01T00:00:00Z",
};
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
};
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, json: body, headers });
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const failures: string[] = [];
  errors.set(page, failures);
  page.on("pageerror", (error) => failures.push(error.message));
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "eventpass.tokens",
      JSON.stringify({ accessToken: "management-token" }),
    ),
  );
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (path === "/api/user/me") return json(route, admin);
    if (path === "/api/user/admin/users")
      return json(route, {
        content: [admin, buyer],
        totalPages: 1,
        totalElements: 2,
      });
    if (path === "/api/user/admin/users/buyer") return json(route, buyer);
    if (path === "/api/manage/events") return json(route, [event]);
    if (path === `/api/event/${eid}`) return json(route, event);
    if (path.endsWith("/report"))
      return json(route, {
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
      });
    if (path.endsWith("/ticket-types"))
      return json(route, [
        {
          ticketTypeId: typeId,
          name: "Tiêu chuẩn",
          remaining: 100,
          quota: 100,
          maxEntries: 1,
          bundleSize: 1,
          priceCents: 25000000,
        },
      ]);
    if (path.endsWith("/coupons")) return json(route, []);
    if (path.endsWith("/tickets"))
      return json(route, {
        content: [
          {
            ticketId: tid,
            eventId: eid,
            holderName: "Người giữ vé",
            holderEmail: "buyer@example.test",
            status: "ISSUED",
          },
        ],
        totalPages: 1,
        totalElements: 1,
      });
    if (path === "/api/checkin/devices") return json(route, []);
    if (path.startsWith("/api/admin/payments/")) return json(route, payment);
    if (path === "/api/checkin")
      return json(route, {
        outcome: "ACCEPTED",
        ticketId: tid,
        serverReceivedAt: event.startsAt,
        entryNo: 1,
      });
    return json(
      route,
      { message: `Unexpected request: ${req.method()} ${path}` },
      404,
    );
  });
});
test.afterEach(({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test("screen 13 clears a previous accepted verdict when the next scan cannot be persisted", async ({
  page,
}) => {
  await page.goto("/checkin");
  await page
    .getByRole("button", { name: "Cài đặt thiết bị", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tự đồng bộ: Bật", exact: true })
    .click();
  await page.getByLabel("Khóa thiết bị", { exact: true }).fill("device");
  await page.getByLabel("Nội dung mã QR").fill("first-payload");
  await page.getByRole("button", { name: "Kiểm tra vé", exact: true }).click();
  await expect(page.getByText("VÉ HỢP LỆ", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("eventpass.checkin.scan."))
        throw new DOMException("Storage quota test", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.getByLabel("Nội dung mã QR").fill("second-payload");
  await page.getByRole("button", { name: "Kiểm tra vé", exact: true }).click();
  await expect(page.getByText("Storage quota test")).toBeVisible();
  await expect(page.getByText("VÉ HỢP LỆ", { exact: true })).toHaveCount(0);
});

test("screen 14 filters all backend pages by name, venue and status", async ({
  page,
}) => {
  await page.route("**/api/manage/events?**", (route) => {
    const second =
      new URL(route.request().url()).searchParams.get("page") === "1";
    return json(route, {
      content: [
        second
          ? {
              ...event,
              eventId: secondId,
              name: "Âm nhạc Đà Nẵng",
              venue: "Đà Nẵng",
              status: "DRAFT",
            }
          : event,
      ],
      totalPages: 2,
      totalElements: 2,
    });
  });
  await page.goto("/manage");
  await expect(page.getByText("2 sự kiện phù hợp")).toBeVisible();
  await page.getByLabel("Tìm sự kiện theo tên hoặc địa điểm").fill("da nang");
  await expect(
    page.getByText("Âm nhạc Đà Nẵng", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(event.name, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Đã xuất bản", exact: true }).click();
  await expect(
    page.getByText("Không có sự kiện phù hợp bộ lọc."),
  ).toBeVisible();
});

test("screen 15 offers only legal transitions and confirms cancellation before sending", async ({
  page,
}) => {
  let status = "PUBLISHED";
  const writes: unknown[] = [];
  await page.route(`**/api/event/${eid}`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      writes.push(body);
      status = body.status;
    }
    return json(route, { ...event, status });
  });
  await page.goto(`/manage/${eid}`);
  await page.getByRole("button", { name: "Thông tin", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bản nháp", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Đã hủy", exact: true }).click();
  await page.getByRole("button", { name: "Lưu sự kiện", exact: true }).click();
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Xác nhận lưu sự kiện", exact: true })
    .click();
  await expect(
    page.getByText("Sự kiện đã kết thúc hoặc bị hủy, không thể chỉnh sửa."),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  await expect(
    page.getByRole("button", { name: "Lưu sự kiện", exact: true }),
  ).toBeDisabled();
});

test("screen 15 rechecks the required reason in an already open confirmation", async ({
  page,
}) => {
  const writes: unknown[] = [];
  await page.route(`**/api/ticket/${tid}/status`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    writes.push(route.request().postDataJSON());
    return json(route, { ticketId: tid, status: "VOID" });
  });
  await page.goto(`/manage/${eid}`);
  await page.getByRole("button", { name: "Danh sách vé", exact: true }).click();
  const reason = page.getByLabel("Lý do vô hiệu hóa vé");
  await reason.fill("Original reason");
  await page
    .getByRole("button", { name: "Vô hiệu hóa vé", exact: true })
    .click();
  await reason.fill("");
  await expect(
    page.getByRole("button", { name: "Xác nhận vô hiệu hóa vé", exact: true }),
  ).toBeDisabled();
  expect(writes).toHaveLength(0);
  await reason.fill("Corrected reason");
  await page
    .getByRole("button", { name: "Xác nhận vô hiệu hóa vé", exact: true })
    .click();
  await expect(page.getByText("Đã lưu thay đổi.")).toBeVisible();
  expect(writes).toEqual([{ status: "VOID", reason: "Corrected reason" }]);
});

test("screen 15 sends coupon scope, redemption limit and validity instead of an unlimited discount", async ({
  page,
}) => {
  await page.goto(`/manage/${eid}`);
  await page.getByRole("button", { name: "Ưu đãi", exact: true }).click();
  await page.getByLabel("Mã ưu đãi", { exact: true }).fill("vip_only");
  await page.getByLabel("Phần trăm giảm (1–100)").fill("20");
  await page
    .getByRole("button", { name: "Áp dụng: Tiêu chuẩn", exact: true })
    .click();
  await page.getByLabel("Số lượt dùng tối đa", { exact: false }).fill("10");
  await page
    .getByLabel("Coupon hiệu lực từ", { exact: false })
    .fill(event.startsAt);
  await page
    .getByLabel("Coupon hiệu lực đến", { exact: false })
    .fill(event.endsAt);
  const create = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().endsWith("/coupons"),
  );
  await page.getByRole("button", { name: "Tạo mã", exact: true }).click();
  expect((await create).postDataJSON()).toEqual({
    code: "VIP_ONLY",
    type: "PERCENT",
    value: 20,
    ticketTypeId: typeId,
    maxRedemptions: 10,
    validFrom: new Date(event.startsAt).toISOString(),
    validUntil: new Date(event.endsAt).toISOString(),
  });
});

test("screen 16 filters globally and fetches authoritative user details", async ({
  page,
}) => {
  await page.route("**/api/user/admin/users?**", (route) => {
    const second =
      new URL(route.request().url()).searchParams.get("page") === "1";
    return json(route, {
      content: [second ? buyer : admin],
      totalPages: 2,
      totalElements: 2,
    });
  });
  await page.goto("/admin");
  await expect(page.getByText("2 người dùng phù hợp")).toBeVisible();
  await page
    .getByLabel("Tìm người dùng theo tên hoặc email")
    .fill("nguyen thi an");
  await page.getByRole("button", { name: "Bộ lọc", exact: true }).click();
  await page
    .getByRole("button", { name: "Chưa xác minh", exact: true })
    .click();
  await expect(page.getByText(buyer.email, { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: `Thao tác với ${buyer.fullName}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Xem chi tiết người dùng", exact: true })
    .click();
  await expect(
    page.getByText("Đăng nhập lỗi: 2", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quản trị viên", exact: true })
    .click();
  await expect(
    page.getByText("Không tìm thấy người dùng phù hợp."),
  ).toBeVisible();
});

test("screen 17 chooses an event, shows a selectable one-time key and copies it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/checkin/devices", (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    return route.request().method() === "POST"
      ? json(route, {
          deviceId: secondId,
          label: "Gate A",
          eventId: eid,
          status: "ACTIVE",
          apiKey: "one-time-test-device-key",
        })
      : json(route, []);
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Thiết bị", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Tạo thiết bị mới", exact: true })
    .click();
  await page.getByLabel("Tên thiết bị", { exact: true }).fill("Gate A");
  await page
    .getByRole("button", { name: "Gắn với sự kiện", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Chọn sự kiện: ${event.name}`, exact: true })
    .click();
  const create = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().endsWith("/devices"),
  );
  await page.getByRole("button", { name: "Tạo thiết bị", exact: true }).click();
  expect((await create).postDataJSON()).toEqual({
    label: "Gate A",
    eventId: eid,
  });
  await page
    .getByRole("button", { name: "Sao chép khóa thiết bị", exact: true })
    .click();
  await expect(page.getByText("Đã sao chép khóa thiết bị.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "one-time-test-device-key",
  );
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain("one-time-test-device-key");
  await page
    .getByRole("button", { name: "Đã lưu khóa, đóng", exact: true })
    .click();
  await expect(
    page.getByText("one-time-test-device-key", { exact: true }),
  ).toHaveCount(0);
});

test("screen 17 keeps creation errors visible inside the open sheet and retains the device name", async ({
  page,
}) => {
  await page.route("**/api/checkin/devices", (route) =>
    route.request().method() === "POST"
      ? json(route, { message: "Không thể tạo thiết bị lúc này" }, 500)
      : route.fallback(),
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: "Thiết bị", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Tạo thiết bị mới", exact: true })
    .click();
  await page
    .getByLabel("Tên thiết bị", { exact: true })
    .fill("Cổng cần thử lại");
  await page.getByRole("button", { name: "Tạo thiết bị", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Không thể tạo thiết bị lúc này" })
      .last(),
  ).toBeInViewport();
  await expect(page.getByLabel("Tên thiết bị", { exact: true })).toHaveValue(
    "Cổng cần thử lại",
  );
  await page
    .getByRole("button", { name: "Đóng đăng ký thiết bị", exact: true })
    .click();
  await expect(
    page.getByText("Khóa thiết bị mới", { exact: true }),
  ).toHaveCount(0);
});

test("screen 18 ignores a delayed response after the query changes", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/admin/payments/by-reservation/${reservationId}`,
    async (route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      await gate;
      await json(route, payment).catch(() => {});
    },
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await page.getByLabel("Mã đặt vé (reservation ID)").fill(reservationId);
  const started = page.waitForRequest(
    (req) => req.method() === "GET" && req.url().endsWith(reservationId),
  );
  await page
    .getByRole("button", { name: "Tra cứu giao dịch", exact: true })
    .click();
  await started;
  await page.getByLabel("Mã đặt vé (reservation ID)").fill(secondId);
  release();
  await expect(
    page.getByText(`Mã giao dịch: ${paymentId}`, { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Hoàn tiền toàn bộ", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Tra cứu giao dịch", exact: true })
    .click();
  await expect(
    page.getByText(
      "Phản hồi tra cứu không khớp giao dịch. Vui lòng tra cứu lại.",
    ),
  ).toBeVisible();
});

test("screen 18 looks up by payment ID and requires fresh lookup after an unconfirmed refund", async ({
  page,
}) => {
  await page.route(`**/api/payment/requests/${paymentId}/refund`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    return json(route, {
      ...payment,
      paymentRequestId: secondId,
      status: "REFUNDED",
    });
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Thanh toán", exact: true }).click();
  await page
    .getByRole("button", { name: "Mã thanh toán", exact: true })
    .click();
  await page.getByLabel("Mã thanh toán (payment ID)").fill(paymentId);
  await page
    .getByRole("button", { name: "Tra cứu giao dịch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hoàn tiền toàn bộ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận hoàn tiền toàn bộ", exact: true })
    .click();
  await expect(
    page.getByText("Máy chủ chưa xác nhận hoàn tiền đúng giao dịch.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hoàn tiền toàn bộ", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible();
});

test("screen 15 guest batches validate every row before issuing tickets", async ({
  page,
}) => {
  const writes: unknown[] = [];
  await page.route(`**/api/manage/events/${eid}/guests`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    writes.push(route.request().postDataJSON());
    return json(route, []);
  });
  await page.goto(`/manage/${eid}`);
  await page.getByRole("button", { name: "Khách mời", exact: true }).click();
  await page.getByRole("button", { name: "Tiêu chuẩn", exact: true }).click();
  await page
    .getByRole("button", { name: "Nhập danh sách khách", exact: true })
    .click();
  await page
    .getByLabel("Danh sách khách (mỗi dòng: Họ tên, email)")
    .fill("Bad row without email");
  await page.getByRole("button", { name: "Gửi vé mời", exact: true }).click();
  await expect(
    page.getByText("Chọn loại vé và nhập đầy đủ tên, email hợp lệ."),
  ).toBeVisible();
  expect(writes).toHaveLength(0);
  await page
    .getByLabel("Danh sách khách (mỗi dòng: Họ tên, email)")
    .fill("Guest A, a@example.test\nGuest B, b@example.test");
  await page.getByRole("button", { name: "Gửi vé mời", exact: true }).click();
  await expect(page.getByText("Đã gửi vé mời.", { exact: true })).toBeVisible();
  expect(writes).toEqual([
    {
      ticketTypeId: typeId,
      guests: [
        { name: "Guest A", email: "a@example.test" },
        { name: "Guest B", email: "b@example.test" },
      ],
    },
  ]);
});

test("screen 15 live report refreshes instead of freezing the first check-in count", async ({
  page,
}) => {
  let calls = 0;
  await page.route(`**/api/checkin/events/${eid}/stats`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    calls++;
    return json(route, {
      totalIssued: 100,
      acceptedCount: calls,
      duplicateCount: 0,
      deviceRejectedCount: 0,
      invalidCount: 0,
    });
  });
  await page.route(`**/api/checkin/events/${eid}/timeline?**`, (route) =>
    json(route, []),
  );
  await page.goto(`/manage/${eid}`);
  await page
    .getByRole("button", { name: "Báo cáo soát vé", exact: true })
    .click();
  await expect(
    page.getByText("Đã chấp nhận: 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Đã chấp nhận: 2", { exact: true }),
  ).toBeVisible();
  expect(calls).toBeGreaterThanOrEqual(2);
});
