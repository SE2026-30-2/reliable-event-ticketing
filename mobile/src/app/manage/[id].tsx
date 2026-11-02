import { useCallback, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Gate,
  Heading,
  Loading,
  Screen,
  Title,
  styles,
  Banner,
  MetricStrip,
  InfoRow,
} from "@/components/ui-kit";
import { EventForm } from "@/components/event-form";
import { ConfirmButton } from "@/components/confirm-button";
import { CheckinReport } from "@/components/checkin-report";
import { DeviceKey } from "@/components/device-key";
import { useResource } from "@/hooks/use-resource";
import { patch, post, request } from "@/lib/api";
import {
  dateTime,
  isEmail,
  listOf,
  messageOf,
  money,
  type Coupon,
  type Device,
  type Event,
  type Page,
  type Ticket,
  type TicketType,
} from "@/lib/types";

const tabs = {
  overview: "Tổng quan",
  edit: "Thông tin",
  types: "Loại vé",
  coupons: "Ưu đãi",
  guests: "Khách mời",
  tickets: "Danh sách vé",
  devices: "Thiết bị",
  checkin: "Báo cáo soát vé",
};
type Tab = keyof typeof tabs;
interface Report {
  generatedAt: string;
  ticketTypes?: {
    ticketTypeId: string;
    name: string;
    quota: number;
    issued: number;
    reserved: number;
    remaining: number;
    guests: number;
    checkedIn: number;
    refunded: number;
    voided: number;
    revenueCents: number;
  }[];
  totals: {
    ticketsIssued: number;
    checkedIn: number;
    noShow: number;
    netRevenueCents: number;
    collectedCents: number;
    refundedCents: number;
    couponDiscountCents?: number;
  };
}
function ManagementContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [event] = await Promise.all([
        request<Event>(`/api/event/${encodeURIComponent(id)}`, { signal }),
        request<Report>(`/api/manage/events/${encodeURIComponent(id)}/report`, {
          signal,
        }),
      ]);
      return event;
    },
    [id],
  );
  const resource = useResource(load);
  return (
    <Screen>
      <Title>Chi tiết quản trị sự kiện</Title>
      {resource.data && (
        <>
          <Banner uri={resource.data.bannerUrl} />
          <Heading>{resource.data.name}</Heading>
          <Badge>{resource.data.status}</Badge>
          <Body muted>{dateTime(resource.data.startsAt)}</Body>
          <Body muted>{resource.data.venue}</Body>
        </>
      )}
      <Feedback message={resource.error} retry={resource.reload} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(tabs).map(([key, label]) => (
          <Button
            compact
            key={key}
            title={label}
            secondary={key !== tab}
            onPress={() => setTab(key as Tab)}
          />
        ))}
      </View>
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data &&
        !resource.error && (
          <>
            {tab === "edit" ? (
              <EventForm
                key={resource.data.startsAt + resource.data.status}
                event={resource.data}
                onSaved={resource.reload}
              />
            ) : tab === "checkin" ? (
              <CheckinReport id={id} />
            ) : (
              <ManagementPanel
                key={tab}
                id={id}
                tab={tab}
                event={resource.data}
              />
            )}
          </>
        )
      )}
    </Screen>
  );
}
function ManagementPanel({
  id,
  tab,
  event,
}: {
  id: string;
  tab: Tab;
  event: Event;
}) {
  const [page, setPage] = useState(0);
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (tab === "overview")
        return request<Report>(`/api/manage/events/${id}/report`, { signal });
      if (tab === "types" || tab === "guests")
        return request<TicketType[]>(`/api/event/${id}/ticket-types`, {
          signal,
        });
      if (tab === "coupons")
        return request<Coupon[]>(`/api/manage/events/${id}/coupons`, {
          signal,
        });
      if (tab === "tickets")
        return request<Page<Ticket>>(
          `/api/event/${id}/tickets?page=${page}&size=20`,
          { signal },
        );
      return request<Device[]>(`/api/checkin/devices?eventId=${id}`, {
        signal,
      });
    },
    [id, tab, page],
  );
  const resource = useResource<
    Report | TicketType[] | Coupon[] | Page<Ticket> | Device[]
  >(load);
  const loadCouponTypes = useCallback(
    (signal: AbortSignal) =>
      tab === "coupons"
        ? request<TicketType[]>(`/api/event/${id}/ticket-types`, { signal })
        : Promise.resolve([]),
    [id, tab],
  );
  const couponTypes = useResource(loadCouponTypes);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quota, setQuota] = useState("");
  const [bundle, setBundle] = useState("1");
  const [entries, setEntries] = useState("1");
  const [code, setCode] = useState("");
  const [value, setValue] = useState("");
  const [percent, setPercent] = useState(true);
  const [email, setEmail] = useState("");
  const [typeId, setTypeId] = useState("");
  const [label, setLabel] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const [reason, setReason] = useState("");
  const [typeStart, setTypeStart] = useState(event.startsAt);
  const [typeEnd, setTypeEnd] = useState(event.endsAt);
  const [couponTypeId, setCouponTypeId] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [couponStart, setCouponStart] = useState("");
  const [couponEnd, setCouponEnd] = useState("");
  const [guestBatch, setGuestBatch] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const lock = useRef(false);
  const final = ["CANCELLED", "COMPLETED"].includes(event.status);
  async function mutate(
    task: () => Promise<unknown>,
    success = "Đã lưu thay đổi.",
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(success);
      resource.reload();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function createType() {
    if (final || lock.current) return;
    if (
      !name.trim() ||
      price.trim() === "" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0 ||
      !Number.isInteger(Number(quota)) ||
      Number(quota) < 1 ||
      !Number.isInteger(Number(bundle)) ||
      Number(bundle) < 1 ||
      Number(bundle) > 20 ||
      !Number.isInteger(Number(entries)) ||
      Number(entries) < 1 ||
      Number(entries) > 50 ||
      !Number.isSafeInteger(Math.round(Number(price) * 100)) ||
      !Number.isFinite(Date.parse(typeStart)) ||
      !Number.isFinite(Date.parse(typeEnd)) ||
      Date.parse(typeEnd) <= Date.parse(typeStart)
    ) {
      setError("Nhập tên vé, giá VNĐ không âm, hạn ngạch và số lượt hợp lệ.");
      return;
    }
    void mutate(() =>
      post(`/api/event/${id}/ticket-types`, {
        name: name.trim(),
        priceCents: Math.round(Number(price) * 100),
        quota: Number(quota),
        validFrom: new Date(typeStart).toISOString(),
        validUntil: new Date(typeEnd).toISOString(),
        maxEntries: Number(entries),
        bundleSize: Number(bundle),
      }),
    );
  }
  if (resource.loading)
    return (
      <>
        {deviceKey && (
          <DeviceKey value={deviceKey} onClose={() => setDeviceKey("")} />
        )}
        <Loading />
      </>
    );
  const data = resource.data;
  return (
    <>
      <Feedback message={resource.error} retry={resource.reload} />
      <Feedback message={error} />
      {!!notice && <Body>{notice}</Body>}
      {!!deviceKey && (
        <DeviceKey value={deviceKey} onClose={() => setDeviceKey("")} />
      )}
      {!resource.error && data && (
        <>
          {tab === "overview" && (
            <Card>
              <Heading>Báo cáo sự kiện</Heading>
              <MetricStrip
                items={[
                  {
                    label: "Vé phát hành",
                    value: (data as Report).totals.ticketsIssued,
                    icon: "ticket",
                  },
                  {
                    label: "Đã check-in",
                    value: (data as Report).totals.checkedIn,
                    icon: "scan",
                  },
                  {
                    label: "Chưa tham dự",
                    value: (data as Report).totals.noShow,
                    icon: "user",
                  },
                ]}
              />
              <InfoRow label="Thời gian" value={dateTime(event.startsAt)} />
              <InfoRow label="Địa điểm" value={event.venue} />
              <Body muted>
                Cập nhật: {dateTime((data as Report).generatedAt)}
              </Body>
              <Body>Vé phát hành: {(data as Report).totals.ticketsIssued}</Body>
              <Body>Đã check-in: {(data as Report).totals.checkedIn}</Body>
              <Body>Chưa tham dự: {(data as Report).totals.noShow}</Body>
              <Body>
                Đã thu: {money((data as Report).totals.collectedCents)}
              </Body>
              <Body>
                Đã hoàn: {money((data as Report).totals.refundedCents)}
              </Body>
              <Heading>
                Doanh thu: {money((data as Report).totals.netRevenueCents)}
              </Heading>
              <Body>
                Giảm giá coupon:{" "}
                {money((data as Report).totals.couponDiscountCents || 0)}
              </Body>
              {(data as Report).ticketTypes?.map((line) => (
                <Card key={line.ticketTypeId}>
                  <Heading>{line.name}</Heading>
                  <Body>
                    Phát hành {line.issued} · Giữ chỗ {line.reserved} · Còn{" "}
                    {line.remaining} / {line.quota}
                  </Body>
                  <Body>
                    Vé mời {line.guests} · Đã tham dự {line.checkedIn}
                  </Body>
                  <Body>
                    Hoàn {line.refunded} · Hủy {line.voided}
                  </Body>
                  <Body>Tiền thu: {money(line.revenueCents)}</Body>
                </Card>
              ))}
              <Button
                secondary
                title="Mở soát vé"
                onPress={() => router.push("/checkin")}
              />
            </Card>
          )}
          {tab === "types" && (
            <>
              {(data as TicketType[]).map((type) => (
                <Card key={type.ticketTypeId}>
                  <Heading>{type.name}</Heading>
                  <Badge>{money(type.priceCents)}</Badge>
                  <Body>
                    Còn {type.remaining} / {type.quota} · Gói {type.bundleSize}{" "}
                    vé · {type.maxEntries} lượt
                  </Body>
                </Card>
              ))}
              <Card>
                <Heading>Thêm loại vé</Heading>
                <Field
                  label="Tên loại vé"
                  value={name}
                  onChangeText={setName}
                />
                <Field
                  label="Giá mỗi đơn vị (VNĐ)"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
                <Field
                  label="Hạn ngạch"
                  value={quota}
                  onChangeText={setQuota}
                  keyboardType="number-pad"
                />
                <Field
                  label="Số vé trong gói (1–20)"
                  value={bundle}
                  onChangeText={setBundle}
                  keyboardType="number-pad"
                />
                <Field
                  label="Số lượt vào cửa (1–50)"
                  value={entries}
                  onChangeText={setEntries}
                  keyboardType="number-pad"
                />
                <Field
                  label="Hiệu lực vé từ (kèm múi giờ)"
                  value={typeStart}
                  onChangeText={setTypeStart}
                  editable={!busy && !final}
                  autoCapitalize="none"
                />
                <Field
                  label="Hiệu lực vé đến (kèm múi giờ)"
                  value={typeEnd}
                  onChangeText={setTypeEnd}
                  editable={!busy && !final}
                  autoCapitalize="none"
                />
                <Button
                  title="Tạo loại vé"
                  busy={busy}
                  disabled={final}
                  onPress={createType}
                />
              </Card>
            </>
          )}
          {tab === "coupons" && (
            <>
              {(data as Coupon[]).map((coupon) => (
                <Card key={coupon.couponId}>
                  <Heading>{coupon.code}</Heading>
                  <Badge>{coupon.active ? "ĐANG BẬT" : "ĐÃ TẮT"}</Badge>
                  <Body>
                    Giảm{" "}
                    {coupon.type === "PERCENT"
                      ? `${coupon.value}%`
                      : money(coupon.value)}{" "}
                    · Đã dùng {coupon.redeemedCount} lượt
                  </Body>
                  <Body muted>
                    Giới hạn: {coupon.maxRedemptions ?? "Không giới hạn"} · Loại
                    vé:{" "}
                    {coupon.ticketTypeId
                      ? couponTypes.data?.find(
                          (type) => type.ticketTypeId === coupon.ticketTypeId,
                        )?.name || coupon.ticketTypeId
                      : "Tất cả"}
                  </Body>
                  <Body muted>
                    Hiệu lực: {dateTime(coupon.validFrom)} →{" "}
                    {dateTime(coupon.validUntil)}
                  </Body>
                  <Button
                    secondary
                    title={coupon.active ? "Tắt ưu đãi" : "Bật ưu đãi"}
                    disabled={busy || final}
                    onPress={() =>
                      mutate(() =>
                        patch(
                          `/api/manage/events/${id}/coupons/${coupon.couponId}`,
                          { active: !coupon.active },
                        ),
                      )
                    }
                  />
                </Card>
              ))}
              <Card>
                <Heading>Tạo mã ưu đãi</Heading>
                <Field
                  label="Mã ưu đãi"
                  value={code}
                  onChangeText={setCode}
                  maxLength={40}
                  autoCapitalize="characters"
                />
                <Button
                  secondary
                  title={
                    percent
                      ? "Loại giảm: phần trăm (đổi sang số tiền)"
                      : "Loại giảm: số tiền (đổi sang phần trăm)"
                  }
                  onPress={() => setPercent(!percent)}
                />
                <Field
                  label={
                    percent ? "Phần trăm giảm (1–100)" : "Số tiền giảm (VNĐ)"
                  }
                  value={value}
                  onChangeText={setValue}
                  keyboardType="numeric"
                />
                <Feedback
                  message={couponTypes.error}
                  retry={couponTypes.reload}
                />
                <Button
                  secondary
                  title="Áp dụng tất cả loại vé"
                  disabled={busy || final}
                  onPress={() => setCouponTypeId("")}
                />
                {couponTypes.data?.map((type) => (
                  <Button
                    key={type.ticketTypeId}
                    secondary={couponTypeId !== type.ticketTypeId}
                    title={`Áp dụng: ${type.name}`}
                    disabled={busy || final}
                    onPress={() => setCouponTypeId(type.ticketTypeId)}
                  />
                ))}
                <Field
                  label="Số lượt dùng tối đa (để trống nếu không giới hạn)"
                  value={maxRedemptions}
                  onChangeText={setMaxRedemptions}
                  keyboardType="number-pad"
                  editable={!busy && !final}
                />
                <Field
                  label="Coupon hiệu lực từ (tùy chọn, kèm múi giờ)"
                  value={couponStart}
                  onChangeText={setCouponStart}
                  editable={!busy && !final}
                  autoCapitalize="none"
                />
                <Field
                  label="Coupon hiệu lực đến (tùy chọn, kèm múi giờ)"
                  value={couponEnd}
                  onChangeText={setCouponEnd}
                  editable={!busy && !final}
                  autoCapitalize="none"
                />
                <Button
                  title="Tạo mã"
                  busy={busy}
                  disabled={final}
                  onPress={() => {
                    if (final || lock.current) return;
                    if (
                      !/^[A-Z0-9_-]{3,40}$/.test(code.trim().toUpperCase()) ||
                      !Number.isFinite(Number(value)) ||
                      Number(value) <= 0 ||
                      (percent &&
                        (!Number.isInteger(Number(value)) ||
                          Number(value) > 100)) ||
                      (!percent &&
                        !Number.isSafeInteger(
                          Math.round(Number(value) * 100),
                        )) ||
                      (!!maxRedemptions.trim() &&
                        (!Number.isInteger(Number(maxRedemptions)) ||
                          Number(maxRedemptions) < 1)) ||
                      (!!couponStart &&
                        !Number.isFinite(Date.parse(couponStart))) ||
                      (!!couponEnd &&
                        !Number.isFinite(Date.parse(couponEnd))) ||
                      (!!couponStart &&
                        !!couponEnd &&
                        Date.parse(couponEnd) <= Date.parse(couponStart))
                    ) {
                      setError("Nhập mã và giá trị giảm hợp lệ.");
                      return;
                    }
                    void mutate(() =>
                      post(`/api/manage/events/${id}/coupons`, {
                        code: code.trim().toUpperCase(),
                        type: percent ? "PERCENT" : "FIXED",
                        value: percent
                          ? Number(value)
                          : Math.round(Number(value) * 100),
                        ticketTypeId: couponTypeId || undefined,
                        maxRedemptions: maxRedemptions.trim()
                          ? Number(maxRedemptions)
                          : undefined,
                        validFrom: couponStart
                          ? new Date(couponStart).toISOString()
                          : undefined,
                        validUntil: couponEnd
                          ? new Date(couponEnd).toISOString()
                          : undefined,
                      }),
                    );
                  }}
                />
              </Card>
            </>
          )}
          {tab === "guests" && (
            <Card>
              <Heading>Mời khách tham dự</Heading>
              <Button
                secondary
                title={batchMode ? "Nhập một khách" : "Nhập danh sách khách"}
                disabled={busy || final}
                onPress={() => setBatchMode(!batchMode)}
              />
              <Body muted>Chọn loại vé để cấp vé mời qua email.</Body>
              {(data as TicketType[]).map((type) => (
                <Button
                  key={type.ticketTypeId}
                  secondary={typeId !== type.ticketTypeId}
                  title={type.name}
                  onPress={() => setTypeId(type.ticketTypeId)}
                  disabled={busy || final}
                />
              ))}
              {batchMode ? (
                <Field
                  label="Danh sách khách (mỗi dòng: Họ tên, email)"
                  value={guestBatch}
                  onChangeText={setGuestBatch}
                  multiline
                  editable={!busy && !final}
                />
              ) : (
                <>
                  <Field
                    label="Họ tên khách"
                    value={name}
                    onChangeText={setName}
                    editable={!busy && !final}
                  />
                  <Field
                    label="Email khách"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!busy && !final}
                  />
                </>
              )}
              <Button
                title="Gửi vé mời"
                busy={busy}
                disabled={final}
                onPress={() => {
                  if (final || lock.current) return;
                  const lines = guestBatch
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                  const guests = batchMode
                    ? lines.map((line) => {
                        const split = line.lastIndexOf(",");
                        return {
                          name: split > 0 ? line.slice(0, split).trim() : "",
                          email: line.slice(split + 1).trim(),
                        };
                      })
                    : [{ name: name.trim(), email: email.trim() }];
                  if (
                    !typeId ||
                    guests.length < 1 ||
                    guests.length > 200 ||
                    guests.some(
                      (guest) =>
                        !guest.name ||
                        guest.name.length > 255 ||
                        !isEmail(guest.email),
                    )
                  ) {
                    setError("Chọn loại vé và nhập đầy đủ tên, email hợp lệ.");
                    return;
                  }
                  void mutate(
                    () =>
                      post(`/api/manage/events/${id}/guests`, {
                        ticketTypeId: typeId,
                        guests,
                      }),
                    "Đã gửi vé mời.",
                  );
                }}
              />
            </Card>
          )}
          {tab === "tickets" && (
            <>
              <Field
                label="Lý do vô hiệu hóa vé"
                value={reason}
                onChangeText={setReason}
              />
              {listOf(data as Page<Ticket>).map((ticket) => (
                <Card key={ticket.ticketId}>
                  <Badge>{ticket.status}</Badge>
                  <Heading>{ticket.holderName}</Heading>
                  <Body>{ticket.holderEmail}</Body>
                  <Body muted>{ticket.ticketId}</Body>
                  {["RESERVED", "ISSUED"].includes(ticket.status) && (
                    <ConfirmButton
                      title="Vô hiệu hóa vé"
                      disabled={busy || !reason.trim()}
                      description={`Vô hiệu hóa vé của ${ticket.holderName}? Lý do: ${reason}`}
                      onConfirm={() =>
                        !reason.trim()
                          ? Promise.resolve()
                          : mutate(() =>
                              patch(`/api/ticket/${ticket.ticketId}/status`, {
                                status: "VOID",
                                reason: reason.trim(),
                              }),
                            )
                      }
                    />
                  )}
                </Card>
              ))}
              <View style={styles.row}>
                <Button
                  secondary
                  title="← Trước"
                  disabled={page === 0}
                  onPress={() => setPage(page - 1)}
                />
                <Body>Trang {page + 1}</Body>
                <Button
                  secondary
                  title="Sau →"
                  disabled={page + 1 >= (data as Page<Ticket>).totalPages}
                  onPress={() => setPage(page + 1)}
                />
              </View>
            </>
          )}
          {tab === "devices" && (
            <>
              {(data as Device[]).map((device) => (
                <Card key={device.deviceId}>
                  <Heading>{device.label}</Heading>
                  <Badge>{device.status}</Badge>
                  <Body muted>{device.deviceId}</Body>
                  {device.status !== "REVOKED" && (
                    <ConfirmButton
                      title="Thu hồi thiết bị"
                      disabled={busy}
                      description="Thiết bị sẽ không thể tiếp tục soát vé. Tiếp tục?"
                      onConfirm={() =>
                        mutate(() =>
                          patch(
                            `/api/checkin/devices/${device.deviceId}/revoke`,
                          ),
                        )
                      }
                    />
                  )}
                </Card>
              ))}
              <Card>
                <Heading>Đăng ký thiết bị</Heading>
                <Field
                  label="Tên thiết bị"
                  value={label}
                  onChangeText={setLabel}
                />
                <Button
                  title="Tạo thiết bị"
                  busy={busy}
                  disabled={!label.trim() || !!deviceKey}
                  onPress={() =>
                    mutate(async () => {
                      const result = await post<Device>(
                        "/api/checkin/devices",
                        { eventId: id, label: label.trim() },
                      );
                      if (!result.apiKey)
                        throw new Error(
                          "Thiết bị đã tạo nhưng thiếu khóa. Hãy thu hồi và tạo lại.",
                        );
                      setDeviceKey(result.apiKey);
                    })
                  }
                />
              </Card>
            </>
          )}
          <Button secondary title="Tải lại dữ liệu" onPress={resource.reload} />
        </>
      )}
    </>
  );
}
export default function Management() {
  return (
    <Gate roles={["ADMIN", "ORGANIZER"]}>
      <ManagementContent />
    </Gate>
  );
}
