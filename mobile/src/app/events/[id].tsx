import { useCallback, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import {
  Badge,
  Banner,
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Heading,
  Loading,
  Screen,
  Title,
  styles,
} from "@/components/ui-kit";
import { useAuth } from "@/contexts/auth";
import { useResource } from "@/hooks/use-resource";
import { post, request } from "@/lib/api";
import {
  dateTime,
  isEmail,
  messageOf,
  money,
  type Event,
  type Quote,
  type Reservation,
  type TicketType,
} from "@/lib/types";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, ready } = useAuth();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [event, types] = await Promise.all([
        request<Event>(`/api/event/${encodeURIComponent(id)}`, {
          signal,
          public: true,
        }),
        request<TicketType[]>(
          `/api/event/${encodeURIComponent(id)}/ticket-types`,
          { signal, public: true },
        ),
      ]);
      return { event, types };
    },
    [id],
  );
  const resource = useResource(load);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [nameInput, setName] = useState<string>();
  const [emailInput, setEmail] = useState<string>();
  const name = nameInput ?? user?.fullName ?? "";
  const email = emailInput ?? user?.email ?? "";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [reservation, setReservation] = useState<Reservation>();
  const [joined, setJoined] = useState(false);
  const selected =
    resource.data?.types.find((type) => type.ticketTypeId === selectedId) ||
    resource.data?.types[0];
  const ticketId = selected?.ticketTypeId;
  const waiting = !!selected && selected.remaining < quantity;
  const loadQuote = useCallback(
    (signal: AbortSignal) => {
      if (!ticketId || waiting) return Promise.resolve(null);
      return request<Quote>(
        `/api/ticket-types/${encodeURIComponent(ticketId)}/quote?quantity=${quantity}&coupon=${encodeURIComponent(appliedCoupon)}`,
        { signal, public: true },
      );
    },
    [ticketId, quantity, appliedCoupon, waiting],
  );
  const {
    data: quote,
    loading: quoteBusy,
    error: quoteError,
  } = useResource(loadQuote);
  async function book() {
    if (lock.current || !selected) return;
    if (!user) {
      router.push({ pathname: "/login", params: { eventId: id } });
      return;
    }
    if (!user.emailVerified) {
      setError(
        "Vui lòng xác minh email trong phần Tài khoản trước khi đặt vé.",
      );
      return;
    }
    if (!name.trim() || !isEmail(email)) {
      setError("Nhập họ tên và email người nhận vé hợp lệ.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const body = {
        quantity,
        holderName: name.trim(),
        holderEmail: email.trim(),
      };
      if (waiting) {
        await post(`/api/ticket-types/${selected.ticketTypeId}/waitlist`, body);
        setJoined(true);
      } else {
        setReservation(
          await post<Reservation>(
            `/api/ticket-types/${selected.ticketTypeId}/reservations`,
            { ...body, couponCode: appliedCoupon || undefined },
          ),
        );
      }
    } catch (error) {
      setError(messageOf(error));
      resource.reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (resource.loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (resource.error || !resource.data)
    return (
      <Screen>
        <Feedback
          message={resource.error || "Không tìm thấy sự kiện."}
          retry={resource.reload}
        />
      </Screen>
    );
  const { event, types } = resource.data;
  return (
    <Screen>
      <Banner uri={event.bannerUrl} />
      <Badge>{event.status}</Badge>
      <Title>{event.name}</Title>
      <Body muted>{event.venue}</Body>
      <Body muted>
        {dateTime(event.startsAt)} → {dateTime(event.endsAt)}
      </Body>
      <Card>
        <Heading>Giới thiệu sự kiện</Heading>
        <Body>{event.description || "Ban tổ chức chưa cập nhật mô tả."}</Body>
      </Card>
      {reservation ? (
        <Card>
          <Heading>Đã giữ vé</Heading>
          <Body>Mã đặt vé: {reservation.reservationId}</Body>
          <Body>Tổng tiền: {money(reservation.totalCents)}</Body>
          <Body muted>
            Hạn giữ vé: {dateTime(reservation.tickets[0]?.reservationExpiresAt)}
          </Body>
          <Body muted>
            Vé đang được giữ chỗ. Chức năng thanh toán trên mobile chưa được hỗ
            trợ.
          </Body>
          <Button
            title="Xem vé của tôi"
            onPress={() => router.push("/(tabs)/tickets")}
          />
        </Card>
      ) : joined ? (
        <Card>
          <Heading>Đã tham gia danh sách chờ</Heading>
          <Body muted>Theo dõi trạng thái trong Vé của tôi.</Body>
          <Button
            title="Xem danh sách chờ"
            onPress={() => router.push("/(tabs)/tickets")}
          />
        </Card>
      ) : (
        <Card>
          <Heading>Chọn vé của bạn</Heading>
          {types.length === 0 && <Body muted>Sự kiện chưa mở bán vé.</Body>}
          {types.map((type) => (
            <Button
              key={type.ticketTypeId}
              secondary={selected?.ticketTypeId !== type.ticketTypeId}
              title={`${type.name} · ${money(type.priceCents)} · Còn ${type.remaining}`}
              disabled={busy}
              onPress={() => {
                setSelectedId(type.ticketTypeId);
                setError("");
              }}
            />
          ))}
          {selected && (
            <>
              <Body muted>
                Mỗi đơn vị gồm {selected.bundleSize} vé · Mỗi vé vào cửa tối đa{" "}
                {selected.maxEntries} lượt
              </Body>
              <View style={styles.row}>
                <Button
                  secondary
                  title="−"
                  disabled={quantity <= 1 || busy}
                  onPress={() => setQuantity(quantity - 1)}
                />
                <Body>Số lượng: {quantity}</Body>
                <Button
                  secondary
                  title="+"
                  disabled={quantity >= 10 || busy}
                  onPress={() => setQuantity(quantity + 1)}
                />
              </View>
              {!waiting && (
                <>
                  <Field
                    label="Mã ưu đãi"
                    value={coupon}
                    editable={!busy}
                    onChangeText={setCoupon}
                    autoCapitalize="characters"
                    maxLength={40}
                  />
                  <Button
                    secondary
                    title="Áp dụng mã"
                    disabled={busy || coupon.trim() === appliedCoupon}
                    onPress={() => setAppliedCoupon(coupon.trim())}
                  />
                  <Feedback message={quoteError} />
                  {quoteBusy ? (
                    <Loading />
                  ) : (
                    quote && (
                      <>
                        <Body>Tạm tính: {money(quote.grossCents)}</Body>
                        <Body>Giảm giá: {money(quote.discountCents)}</Body>
                        <Heading>Tổng tiền: {money(quote.totalCents)}</Heading>
                      </>
                    )
                  )}
                </>
              )}
              <Field
                label="Họ tên người nhận vé"
                value={name}
                editable={!busy}
                onChangeText={setName}
              />
              <Field
                label="Email người nhận vé"
                value={email}
                editable={!busy}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Feedback message={error} />
              <Button
                title={
                  !user
                    ? "Đăng nhập để đặt vé"
                    : waiting
                      ? "Tham gia danh sách chờ"
                      : "Giữ vé"
                }
                busy={busy}
                disabled={
                  !ready ||
                  (!!user && !waiting && (quoteBusy || !quote)) ||
                  event.status !== "PUBLISHED"
                }
                onPress={book}
              />
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}
