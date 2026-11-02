import { useRef, useState } from "react";
import { patch, post, request } from "@/lib/api";
import { managementEvents, normalizeSearch } from "@/lib/management";
import { dateTime, messageOf, type Device } from "@/lib/types";
import { useResource } from "@/hooks/use-resource";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Heading,
  Loading,
} from "../ui-kit";
import { FilterOptions } from "../filter-options";
import { ConfirmButton } from "../confirm-button";
import { DeviceKey } from "../device-key";
import { RecordActions } from "../record-actions";
import { Icon } from "../eventhub-icons";
import { BottomSheet } from "../bottom-sheet";
import { FilterPanel } from "../filter-panel";

const loadDevices = (signal: AbortSignal) =>
  request<Device[]>("/api/checkin/devices", { signal });
export function AdminDevices() {
  const resource = useResource(loadDevices);
  const events = useResource(managementEvents);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [scope, setScope] = useState("");
  const [status, setStatus] = useState("");
  const [limit, setLimit] = useState(20);
  const [detail, setDetail] = useState("");
  const [label, setLabel] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventQuery, setEventQuery] = useState("");
  const [eventLimit, setEventLimit] = useState(10);
  const [creatingScope, setCreatingScope] = useState("global");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const eventName = (id?: string) =>
    id
      ? events.data?.find((event) => event.eventId === id)?.name || id
      : "Toàn hệ thống";
  const devices = (resource.data || []).filter(
    (device) =>
      (!scope || (scope === "global" ? !device.eventId : !!device.eventId)) &&
      (!status || device.status === status) &&
      normalizeSearch(
        `${device.label} ${device.deviceId} ${eventName(device.eventId)}`,
      ).includes(normalizeSearch(query)),
  );
  const options = (events.data || []).filter((event) =>
    normalizeSearch(`${event.name} ${event.venue}`).includes(
      normalizeSearch(eventQuery),
    ),
  );
  async function act(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      resource.reload();
      lock.current = false;
      setBusy(false);
    }
  }
  function create() {
    if (
      !label.trim() ||
      key ||
      (creatingScope === "event" &&
        !events.data?.some((event) => event.eventId === eventId))
    ) {
      setError(
        "Nhập tên và chọn một sự kiện hợp lệ, hoặc chọn thiết bị toàn hệ thống.",
      );
      return;
    }
    void act(async () => {
      const result = await post<Device>("/api/checkin/devices", {
        label: label.trim(),
        eventId: creatingScope === "event" ? eventId : null,
      });
      if (!result?.apiKey)
        throw new Error(
          "Thiết bị đã được tạo nhưng thiếu khóa. Hãy tra cứu, thu hồi thiết bị đó và tạo lại.",
        );
      setKey(result.apiKey);
      setLabel("");
      setCreating(false);
    });
  }
  return (
    <>
      <Heading>Thiết bị toàn hệ thống</Heading>
      <Field
        label="Tìm thiết bị theo tên, mã hoặc sự kiện"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setLimit(20);
        }}
      />
      <FilterOptions
        label="Phạm vi thiết bị"
        value={scope}
        options={[
          ["", "Tất cả thiết bị"],
          ["global", "Toàn hệ thống"],
          ["event", "Theo sự kiện"],
        ]}
        onChange={(value) => {
          setScope(value);
          setLimit(20);
        }}
      />
      <FilterPanel>
        <FilterOptions
          label="Trạng thái thiết bị"
          value={status}
          options={[
            ["", "Tất cả trạng thái"],
            ["ACTIVE", "Đang hoạt động"],
            ["REVOKED", "Đã thu hồi"],
          ]}
          onChange={(value) => {
            setStatus(value);
            setLimit(20);
          }}
        />
      </FilterPanel>
      <Feedback message={resource.error || error} retry={resource.reload} />
      {!!notice && <Body>{notice}</Body>}
      {resource.loading ? (
        <Loading />
      ) : (
        !resource.error && (
          <>
            <Body>{devices.length} thiết bị phù hợp</Body>
            {!devices.length && (
              <Body muted>Không tìm thấy thiết bị phù hợp.</Body>
            )}
            {devices.slice(0, limit).map((device) => (
              <Card key={device.deviceId}>
                <Icon name="scan" size={24} />
                <Heading>{device.label}</Heading>
                <Badge>{device.status}</Badge>
                <Body>Sự kiện: {eventName(device.eventId)}</Body>
                <RecordActions label={device.label}>
                  <Button
                    secondary
                    title={
                      detail === device.deviceId
                        ? "Đóng chi tiết thiết bị"
                        : "Xem chi tiết thiết bị"
                    }
                    onPress={() =>
                      setDetail(
                        detail === device.deviceId ? "" : device.deviceId,
                      )
                    }
                  />
                  {detail === device.deviceId && (
                    <>
                      <Body>Mã thiết bị: {device.deviceId}</Body>
                      <Body muted>Tạo lúc: {dateTime(device.createdAt)}</Body>
                      <Body muted>
                        Hoạt động lần cuối: {dateTime(device.lastSeenAt)}
                      </Body>
                      <Body muted>
                        Thu hồi lúc: {dateTime(device.revokedAt)}
                      </Body>
                    </>
                  )}
                  {device.status === "ACTIVE" && (
                    <ConfirmButton
                      title="Thu hồi thiết bị"
                      disabled={busy}
                      description={`Thu hồi quyền soát vé của ${device.label}? Khóa không thể kích hoạt lại.`}
                      onConfirm={() =>
                        act(async () => {
                          await patch(
                            `/api/checkin/devices/${encodeURIComponent(device.deviceId)}/revoke`,
                          );
                          setNotice("Đã thu hồi thiết bị.");
                        })
                      }
                    />
                  )}
                </RecordActions>
              </Card>
            ))}
            {devices.length > limit && (
              <Button
                secondary
                title="Xem thêm thiết bị"
                onPress={() => setLimit(limit + 20)}
              />
            )}
          </>
        )
      )}
      {key && <DeviceKey value={key} onClose={() => setKey("")} />}
      <Button
        title="+ Tạo thiết bị mới"
        onPress={() => setCreating(true)}
        disabled={busy || !!key}
      />
      {creating && (
        <BottomSheet
          title="Đăng ký thiết bị"
          close={() => setCreating(false)}
          busy={busy}
        >
          <Card
            style={{
              borderWidth: 0,
              padding: 0,
              backgroundColor: "transparent",
            }}
          >
            <Feedback message={error} />
            <Field
              label="Tên thiết bị"
              value={label}
              maxLength={255}
              editable={!busy && !key}
              onChangeText={setLabel}
            />
            <FilterOptions
              label="Loại thiết bị mới"
              value={creatingScope}
              disabled={busy || !!key}
              options={[
                ["global", "Tạo thiết bị toàn hệ thống"],
                ["event", "Gắn với sự kiện"],
              ]}
              onChange={setCreatingScope}
            />
            {creatingScope === "event" && (
              <>
                <Feedback message={events.error} retry={events.reload} />
                {events.loading ? (
                  <Loading />
                ) : (
                  <>
                    <Field
                      label="Tìm sự kiện để gắn thiết bị"
                      value={eventQuery}
                      editable={!busy && !key}
                      onChangeText={(value) => {
                        setEventQuery(value);
                        setEventLimit(10);
                      }}
                    />
                    <Body>
                      Đã chọn:{" "}
                      {eventId ? eventName(eventId) : "Chưa chọn sự kiện"}
                    </Body>
                    {options.slice(0, eventLimit).map((event) => (
                      <Button
                        key={event.eventId}
                        title={`Chọn sự kiện: ${event.name}`}
                        secondary={eventId !== event.eventId}
                        disabled={busy || !!key}
                        onPress={() => setEventId(event.eventId)}
                      />
                    ))}
                    {!options.length && (
                      <Body muted>Không có sự kiện phù hợp.</Body>
                    )}
                    {options.length > eventLimit && (
                      <Button
                        secondary
                        title="Xem thêm lựa chọn sự kiện"
                        onPress={() => setEventLimit(eventLimit + 10)}
                      />
                    )}
                  </>
                )}
              </>
            )}
            <Button
              title="Tạo thiết bị"
              busy={busy}
              disabled={
                !label.trim() ||
                !!key ||
                (creatingScope === "event" &&
                  (!eventId || events.loading || !!events.error))
              }
              onPress={create}
            />
          </Card>
        </BottomSheet>
      )}
      <Button
        secondary
        title="Tải lại thiết bị"
        disabled={busy}
        onPress={() => {
          resource.reload();
          events.reload();
        }}
      />
    </>
  );
}
