import { useRef, useState } from "react";
import { ConfirmButton } from "./confirm-button";
import { eventStatuses } from "@/lib/management";
import {
  Badge,
  Button,
  Card,
  Feedback,
  Field,
  Heading,
} from "@/components/ui-kit";
import { patch, post } from "@/lib/api";
import { messageOf, type Event } from "@/lib/types";

export function EventForm({
  event,
  onSaved,
  onBusyChange,
  embedded = false,
}: {
  event?: Event;
  onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
  embedded?: boolean;
}) {
  const [name, setName] = useState(event?.name || "");
  const [venue, setVenue] = useState(event?.venue || "");
  const [starts, setStarts] = useState(event?.startsAt || "");
  const [ends, setEnds] = useState(event?.endsAt || "");
  const [description, setDescription] = useState(event?.description || "");
  const [banner, setBanner] = useState(event?.bannerUrl || "");
  const [status, setStatus] = useState(event?.status || "DRAFT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const final = !!event && ["CANCELLED", "COMPLETED"].includes(event.status);
  const statuses = eventStatuses(event);
  async function save() {
    if (lock.current || final) return;
    setError("");
    if (!statuses.includes(status)) {
      setError("Không thể chuyển trạng thái sự kiện như đã chọn.");
      return;
    }
    const start = Date.parse(starts),
      end = Date.parse(ends);
    if (
      !name.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      // This check runs only in the submit/confirmation handler.
      // eslint-disable-next-line react-hooks/purity
      (!event && start <= Date.now())
    ) {
      setError(
        "Nhập tên và thời gian hợp lệ. Kết thúc phải sau bắt đầu; sự kiện mới phải ở tương lai.",
      );
      return;
    }
    if (banner && !/^https?:\/\//i.test(banner)) {
      setError("Ảnh bìa phải là địa chỉ http hoặc https.");
      return;
    }
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    const body = {
      name: name.trim(),
      venue: venue.trim(),
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      description,
      bannerUrl: banner.trim(),
      status,
    };
    try {
      if (event) await patch(`/api/event/${event.eventId}`, body);
      else await post("/api/event", body);
      onSaved();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <Card
      style={
        embedded
          ? { borderWidth: 0, padding: 0, backgroundColor: "transparent" }
          : undefined
      }
    >
      {!embedded && (
        <Heading>{event ? "Chỉnh sửa sự kiện" : "Tạo sự kiện mới"}</Heading>
      )}
      <Feedback message={error} />
      {final && (
        <Heading>Sự kiện đã kết thúc hoặc bị hủy, không thể chỉnh sửa.</Heading>
      )}
      <Field
        label="Tên sự kiện"
        value={name}
        onChangeText={setName}
        maxLength={255}
        editable={!busy && !final}
      />
      <Field
        label="Địa điểm"
        value={venue}
        onChangeText={setVenue}
        maxLength={255}
        editable={!busy && !final}
      />
      <Field
        label="Bắt đầu (VD: 2026-12-20T19:00:00+07:00)"
        value={starts}
        editable={!busy && !final}
        onChangeText={setStarts}
        autoCapitalize="none"
      />
      <Field
        label="Kết thúc (kèm múi giờ +07:00)"
        value={ends}
        editable={!busy && !final}
        onChangeText={setEnds}
        autoCapitalize="none"
      />
      <Field
        label="Mô tả"
        value={description}
        editable={!busy && !final}
        onChangeText={setDescription}
        multiline
        maxLength={5000}
      />
      <Field
        label="URL ảnh bìa"
        value={banner}
        editable={!busy && !final}
        onChangeText={setBanner}
        autoCapitalize="none"
        maxLength={500}
      />
      <Badge>{status}</Badge>
      {statuses.map((value) => (
        <Button
          key={value}
          secondary={status !== value}
          title={
            { DRAFT: "Bản nháp", PUBLISHED: "Công khai", CANCELLED: "Đã hủy" }[
              value
            ] || value
          }
          onPress={() => setStatus(value)}
          disabled={busy || final}
        />
      ))}
      {event && status !== event.status ? (
        <ConfirmButton
          key={status}
          title="Lưu sự kiện"
          disabled={busy || final}
          description={
            status === "CANCELLED"
              ? `Hủy sự kiện ${event.name}? Sau khi hủy không thể xuất bản lại.`
              : `Xuất bản sự kiện ${event.name} để mọi người đặt vé?`
          }
          onConfirm={async () => {
            await save();
          }}
        />
      ) : (
        <Button
          title="Lưu sự kiện"
          busy={busy}
          disabled={final}
          onPress={save}
        />
      )}
    </Card>
  );
}
