import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Body,
  Button,
  EventCard,
  Feedback,
  Field,
  Gate,
  Loading,
  Screen,
  Title,
} from "@/components/ui-kit";
import { EventForm } from "@/components/event-form";
import { FilterOptions } from "@/components/filter-options";
import { managementEvents, normalizeSearch } from "@/lib/management";
import { useResource } from "@/hooks/use-resource";
function ManageContent() {
  const load = useCallback(
    (signal: AbortSignal) => managementEvents(signal),
    [],
  );
  const resource = useResource(load);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("date");
  const [limit, setLimit] = useState(20);
  const events = (resource.data || [])
    .filter(
      (event) =>
        (!status || event.status === status) &&
        normalizeSearch(`${event.name} ${event.venue}`).includes(
          normalizeSearch(query),
        ),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "vi")
        : Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
  const { reload } = resource;
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return (
    <Screen>
      <Title>Sự kiện của tôi</Title>
      <Body muted>Tạo sự kiện, quản lý vé và theo dõi hoạt động.</Body>
      <Button
        title={creating ? "Đóng biểu mẫu" : "+ Tạo sự kiện"}
        onPress={() => setCreating(!creating)}
      />
      {creating && (
        <EventForm
          onSaved={() => {
            setCreating(false);
            resource.reload();
          }}
        />
      )}
      <Feedback message={resource.error} retry={resource.reload} />
      <Field
        label="Tìm sự kiện theo tên hoặc địa điểm"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setLimit(20);
        }}
      />
      <FilterOptions
        label="Trạng thái sự kiện"
        value={status}
        options={[
          ["", "Tất cả trạng thái"],
          ["DRAFT", "Bản nháp"],
          ["PUBLISHED", "Đã xuất bản"],
          ["CANCELLED", "Đã hủy"],
          ["COMPLETED", "Đã kết thúc"],
        ]}
        onChange={(value) => {
          setStatus(value);
          setLimit(20);
        }}
      />
      <FilterOptions
        label="Sắp xếp sự kiện"
        value={sort}
        options={[
          ["date", "Ngày gần nhất"],
          ["name", "Tên A–Z"],
        ]}
        onChange={setSort}
      />
      {resource.loading ? (
        <Loading />
      ) : (
        !resource.error && (
          <>
            {!events.length && (
              <Body muted>
                {resource.data?.length
                  ? "Không có sự kiện phù hợp bộ lọc."
                  : "Bạn chưa có sự kiện nào."}
              </Body>
            )}
            <Body muted>{events.length} sự kiện phù hợp</Body>
            {events.slice(0, limit).map((event) => (
              <EventCard key={event.eventId} event={event} manage />
            ))}
            {events.length > limit && (
              <Button
                secondary
                title="Xem thêm sự kiện"
                onPress={() => setLimit(limit + 20)}
              />
            )}
          </>
        )
      )}
    </Screen>
  );
}
export default function Manage() {
  return (
    <Gate roles={["ADMIN", "ORGANIZER"]}>
      <ManageContent />
    </Gate>
  );
}
