import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";
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
  styles,
} from "@/components/ui-kit";
import { ConfirmButton } from "@/components/confirm-button";
import { useResource } from "@/hooks/use-resource";
import { request } from "@/lib/api";
import {
  dateTime,
  listOf,
  messageOf,
  money,
  type Page,
  type Ticket,
  type WaitlistEntry,
} from "@/lib/types";
function TicketsContent() {
  const [tab, setTab] = useState<"tickets" | "waitlist">("tickets");
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const load = useCallback(
    async (signal: AbortSignal): Promise<(Ticket | WaitlistEntry)[]> => {
      if (tab === "waitlist") {
        setTotalPages(1);
        return request<WaitlistEntry[] | Page<WaitlistEntry>>(
          "/api/my/waitlist",
          { signal },
        ).then(listOf);
      }
      const data = await request<Ticket[] | Page<Ticket>>(
        `/api/my/tickets?page=${page}&size=20`,
        { signal },
      );
      if (!signal.aborted)
        setTotalPages(
          Array.isArray(data) ? Math.ceil(data.length / 20) : data.totalPages,
        );
      return Array.isArray(data)
        ? data.slice(page * 20, (page + 1) * 20)
        : data.content;
    },
    [tab, page],
  );
  const resource = useResource<(Ticket | WaitlistEntry)[]>(load);
  const { reload } = resource;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return (
    <Screen>
      <Title>Vé của tôi & Hàng đợi</Title>
      <Body muted>Quản lý vé đã đặt và theo dõi danh sách chờ.</Body>
      <View style={styles.row}>
        <Button
          title="Vé của tôi"
          secondary={tab !== "tickets"}
          onPress={() => setTab("tickets")}
        />
        <Button
          title="Danh sách chờ"
          secondary={tab !== "waitlist"}
          onPress={() => setTab("waitlist")}
        />
      </View>
      <Feedback message={resource.error || error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        !resource.error && (
          <>
            {!resource.data?.length && (
              <Card>
                <Body muted>
                  {tab === "tickets"
                    ? "Bạn chưa có vé nào. Khám phá sự kiện để bắt đầu!"
                    : "Bạn chưa tham gia danh sách chờ nào."}
                </Body>
                <Button
                  secondary
                  title="Khám phá sự kiện"
                  onPress={() => router.push("/(tabs)")}
                />
              </Card>
            )}
            {resource.data?.map((item) =>
              tab === "tickets" ? (
                <TicketCard
                  key={(item as Ticket).ticketId}
                  ticket={item as Ticket}
                />
              ) : (
                <Card key={(item as WaitlistEntry).entryId}>
                  <Badge>{item.status}</Badge>
                  <Heading>Danh sách chờ</Heading>
                  <Body>Mã: {(item as WaitlistEntry).entryId}</Body>
                  <Body>Số lượng: {(item as WaitlistEntry).quantity}</Body>
                  <Body muted>
                    Được mời lúc: {dateTime((item as WaitlistEntry).offeredAt)}
                  </Body>
                  {!!(item as WaitlistEntry).reservationId && (
                    <Body>
                      Mã đặt vé: {(item as WaitlistEntry).reservationId}
                    </Body>
                  )}
                  {["WAITING", "OFFERED"].includes(item.status) && (
                    <ConfirmButton
                      title="Rời danh sách chờ"
                      description="Bạn sẽ nhường vị trí cho người tiếp theo. Tiếp tục?"
                      onConfirm={async () => {
                        setError("");
                        try {
                          await request(
                            `/api/waitlist/${(item as WaitlistEntry).entryId}`,
                            { method: "DELETE" },
                          );
                          resource.reload();
                        } catch (error) {
                          setError(messageOf(error));
                        }
                      }}
                    />
                  )}
                </Card>
              ),
            )}
          </>
        )
      )}
      {tab === "tickets" && (
        <View style={styles.row}>
          <Button
            secondary
            title="← Trước"
            disabled={page === 0 || resource.loading}
            onPress={() => setPage(page - 1)}
          />
          <Body>
            Trang {page + 1} / {Math.max(1, totalPages)}
          </Body>
          <Button
            secondary
            title="Sau →"
            disabled={resource.loading || page + 1 >= totalPages}
            onPress={() => setPage(page + 1)}
          />
        </View>
      )}
      <Button secondary title="Tải lại" onPress={resource.reload} />
    </Screen>
  );
}
function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card>
      <Badge>{ticket.status}</Badge>
      <Heading>{ticket.holderName}</Heading>
      <Body muted>{ticket.holderEmail}</Body>
      <Body>Mã vé: {ticket.ticketId}</Body>
      <Body>{money(ticket.priceCents)}</Body>
      {ticket.status === "RESERVED" && (
        <Body muted>Giữ đến: {dateTime(ticket.reservationExpiresAt)}</Body>
      )}
      <Button
        secondary
        title="Xem vé & mã QR"
        onPress={() =>
          router.push({
            pathname: "/tickets/[id]",
            params: { id: ticket.ticketId },
          })
        }
      />
      <Button
        secondary
        title="Xem sự kiện"
        onPress={() =>
          router.push({
            pathname: "/events/[id]",
            params: { id: ticket.eventId },
          })
        }
      />
    </Card>
  );
}
export default function Tickets() {
  return (
    <Gate>
      <TicketsContent />
    </Gate>
  );
}
