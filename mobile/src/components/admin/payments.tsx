import { useEffect, useRef, useState } from "react";
import { post, request } from "@/lib/api";
import { isUuid } from "@/lib/management";
import { dateTime, messageOf, money, type Payment } from "@/lib/types";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Heading,
  InfoRow,
  Notice,
} from "../ui-kit";
import { FilterOptions } from "../filter-options";
import { ConfirmButton } from "../confirm-button";

export function AdminPayments() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("reservation");
  const [payment, setPayment] = useState<Payment>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"lookup" | "refund" | null>(null);
  const [stale, setStale] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const refundLock = useRef(false);
  useEffect(
    () => () => {
      version.current++;
      controller.current?.abort();
    },
    [],
  );
  function edit(value: string, type = kind) {
    if (refundLock.current) return;
    version.current++;
    controller.current?.abort();
    controller.current = null;
    setQuery(value);
    setKind(type);
    setPayment(undefined);
    setError("");
    setNotice("");
    setStale(true);
    setBusy(null);
  }
  async function lookup() {
    if (refundLock.current || !isUuid(query)) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const generation = ++version.current;
    const id = query.trim().toLowerCase();
    setBusy("lookup");
    setError("");
    setNotice("");
    setPayment(undefined);
    setStale(true);
    try {
      const result = await request<Payment>(
        kind === "reservation"
          ? `/api/admin/payments/by-reservation/${encodeURIComponent(id)}`
          : `/api/admin/payments/${encodeURIComponent(id)}`,
        { signal: abort.signal },
      );
      if (abort.signal.aborted || generation !== version.current) return;
      if (
        !result ||
        !isUuid(result.paymentRequestId || "") ||
        !isUuid(result.reservationId || "") ||
        (kind === "reservation"
          ? result.reservationId
          : result.paymentRequestId
        ).toLowerCase() !== id ||
        !Number.isSafeInteger(result.amountCents) ||
        result.amountCents < 0 ||
        ![
          "PENDING",
          "COMPLETED",
          "FAILED",
          "REFUND_REQUIRED",
          "REFUNDED",
          "EXPIRED",
        ].includes(result.status)
      )
        throw new Error(
          "Phản hồi tra cứu không khớp giao dịch. Vui lòng tra cứu lại.",
        );
      setPayment(result);
      setStale(false);
    } catch (error) {
      if (!abort.signal.aborted && generation === version.current)
        setError(messageOf(error));
    } finally {
      if (generation === version.current) {
        controller.current = null;
        setBusy(null);
      }
    }
  }
  const eligible =
    !!payment &&
    !stale &&
    !busy &&
    payment.provider === "VNPAY" &&
    payment.status === "COMPLETED" &&
    payment.amountCents > 0;
  async function refund() {
    if (!eligible || !payment || refundLock.current) return;
    refundLock.current = true;
    setBusy("refund");
    setStale(true);
    setError("");
    try {
      const result = await post<Payment>(
        `/api/payment/requests/${encodeURIComponent(payment.paymentRequestId)}/refund`,
      );
      if (
        !result ||
        result.paymentRequestId !== payment.paymentRequestId ||
        result.reservationId !== payment.reservationId ||
        result.status !== "REFUNDED" ||
        result.amountCents !== payment.amountCents
      )
        throw new Error("Máy chủ chưa xác nhận hoàn tiền đúng giao dịch.");
      setPayment(result);
      setNotice(
        "Máy chủ đã xác nhận hoàn tiền. Vé liên quan đang được cập nhật.",
      );
    } catch (error) {
      setError(
        `${messageOf(error)} Hãy tra cứu lại trạng thái trước khi thử tiếp.`,
      );
    } finally {
      refundLock.current = false;
      setBusy(null);
    }
  }
  return (
    <>
      <Heading>Tra cứu & Hoàn tiền</Heading>
      <Card>
        <FilterOptions
          label="Loại mã tra cứu"
          value={kind}
          disabled={busy === "refund"}
          options={[
            ["reservation", "Mã đặt vé"],
            ["payment", "Mã thanh toán"],
          ]}
          onChange={(type) => edit("", type)}
        />
        <Field
          label={
            kind === "reservation"
              ? "Mã đặt vé (reservation ID)"
              : "Mã thanh toán (payment ID)"
          }
          value={query}
          editable={busy !== "refund"}
          onChangeText={(value) => edit(value)}
          autoCapitalize="none"
        />
        <Body muted>
          ADMIN có thể tra cứu giao dịch của mọi tài khoản, gồm VNPay, miễn phí
          và mock.
        </Body>
        <Button
          title="Tra cứu giao dịch"
          busy={busy === "lookup"}
          disabled={busy === "refund" || !isUuid(query)}
          onPress={lookup}
        />
      </Card>
      <Feedback message={error} />
      {!!notice && <Notice success>{notice}</Notice>}
      {payment && (
        <Card>
          <Badge>{payment.status}</Badge>
          <Heading>{money(payment.amountCents)}</Heading>
          <InfoRow label="Tổng thanh toán" value={money(payment.amountCents)} />
          <Body>Nhà cung cấp: {payment.provider}</Body>
          <Body>Mã đặt vé: {payment.reservationId}</Body>
          <Body>Mã giao dịch: {payment.paymentRequestId}</Body>
          <Body muted>Tạo lúc: {dateTime(payment.createdAt)}</Body>
          {!!payment.completedAt && (
            <Body muted>Hoàn tất: {dateTime(payment.completedAt)}</Body>
          )}
          {!!payment.failureReason && <Body>{payment.failureReason}</Body>}
          <ConfirmButton
            danger={false}
            key={payment.paymentRequestId}
            title="Hoàn tiền toàn bộ"
            disabled={!eligible}
            description={`Hoàn lại toàn bộ ${money(payment.amountCents)} cho đơn ${payment.reservationId}? Vé liên quan sẽ bị thu hồi.`}
            onConfirm={refund}
          />
        </Card>
      )}
    </>
  );
}
