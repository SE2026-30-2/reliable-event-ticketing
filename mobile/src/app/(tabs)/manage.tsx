import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  Body,
  Button,
  EventCard,
  Feedback,
  Gate,
  Loading,
  Screen,
  Title,
} from "@/components/ui-kit";
import { EventForm } from "@/components/event-form";
import { request } from "@/lib/api";
import { listOf, type Event, type Page } from "@/lib/types";
import { useResource } from "@/hooks/use-resource";
function ManageContent() {
  const load = useCallback(
    (signal: AbortSignal) =>
      request<Event[] | Page<Event>>("/api/manage/events", { signal }).then(
        listOf,
      ),
    [],
  );
  const resource = useResource(load);
  const [creating, setCreating] = useState(false);
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
      {resource.loading ? (
        <Loading />
      ) : (
        !resource.error && (
          <>
            {!resource.data?.length && (
              <Body muted>Bạn chưa có sự kiện nào.</Body>
            )}
            {resource.data?.map((event) => (
              <EventCard key={event.eventId} event={event} manage />
            ))}
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
