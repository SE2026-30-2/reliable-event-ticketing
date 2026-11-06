import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { View } from "react-native";
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
import { BottomSheet } from "@/components/bottom-sheet";
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
  const [saving, setSaving] = useState(false);
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
        : sort === "newest"
          ? Date.parse(b.createdAt || "1970-01-01") -
            Date.parse(a.createdAt || "1970-01-01")
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
      <Title>Danh sách sự kiện</Title>
      <Body muted>Tạo sự kiện, quản lý vé và theo dõi hoạt động.</Body>
      <Button
        title={creating ? "Đóng biểu mẫu" : "+ Tạo sự kiện"}
        onPress={() => setCreating(!creating)}
      />
      {creating && (
        <BottomSheet
          title="Tạo sự kiện mới"
          close={() => setCreating(false)}
          busy={saving}
        >
          <EventForm
            embedded
            onBusyChange={setSaving}
            onSaved={() => {
              setCreating(false);
              resource.reload();
            }}
          />
        </BottomSheet>
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
          ["newest", "Mới nhất"],
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
              <View key={event.eventId} style={{ gap: 8, marginBottom: 6 }}>
                <EventCard event={event} manage />
                <Button
                  secondary
                  icon="ticket"
                  title="Quản lý loại vé"
                  onPress={() =>
                    router.push({
                      pathname: "/manage/[id]",
                      params: { id: event.eventId, tab: "types" },
                    })
                  }
                />
              </View>
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
