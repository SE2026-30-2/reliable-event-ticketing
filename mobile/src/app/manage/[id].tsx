import { useCallback, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
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
} from "@/components/ui-kit";
import { EventForm } from "@/components/event-form";
import { ConfirmButton } from "@/components/confirm-button";
import { CheckinReport } from "@/components/checkin-report";
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
  totals: {
    ticketsIssued: number;
    checkedIn: number;
    noShow: number;
    netRevenueCents: number;
    collectedCents: number;
    refundedCents: number;
  };
}
function ManagementContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("overview");
  const load = useCallback(
    (signal: AbortSignal) =>
      request<Event>(`/api/event/${encodeURIComponent(id)}`, { signal }),
    [id],
  );
  const resource = useResource(load);
  return (
    <Screen>
      <Title>{resource.data?.name || "Quản lý sự kiện"}</Title>
      <Feedback message={resource.error} retry={resource.reload} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {Object.entries(tabs).map(([key, label]) => (
          <Button
            key={key}
            title={label}
            secondary={key !== tab}
            onPress={() => setTab(key as Tab)}
          />
        ))}
      </ScrollView>
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
  async function mutate(
    task: () => Promise<unknown>,
    success = "Đã lưu thay đổi.",
  ) {
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
      setBusy(false);
    }
  }
  function createType() {
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
      Number(entries) > 50
    ) {
      setError("Nhập tên vé, giá VNĐ không âm, hạn ngạch và số lượt hợp lệ.");
      return;
    }
    void mutate(() =>
      post(`/api/event/${id}/ticket-types`, {
        name: name.trim(),
        priceCents: Math.round(Number(price) * 100),
        quota: Number(quota),
        validFrom: event.startsAt,
        validUntil: event.endsAt,
        maxEntries: Number(entries),
        bundleSize: Number(bundle),
      }),
    );
  }
  if (resource.loading) return <Loading />;
  const data = resource.data;
  return (
    <>
      <Feedback message={resource.error} retry={resource.reload} />
      <Feedback message={error} />
      {!!notice && <Body>{notice}</Body>}
      {!resource.error && data && (
        <>
          {tab === "overview" && (
            <Card>
              <Heading>Báo cáo sự kiện</Heading>
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
                <Body muted>
                  Vé có hiệu lực theo thời gian bắt đầu và kết thúc sự kiện.
                </Body>
                <Button title="Tạo loại vé" busy={busy} onPress={createType} />
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
                  <Button
                    secondary
                    title={coupon.active ? "Tắt ưu đãi" : "Bật ưu đãi"}
                    disabled={busy}
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
                <Button
                  title="Tạo mã"
                  busy={busy}
                  onPress={() => {
                    if (
                      !code.trim() ||
                      !Number.isFinite(Number(value)) ||
                      Number(value) <= 0 ||
                      (percent &&
                        (!Number.isInteger(Number(value)) ||
                          Number(value) > 100))
                    ) {
                      setError("Nhập mã và giá trị giảm hợp lệ.");
                      return;
                    }
                    void mutate(() =>
                      post(`/api/manage/events/${id}/coupons`, {
                        code: code.trim(),
                        type: percent ? "PERCENT" : "FIXED",
                        value: percent
                          ? Number(value)
                          : Math.round(Number(value) * 100),
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
              <Body muted>Chọn loại vé để cấp vé mời qua email.</Body>
              {(data as TicketType[]).map((type) => (
                <Button
                  key={type.ticketTypeId}
                  secondary={typeId !== type.ticketTypeId}
                  title={type.name}
                  onPress={() => setTypeId(type.ticketTypeId)}
                />
              ))}
              <Field label="Họ tên khách" value={name} onChangeText={setName} />
              <Field
                label="Email khách"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Button
                title="Gửi vé mời"
                busy={busy}
                onPress={() => {
                  if (!typeId || !name.trim() || !isEmail(email)) {
                    setError("Chọn loại vé và nhập đầy đủ tên, email hợp lệ.");
                    return;
                  }
                  void mutate(
                    () =>
                      post(`/api/manage/events/${id}/guests`, {
                        ticketTypeId: typeId,
                        guests: [{ name: name.trim(), email: email.trim() }],
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
                        mutate(() =>
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
                  disabled={!label.trim()}
                  onPress={() =>
                    mutate(async () => {
                      const result = await post<Device>(
                        "/api/checkin/devices",
                        { eventId: id, label: label.trim() },
                      );
                      setDeviceKey(result.apiKey || "");
                    })
                  }
                />
                {!!deviceKey && (
                  <>
                    <Body>Khóa thiết bị (chỉ hiển thị lần này):</Body>
                    <Body>{deviceKey}</Body>
                    <Button
                      secondary
                      title="Ẩn khóa"
                      onPress={() => setDeviceKey("")}
                    />
                  </>
                )}
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
