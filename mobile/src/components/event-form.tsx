import { useRef, useState } from "react";
import { ConfirmButton } from "./confirm-button";
import { BannerPicker, bannerBody, type BannerAsset } from "./banner-picker";
import { FilterOptions } from "./filter-options";
import { categories, salesSchedule } from "@/lib/events";
import { eventStatuses } from "@/lib/management";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Heading,
} from "@/components/ui-kit";
import { endpoints, patch, post } from "@/lib/api";
import { messageOf, type Event } from "@/lib/types";

export function EventForm({
  event,
  onSaved,
  onBusyChange,
  onManageTicketTypes,
  embedded = false,
}: {
  event?: Event;
  onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
  onManageTicketTypes?: () => void;
  embedded?: boolean;
}) {
  const [name, setName] = useState(event?.name || "");
  const [venue, setVenue] = useState(event?.venue || "");
  const [starts, setStarts] = useState(event?.startsAt || "");
  const [ends, setEnds] = useState(event?.endsAt || "");
  const [description, setDescription] = useState(event?.description || "");
  const [banner, setBanner] = useState(event?.bannerUrl || "");
  const [bannerAsset, setBannerAsset] = useState<BannerAsset | null>(null);
  const [reading, setReading] = useState(false);
  const [category, setCategory] = useState(event?.category || "");
  const [salesStart, setSalesStart] = useState(event?.salesStartAt || "");
  const [salesEnd, setSalesEnd] = useState(event?.salesEndAt || "");
  const [status, setStatus] = useState(event?.status || "DRAFT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const final = !!event && ["CANCELLED", "COMPLETED"].includes(event.status);
  const statuses = eventStatuses(event);
  async function save() {
    if (lock.current || final || reading) return;
    setError("");
    if (!statuses.includes(status)) {
      setError("Không thể chuyển trạng thái sự kiện như đã chọn.");
      return;
    }
    const start = Date.parse(starts),
      end = Date.parse(ends);
    if (!event && !category) {
      setError("Vui lòng chọn danh mục sự kiện.");
      return;
    }
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
    if (!bannerAsset && banner.trim() && !/^https?:\/\//i.test(banner.trim())) {
      setError("Ảnh bìa phải là địa chỉ http hoặc https.");
      return;
    }
    let schedule;
    try {
      schedule = salesSchedule(salesStart, salesEnd, ends);
    } catch (error) {
      setError(messageOf(error));
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
      category: category || undefined,
      ...schedule,
      ...(event && !schedule.salesStartAt ? { clearSalesSchedule: true } : {}),
      status,
    };
    try {
      if (bannerAsset) {
        const uploaded = await post<{ url: string }>(
          "/api/manage/event-images",
          bannerBody(bannerAsset),
        );
        if (!/^\/api\/event-images\/[0-9a-f-]{36}$/i.test(uploaded?.url))
          throw new Error("Máy chủ chưa trả đường dẫn ảnh hợp lệ.");
        body.bannerUrl = `${endpoints.ticketing}${uploaded.url}`;
        setBanner(body.bannerUrl);
        setBannerAsset(null);
      }
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
      {event && onManageTicketTypes && (
        <Card style={{ backgroundColor: "#f5f3ff", borderColor: "#e0dcf4" }}>
          <Heading>Vé & giá bán</Heading>
          <Body muted>Thêm loại vé, thiết lập giá và số lượng.</Body>
          <Button
            secondary
            icon="ticket"
            title="Quản lý loại vé"
            disabled={busy || reading}
            onPress={onManageTicketTypes}
          />
          <Body muted>Lưu thay đổi sự kiện trước khi chuyển mục.</Body>
        </Card>
      )}
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
      <FilterOptions
        label="Danh mục sự kiện"
        value={category}
        disabled={busy || final}
        options={categories}
        onChange={(value) => {
          if (!busy && !final) setCategory(value);
        }}
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
        label="Ngày giờ mở bán (tùy chọn, kèm múi giờ)"
        value={salesStart}
        onChangeText={setSalesStart}
        editable={!busy && !final}
        autoCapitalize="none"
      />
      <Field
        label="Ngày giờ đóng bán (tùy chọn, kèm múi giờ)"
        value={salesEnd}
        onChangeText={setSalesEnd}
        editable={!busy && !final}
        autoCapitalize="none"
      />
      <Heading>
        Để trống cả hai để bán từ khi xuất bản đến khi sự kiện kết thúc.
      </Heading>
      <Field
        label="URL ảnh bìa"
        value={banner}
        editable={!busy && !final && !reading}
        onChangeText={(value) => {
          setBanner(value);
          setBannerAsset(null);
        }}
        autoCapitalize="none"
        maxLength={500}
      />
      <BannerPicker
        value={bannerAsset?.uri || banner}
        disabled={busy || final || reading}
        onSelect={setBannerAsset}
        onBusyChange={(value) => {
          setReading(value);
          onBusyChange?.(value);
        }}
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
          disabled={busy || final || reading}
        />
      ))}
      {event && status !== event.status ? (
        <ConfirmButton
          key={status}
          title="Lưu sự kiện"
          disabled={busy || final || reading}
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
          disabled={final || reading}
          onPress={save}
        />
      )}
    </Card>
  );
}
