import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  Body,
  Button,
  Card,
  Feedback,
  Heading,
  Loading,
  colors,
} from "./ui-kit";
import { FilterOptions } from "./filter-options";
import { request } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import { money } from "@/lib/types";

interface Analytics {
  views: number;
  timezone: string;
  daily: { date: string; ticketsSold: number; revenueCents: number }[];
}
export function SalesReport({ id }: { id: string }) {
  const [days, setDays] = useState("7");
  const [details, setDetails] = useState(false);
  const load = useCallback(
    (signal: AbortSignal) => {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      return request<Analytics>(
        `/api/manage/events/${encodeURIComponent(id)}/analytics?days=${days}&timezone=${encodeURIComponent(timezone)}`,
        { signal },
      );
    },
    [id, days],
  );
  const resource = useResource(load);
  const points = resource.data?.daily || [];
  const total = points.reduce(
    (sum, p) => ({
      tickets: sum.tickets + p.ticketsSold,
      revenue: sum.revenue + p.revenueCents,
    }),
    { tickets: 0, revenue: 0 },
  );
  const maxTickets = Math.max(1, ...points.map((p) => p.ticketsSold));
  const maxRevenue = Math.max(1, ...points.map((p) => p.revenueCents));
  return (
    <Card>
      <Heading>Doanh thu theo ngày</Heading>
      <FilterOptions
        label="Khoảng thống kê"
        value={days}
        options={[
          ["7", "7 ngày"],
          ["30", "30 ngày"],
          ["90", "90 ngày"],
        ]}
        onChange={setDays}
      />
      <Button
        secondary
        title="Làm mới thống kê doanh thu"
        onPress={resource.reload}
      />
      <Feedback message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <Body>Lượt xem sự kiện: {resource.data.views}</Body>
            <Body>Múi giờ: {resource.data.timezone}</Body>
            <Body>Vé mua trong kỳ: {total.tickets}</Body>
            <Heading>Tiền thu trong kỳ: {money(total.revenue)}</Heading>
            <Body muted>
              Cột tím: vé mua · Cột xanh: tiền thu. Mỗi chuỗi dùng thang riêng.
            </Body>
            <View
              style={{
                flexDirection: "row",
                height: 100,
                gap: 2,
                alignItems: "flex-end",
              }}
              accessibilityLabel="Biểu đồ vé mua và tiền thu theo ngày"
            >
              {points.map((p) => (
                <View
                  key={p.date}
                  style={{
                    flex: 1,
                    height: 100,
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: 1,
                  }}
                  accessibilityLabel={`${p.date}: ${p.ticketsSold} vé, ${money(p.revenueCents)}`}
                >
                  <View
                    style={{
                      flex: 1,
                      height: `${(p.ticketsSold / maxTickets) * 100}%`,
                      backgroundColor: colors.primary,
                    }}
                  />
                  <View
                    style={{
                      flex: 1,
                      height: `${(p.revenueCents / maxRevenue) * 100}%`,
                      backgroundColor: colors.success,
                    }}
                  />
                </View>
              ))}
            </View>
            <Body muted>
              {points[0]?.date} → {points.at(-1)?.date}
            </Body>
            {total.tickets === 0 && (
              <Body muted>
                Chưa có giao dịch hoàn tất trong khoảng thời gian này.
              </Body>
            )}
            <Button
              secondary
              title={details ? "Ẩn số liệu theo ngày" : "Xem số liệu theo ngày"}
              onPress={() => setDetails(!details)}
            />
            {details &&
              points.map((p) => (
                <Body key={p.date}>
                  {p.date}: {p.ticketsSold} vé · {money(p.revenueCents)}
                </Body>
              ))}
            <Body muted>
              Theo ngày hoàn tất thanh toán; không gồm vé mời và giao dịch đã
              hoàn tiền.
            </Body>
          </>
        )
      )}
    </Card>
  );
}
