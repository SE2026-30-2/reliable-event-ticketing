import { useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  Card,
  Feedback,
  Gate,
  Loading,
  Screen,
  Title,
  InfoRow,
  Notice,
} from "@/components/ui-kit";
import { useResource } from "@/hooks/use-resource";
import { syncPayment } from "@/lib/payment";
import { AuthArtwork } from "@/components/auth-artwork";
import { money } from "@/lib/types";
function ResultContent() {
  const { vnp_TxnRef, txnRef } = useLocalSearchParams<{
    vnp_TxnRef?: string;
    txnRef?: string;
  }>();
  const reference = vnp_TxnRef || txnRef;
  const load = useCallback(async () => {
    if (!reference)
      throw new Error(
        "Thiếu mã giao dịch. Mở thanh toán từ Vé của tôi để kiểm tra.",
      );
    return syncPayment(reference);
  }, [reference]);
  const resource = useResource(load);
  return (
    <Screen>
      <Title>Kết quả thanh toán</Title>
      {resource.loading && <Loading />}
      <Feedback message={resource.error} retry={resource.reload} />
      {resource.data && (
        <>
          <AuthArtwork
            kind={
              resource.data.status === "COMPLETED"
                ? "success"
                : ["FAILED", "EXPIRED"].includes(resource.data.status)
                  ? "failure"
                  : "pending"
            }
          />
          <Card>
            <Title>
              {resource.data.status === "COMPLETED"
                ? "Thanh toán thành công"
                : resource.data.status === "PENDING"
                  ? "Đang chờ xác nhận"
                  : resource.data.status}
            </Title>
            <Body>{money(resource.data.amountCents)}</Body>
            <InfoRow
              label="Mã giao dịch"
              value={resource.data.paymentRequestId}
            />
            <InfoRow
              label="Phương thức thanh toán"
              value={resource.data.provider}
            />
            {resource.data.status === "COMPLETED" && (
              <Notice success>
                Vé của bạn đã được xác nhận. Mở Vé của tôi để xem vé đã phát
                hành.
              </Notice>
            )}
            {!!resource.data.failureReason && (
              <Body>{resource.data.failureReason}</Body>
            )}
            <Button
              title="Xem chi tiết giao dịch"
              onPress={() =>
                router.replace({
                  pathname: "/checkout/[id]",
                  params: { id: resource.data!.reservationId },
                })
              }
            />
          </Card>
        </>
      )}
      <Button
        secondary
        title="Xem vé của tôi"
        onPress={() => router.replace("/(tabs)/tickets")}
      />
    </Screen>
  );
}
export default function PaymentResult() {
  return (
    <Gate>
      <ResultContent />
    </Gate>
  );
}
