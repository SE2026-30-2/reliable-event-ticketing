import { useCallback, useState } from "react";
import { Platform, View } from "react-native";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Heading,
  Loading,
  colors,
} from "@/components/ui-kit";
import { request } from "@/lib/api";
import { useLiveResource } from "@/hooks/use-live-resource";
import { dateTime, messageOf } from "@/lib/types";

interface Stats {
  totalIssued: number;
  acceptedCount: number;
  duplicateCount: number;
  deviceRejectedCount: number;
  invalidCount: number;
}
interface Bucket {
  bucketStart: string;
  accepted: number;
  duplicate: number;
  rejected: number;
}
export function CheckinReport({ id }: { id: string }) {
  const loadLive = useCallback(
    async (signal: AbortSignal) => {
      const [stats, timeline] = await Promise.all([
        request<Stats>(`/api/checkin/events/${id}/stats`, { signal }),
        request<Bucket[]>(
          `/api/checkin/events/${id}/timeline?bucketMinutes=15`,
          { signal },
        ),
      ]);
      return { stats, timeline, updatedAt: new Date().toISOString() };
    },
    [id],
  );
  const live = useLiveResource(loadLive);
  const stats = { ...live, data: live.data?.stats };
  const timeline = { ...live, data: live.data?.timeline };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function exportCsv(kind: "attendees" | "payments") {
    setBusy(true);
    setError("");
    try {
      const csv = await request<string>(
        `/api/manage/events/${id}/${kind}.csv`,
        { responseType: "text" },
      );
      const content = csv.startsWith("\ufeff") ? csv : `\ufeff${csv}`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([content], { type: "text/csv;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `${kind}-${id}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const [{ File, Paths }, Sharing] = await Promise.all([
          import("expo-file-system"),
          import("expo-sharing"),
        ]);
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("Thiết bị không hỗ trợ chia sẻ tệp.");
        }
        const filename = `${kind}-${id}.csv`;
        const file = new File(Paths.cache, filename);
        file.create({ overwrite: true });
        await file.write(content);
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: filename,
        });
      }
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }
  const max = Math.max(
    1,
    ...(timeline.data || []).map((bucket) => bucket.accepted),
  );
  return (
    <>
      <Body muted>
        Tự cập nhật mỗi 5 giây · Lần cuối: {dateTime(live.data?.updatedAt)}
      </Body>
      <Button secondary title="Làm mới báo cáo soát vé" onPress={live.reload} />
      <Card>
        <Heading>Thống kê soát vé</Heading>
        <Feedback message={stats.error} retry={stats.reload} />
        {stats.loading ? (
          <Loading />
        ) : (
          stats.data && (
            <>
              <Body>Vé phát hành: {stats.data.totalIssued}</Body>
              <Badge>Đã chấp nhận: {stats.data.acceptedCount}</Badge>
              <Body>Lượt trùng: {stats.data.duplicateCount}</Body>
              <Body>Thiết bị bị từ chối: {stats.data.deviceRejectedCount}</Body>
              <Body>Vé không hợp lệ: {stats.data.invalidCount}</Body>
            </>
          )
        )}
      </Card>
      <Card>
        <Heading>Lượt vào cửa theo 15 phút</Heading>
        <Feedback message={timeline.error} retry={timeline.reload} />
        {timeline.loading ? (
          <Loading />
        ) : !timeline.data?.length ? (
          <Body muted>Chưa có lượt soát vé.</Body>
        ) : (
          timeline.data.map((bucket) => (
            <View key={bucket.bucketStart} style={{ gap: 6 }}>
              <Body muted>{dateTime(bucket.bucketStart)}</Body>
              <View
                style={{
                  height: 8,
                  backgroundColor: colors.soft,
                  borderRadius: 4,
                }}
              >
                <View
                  style={{
                    height: 8,
                    width: `${(bucket.accepted / max) * 100}%`,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                  }}
                />
              </View>
              <Body>
                Hợp lệ {bucket.accepted} · Trùng {bucket.duplicate} · Từ chối{" "}
                {bucket.rejected}
              </Body>
            </View>
          ))
        )}
      </Card>
      <Card>
        <Heading>Xuất báo cáo CSV</Heading>
        <Feedback message={error} />
        <Button
          secondary
          title={Platform.OS === "web" ? "Tải CSV người tham dự" : "Chia sẻ tệp CSV người tham dự"}
          disabled={busy}
          onPress={() => exportCsv("attendees")}
        />
        <Button
          secondary
          title={Platform.OS === "web" ? "Tải CSV thanh toán" : "Chia sẻ tệp CSV thanh toán"}
          disabled={busy}
          onPress={() => exportCsv("payments")}
        />
      </Card>
    </>
  );
}
