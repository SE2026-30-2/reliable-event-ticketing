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
} from "@/components/ui-kit";
import { useResource } from "@/hooks/use-resource";
import { syncPayment } from "@/lib/payment";
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
        <Card>
          <Title>
            {resource.data.status === "COMPLETED"
              ? "Thanh toán thành công"
              : resource.data.status === "PENDING"
                ? "Đang chờ xác nhận"
                : resource.data.status}
          </Title>
          <Body>{money(resource.data.amountCents)}</Body>
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
