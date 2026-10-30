import { useCallback, useState } from "react";
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
} from "@/components/ui-kit";
import { ConfirmButton } from "@/components/confirm-button";
import { useResource } from "@/hooks/use-resource";
import { useAuth } from "@/contexts/auth";
import { identity, patch, post, request } from "@/lib/api";
import {
  dateTime,
  messageOf,
  money,
  type Device,
  type Page,
  type User,
} from "@/lib/types";
function AdminContent() {
  const [tab, setTab] = useState("users");
  return (
    <Screen>
      <Title>Quản trị hệ thống</Title>
      <View style={styles.row}>
        {[
          ["users", "Người dùng"],
          ["devices", "Thiết bị"],
          ["payments", "Thanh toán"],
        ].map(([key, title]) => (
          <Button
            key={key}
            title={title}
            secondary={tab !== key}
            onPress={() => setTab(key)}
          />
        ))}
      </View>
      {tab === "users" ? (
        <Users />
      ) : tab === "devices" ? (
        <Devices />
      ) : (
        <Payments />
      )}
    </Screen>
  );
}
function Users() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(
    (signal: AbortSignal) =>
      identity<Page<User>>(
        `/admin/users?page=${page}&size=20&sort=createdAt,desc`,
        { signal },
      ),
    [page],
  );
  const resource = useResource(load);
  async function update(id: string, kind: "roles" | "status", body: unknown) {
    setBusy(true);
    setError("");
    try {
      await identity(`/admin/users/${id}/${kind}`, { method: "PATCH", body });
      resource.reload();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading>Quản lý người dùng</Heading>
      <Feedback message={resource.error || error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data &&
        !resource.error && (
          <>
            {resource.data.content.map((user) => (
              <Card key={user.id}>
                <Heading>{user.fullName}</Heading>
                <Body>{user.email}</Body>
                <Badge>
                  {user.status} ·{" "}
                  {user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
                </Badge>
                <Body muted>
                  {user.roles.join(", ")} · {dateTime(user.createdAt)}
                </Body>
                <ConfirmButton
                  title={
                    user.status === "LOCKED"
                      ? "Mở khóa tài khoản"
                      : "Khóa tài khoản"
                  }
                  disabled={busy || currentUser?.id === user.id}
                  description={`Thay đổi trạng thái tài khoản ${user.email}?`}
                  onConfirm={() =>
                    update(user.id, "status", {
                      status: user.status === "LOCKED" ? "ACTIVE" : "LOCKED",
                    })
                  }
                />
                <ConfirmButton
                  title={
                    user.roles.includes("ORGANIZER")
                      ? "Gỡ quyền tổ chức"
                      : "Cấp quyền tổ chức"
                  }
                  disabled={busy || currentUser?.id === user.id}
                  description={`Thay đổi quyền tổ chức sự kiện của ${user.email}?`}
                  onConfirm={() => {
                    const roles = new Set(user.roles);
                    if (roles.has("ORGANIZER")) roles.delete("ORGANIZER");
                    else roles.add("ORGANIZER");
                    if (!roles.size) roles.add("USER");
                    return update(user.id, "roles", { roles: [...roles] });
                  }}
                />
              </Card>
            ))}
            <View style={styles.row}>
              <Button
                secondary
                title="← Trước"
                disabled={page === 0}
                onPress={() => setPage(page - 1)}
              />
              <Body>
                Trang {page + 1} / {Math.max(1, resource.data.totalPages)}
              </Body>
              <Button
                secondary
                title="Sau →"
                disabled={page + 1 >= resource.data.totalPages}
                onPress={() => setPage(page + 1)}
              />
            </View>
          </>
        )
      )}
    </>
  );
}
function Devices() {
  const load = useCallback(
    (signal: AbortSignal) =>
      request<Device[]>("/api/checkin/devices", { signal }),
    [],
  );
  const resource = useResource(load);
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [eventId, setEventId] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Heading>Thiết bị toàn hệ thống</Heading>
      <Feedback message={resource.error || error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        !resource.error &&
        resource.data?.map((device) => (
          <Card key={device.deviceId}>
            <Heading>{device.label}</Heading>
            <Badge>{device.status}</Badge>
            <Body muted>Sự kiện: {device.eventId || "Toàn hệ thống"}</Body>
            <Body muted>Lập: {dateTime(device.createdAt)}</Body>
            {device.status !== "REVOKED" && (
              <ConfirmButton
                title="Thu hồi thiết bị"
                description={`Thu hồi quyền soát vé của ${device.label}?`}
                onConfirm={async () => {
                  setError("");
                  try {
                    await patch(
                      `/api/checkin/devices/${device.deviceId}/revoke`,
                    );
                    resource.reload();
                  } catch (error) {
                    setError(messageOf(error));
                  }
                }}
              />
            )}
          </Card>
        ))
      )}
      <Card>
        <Heading>Đăng ký thiết bị</Heading>
        <Field label="Tên thiết bị" value={label} onChangeText={setLabel} />
        <Field
          label="Mã sự kiện (để trống cho toàn hệ thống)"
          value={eventId}
          onChangeText={setEventId}
          autoCapitalize="none"
        />
        <Button
          title="Tạo thiết bị"
          busy={busy}
          disabled={!label.trim()}
          onPress={async () => {
            setBusy(true);
            setError("");
            setKey("");
            try {
              const device = await post<Device>("/api/checkin/devices", {
                label: label.trim(),
                eventId: eventId.trim() || undefined,
              });
              setKey(device.apiKey || "");
              resource.reload();
            } catch (error) {
              setError(messageOf(error));
            } finally {
              setBusy(false);
            }
          }}
        />
        {!!key && (
          <>
            <Body>Khóa thiết bị (chỉ hiển thị lần này): {key}</Body>
            <Button secondary title="Ẩn khóa" onPress={() => setKey("")} />
          </>
        )}
      </Card>
    </>
  );
}
interface Payment {
  paymentRequestId: string;
  reservationId: string;
  status: string;
  provider: string;
  amountCents: number;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
}
function Payments() {
  const [reservationId, setReservationId] = useState("");
  const [payment, setPayment] = useState<Payment>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  async function lookup() {
    setBusy(true);
    setError("");
    setPayment(undefined);
    try {
      setPayment(
        await request<Payment>(
          `/api/payment/requests/by-reservation/${encodeURIComponent(reservationId.trim())}`,
        ),
      );
      setStale(false);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading>Tra cứu & Hoàn tiền</Heading>
      <Card>
        <Field
          label="Mã đặt vé (reservation ID)"
          value={reservationId}
          onChangeText={(value) => {
            setReservationId(value);
            setPayment(undefined);
          }}
          autoCapitalize="none"
        />
        <Button
          title="Tra cứu giao dịch"
          busy={busy}
          disabled={
            !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
              reservationId.trim(),
            )
          }
          onPress={lookup}
        />
      </Card>
      <Feedback message={error} />
      {payment && (
        <Card>
          <Badge>{payment.status}</Badge>
          <Heading>{money(payment.amountCents)}</Heading>
          <Body>Nhà cung cấp: {payment.provider}</Body>
          <Body muted>Mã giao dịch: {payment.paymentRequestId}</Body>
          <Body muted>Tạo lúc: {dateTime(payment.createdAt)}</Body>
          {!!payment.failureReason && <Body>{payment.failureReason}</Body>}
          <ConfirmButton
            title="Hoàn tiền toàn bộ"
            disabled={
              busy ||
              stale ||
              payment.provider !== "VNPAY" ||
              payment.status !== "COMPLETED" ||
              payment.amountCents <= 0
            }
            description={`Hoàn lại toàn bộ ${money(payment.amountCents)}? Vé liên quan sẽ bị thu hồi.`}
            onConfirm={async () => {
              setBusy(true);
              setError("");
              setStale(true);
              try {
                setPayment(
                  await post<Payment>(
                    `/api/payment/requests/${payment.paymentRequestId}/refund`,
                  ),
                );
              } catch (error) {
                setError(
                  `${messageOf(error)} Hãy tra cứu lại trạng thái trước khi thử tiếp.`,
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </Card>
      )}
    </>
  );
}
export default function Admin() {
  return (
    <Gate roles={["ADMIN"]}>
      <AdminContent />
    </Gate>
  );
}
