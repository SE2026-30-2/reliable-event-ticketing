import { useState } from "react";
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
}: {
  event?: Event;
  onSaved: () => void;
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
  async function save() {
    setError("");
    const start = Date.parse(starts),
      end = Date.parse(ends);
    if (
      !name.trim() ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
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
    setBusy(true);
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
      setBusy(false);
    }
  }
  return (
    <Card>
      <Heading>{event ? "Chỉnh sửa sự kiện" : "Tạo sự kiện mới"}</Heading>
      <Feedback message={error} />
      <Field
        label="Tên sự kiện"
        value={name}
        onChangeText={setName}
        maxLength={255}
      />
      <Field
        label="Địa điểm"
        value={venue}
        onChangeText={setVenue}
        maxLength={255}
      />
      <Field
        label="Bắt đầu (VD: 2026-12-20T19:00:00+07:00)"
        value={starts}
        onChangeText={setStarts}
        autoCapitalize="none"
      />
      <Field
        label="Kết thúc (kèm múi giờ +07:00)"
        value={ends}
        onChangeText={setEnds}
        autoCapitalize="none"
      />
      <Field
        label="Mô tả"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={5000}
      />
      <Field
        label="URL ảnh bìa"
        value={banner}
        onChangeText={setBanner}
        autoCapitalize="none"
        maxLength={500}
      />
      <Badge>{status}</Badge>
      {["DRAFT", "PUBLISHED", ...(event ? ["CANCELLED"] : [])].map((value) => (
        <Button
          key={value}
          secondary={status !== value}
          title={
            { DRAFT: "Bản nháp", PUBLISHED: "Công khai", CANCELLED: "Đã hủy" }[
              value
            ] || value
          }
          onPress={() => setStatus(value)}
          disabled={busy}
        />
      ))}
      <Button title="Lưu sự kiện" busy={busy} onPress={save} />
    </Card>
  );
}
