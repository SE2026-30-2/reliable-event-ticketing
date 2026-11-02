import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import * as WebBrowser from "expo-web-browser";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Gate,
  Heading,
  Loading,
  Screen,
  Title,
  InfoRow,
  Notice,
} from "@/components/ui-kit";
import { useResource } from "@/hooks/use-resource";
import { post } from "@/lib/api";
import {
  findPayment,
  reservationTickets,
  syncPayment,
  terminalPayment,
} from "@/lib/payment";
import { dateTime, messageOf, money, type Payment } from "@/lib/types";

function CheckoutContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [tickets, payment] = await Promise.all([
        reservationTickets(id, signal),
        findPayment(id, signal),
      ]);
      return { tickets, payment };
    },
    [id],
  );
  const resource = useResource(load);
  const [updated, setUpdated] = useState<Payment | null>(null);
  const payment = updated || resource.data?.payment;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const focused = useRef(true);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const latest =
        payment?.txnRef && !terminalPayment(payment.status)
          ? await syncPayment(payment.txnRef)
          : await findPayment(id);
      setUpdated(latest);
      setUncertain(false);
      resource.reload();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [id, payment, resource]);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && focused.current) void refreshRef.current();
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!payment?.txnRef || payment.status !== "PENDING") return;
    const timer = setInterval(() => {
      if (focused.current && AppState.currentState === "active")
        void refreshRef.current();
    }, 5000);
    return () => clearInterval(timer);
  }, [payment?.txnRef, payment?.status]);
  async function create() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await post<Payment>("/api/payment/requests", {
        reservationId: id,
      });
      if (!result?.paymentRequestId || !result.status)
        throw new Error(
          "Chưa xác nhận được giao dịch. Hãy kiểm tra trạng thái trước khi thử lại.",
        );
      setUpdated(result);
      resource.reload();
    } catch (error) {
      setUncertain(true);
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function openPayment() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const url = new URL(payment?.paymentUrl || "");
      if (!["https:", "http:"].includes(url.protocol))
        throw new Error("Địa chỉ thanh toán không hợp lệ.");
      await WebBrowser.openBrowserAsync(url.href);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
    await refresh();
  }
  const tickets = resource.data?.tickets || [];
  const expiresAt = tickets[0]?.reservationExpiresAt;
  const remaining = expiresAt
    ? Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000))
    : 0;
  const canPay =
    tickets.length > 0 &&
    tickets.every((ticket) => ticket.status === "RESERVED") &&
    remaining > 0;
  return (
    <Screen>
      <Title>Thanh toán</Title>
      <Body muted>Hoàn tất thanh toán để giữ chỗ sự kiện</Body>
      <Body muted>Mã đặt vé: {id}</Body>
      <Feedback message={resource.error || error} />
      {resource.loading && <Loading />}
      {!!tickets.length && (
        <>
          {canPay && (
            <Notice>
              Thời gian giữ chỗ:{" "}
              {String(Math.floor(remaining / 60)).padStart(2, "0")}:
              {String(remaining % 60).padStart(2, "0")} · Vui lòng thanh toán
              trước khi hết hạn.
            </Notice>
          )}
          <Card>
            <Heading>Thông tin người nhận</Heading>
            <Body>
              {tickets[0].holderName} · {tickets[0].holderEmail}
            </Body>
            <Body>Số vé: {tickets.length}</Body>
            <Body>
              Giá vé:{" "}
              {money(
                tickets.reduce((sum, ticket) => sum + ticket.priceCents, 0),
              )}
            </Body>
            <Body muted>Hạn giữ vé: {dateTime(expiresAt)}</Body>
            {canPay && (
              <Body>
                Còn {Math.floor(remaining / 60)} phút {remaining % 60} giây
              </Body>
            )}
          </Card>
          <Card>
            <Heading>Thông tin vé</Heading>
            <InfoRow label="Số vé" value={tickets.length} />
            <InfoRow
              label="Tạm tính"
              value={money(
                tickets.reduce((sum, ticket) => sum + ticket.priceCents, 0),
              )}
            />
            <Body muted>
              Tổng thanh toán được xác nhận từ máy chủ khi tạo giao dịch.
            </Body>
          </Card>
        </>
      )}
      {payment ? (
        <Card>
          <Badge>{payment.status}</Badge>
          <Heading>
            {payment.status === "COMPLETED"
              ? "Thanh toán thành công"
              : payment.status === "PENDING"
                ? "Đang chờ thanh toán"
                : "Kết quả thanh toán"}
          </Heading>
          <Body>Tổng thanh toán: {money(payment.amountCents)}</Body>
          <Body>Nhà cung cấp: {payment.provider}</Body>
          <Body muted>
            Mã giao dịch: {payment.txnRef || payment.paymentRequestId}
          </Body>
          {!!payment.completedAt && (
            <Body>{dateTime(payment.completedAt)}</Body>
          )}
          {!!payment.failureReason && <Body>{payment.failureReason}</Body>}
          {payment.status === "PENDING" && (
            <>
              <Body muted>
                Hoàn tất trong trình duyệt, sau đó quay lại ứng dụng để kiểm tra
                kết quả.
              </Body>
              {!!payment.paymentUrl && canPay && (
                <Button
                  title="Mở cổng thanh toán VNPay"
                  disabled={busy}
                  onPress={openPayment}
                />
              )}
            </>
          )}
          {payment.status === "COMPLETED" && (
            <Body muted>
              Vé đang được phát hành. Tải lại Vé của tôi nếu chưa thấy mã QR.
            </Body>
          )}
          {payment.status === "REFUND_REQUIRED" && (
            <Body>Giao dịch cần được quản trị viên đối soát và hoàn tiền.</Body>
          )}
          {["FAILED", "EXPIRED"].includes(payment.status) &&
            tickets[0]?.eventId && (
              <Button
                secondary
                title="Quay lại sự kiện để đặt vé"
                onPress={() =>
                  router.replace({
                    pathname: "/events/[id]",
                    params: { id: tickets[0].eventId },
                  })
                }
              />
            )}
        </Card>
      ) : (
        !resource.loading &&
        !resource.error && (
          <Card>
            <Body>
              {canPay
                ? "Thanh toán qua nhà cung cấp được cấu hình trên hệ thống. Vé miễn phí cũng cần xác nhận."
                : "Không có vé đang giữ hoặc đã hết hạn giữ vé."}
            </Body>
            {canPay && (
              <Button
                title="Xác nhận thanh toán"
                busy={busy}
                disabled={uncertain}
                onPress={create}
              />
            )}
          </Card>
        )
      )}
      {uncertain && (
        <Body muted>
          Yêu cầu có thể đã được xử lý. Kiểm tra trạng thái trước khi thử tiếp.
        </Body>
      )}
      <Button
        secondary
        title="Kiểm tra trạng thái thanh toán"
        busy={busy}
        onPress={refresh}
      />
      <Button
        secondary
        title="Xem vé của tôi"
        onPress={() => router.push("/(tabs)/tickets")}
      />
    </Screen>
  );
}
export default function Checkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Gate>
      <CheckoutContent key={id} />
    </Gate>
  );
}
