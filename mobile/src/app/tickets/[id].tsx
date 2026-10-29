import { useCallback, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
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
} from "@/components/ui-kit";
import { ConfirmButton } from "@/components/confirm-button";
import { useResource } from "@/hooks/use-resource";
import { post, request } from "@/lib/api";
import { dateTime, isEmail, messageOf, type Ticket } from "@/lib/types";
function TicketContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(
    (signal: AbortSignal) =>
      request<Ticket>(`/api/ticket/${encodeURIComponent(id)}`, { signal }),
    [id],
  );
  const resource = useResource(load);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const ticket = resource.data;
  async function transfer() {
    setError("");
    setNotice("");
    if (!name.trim() || !isEmail(email)) {
      setError("Nhập họ tên và email người nhận hợp lệ.");
      return;
    }
    try {
      await post(`/api/ticket/${id}/transfer`, {
        toEmail: email.trim(),
        holderName: name.trim(),
      });
      setNotice("Đã chuyển nhượng vé. Mã QR cũ không còn hiệu lực.");
      resource.reload();
    } catch (error) {
      setError(messageOf(error));
    }
  }
  return (
    <Screen>
      <Title>Vé điện tử</Title>
      <Feedback
        message={resource.error || error}
        retry={resource.error ? resource.reload : undefined}
      />
      {!!notice && <Body>{notice}</Body>}
      {resource.loading ? (
        <Loading />
      ) : (
        ticket &&
        !resource.error && (
          <>
            <Card>
              <Badge>{ticket.status}</Badge>
              <Heading>{ticket.holderName}</Heading>
              <Body>{ticket.holderEmail}</Body>
              <Body muted>Mã vé: {ticket.ticketId}</Body>
              <Body muted>
                Hiệu lực: {dateTime(ticket.validFrom)} →{" "}
                {dateTime(ticket.validUntil)}
              </Body>
              {ticket.status === "ISSUED" && ticket.qrPayload ? (
                <View
                  accessibilityLabel="Mã QR vé"
                  accessibilityRole="image"
                  style={{ alignItems: "center", paddingVertical: 20 }}
                >
                  <QRCode value={ticket.qrPayload} size={220} />
                </View>
              ) : (
                <Body muted>Mã QR chỉ được hiển thị khi vé đã phát hành.</Body>
              )}
              <Button
                secondary
                title="Gửi lại email vé"
                busy={busy}
                disabled={ticket.status !== "ISSUED"}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await post(`/api/ticket/${id}/resend`, {});
                    setNotice("Đã yêu cầu gửi lại email vé.");
                  } catch (error) {
                    setError(messageOf(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Card>
            {ticket.status === "ISSUED" && (
              <Card>
                <Heading>Chuyển nhượng vé</Heading>
                <Body muted>
                  Người nhận sẽ được cấp vé mới. Vé hiện tại sẽ mất hiệu lực.
                </Body>
                <Field
                  label="Họ tên người nhận"
                  value={name}
                  onChangeText={setName}
                />
                <Field
                  label="Email người nhận"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <ConfirmButton
                  title="Chuyển nhượng vé"
                  description={`Chuyển vé cho ${name} (${email})? Thao tác này sẽ vô hiệu hóa vé hiện tại.`}
                  onConfirm={transfer}
                />
              </Card>
            )}
          </>
        )
      )}
    </Screen>
  );
}
export default function TicketDetail() {
  return (
    <Gate>
      <TicketContent />
    </Gate>
  );
}
