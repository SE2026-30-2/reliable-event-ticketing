import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  Screen,
  Title,
  Body,
  Badge,
  Button,
  Card,
  Field,
  EventCard,
  Feedback,
  Loading,
  styles,
} from "@/components/ui-kit";
import { request } from "@/lib/api";
import { listOf, type Event, type Page } from "@/lib/types";
import { useResource } from "@/hooks/use-resource";
export default function Discover() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const data = await request<Event[] | Page<Event>>(
        `/api/event?q=${encodeURIComponent(query)}&page=${page}&size=12`,
        { signal, public: true },
      );
      if (!Array.isArray(data)) return data;
      return {
        content: data.slice(page * 12, (page + 1) * 12),
        totalPages: Math.ceil(data.length / 12),
        totalElements: data.length,
      };
    },
    [query, page],
  );
  const resource = useResource(load);
  return (
    <Screen>
      <Card
        style={{ borderWidth: 0, padding: 0, backgroundColor: "transparent" }}
      >
        <Title>Khám phá sự kiện hấp dẫn</Title>
        <Body muted>Concert, thể thao, hội thảo, điện ảnh và hơn thế nữa</Body>
        <Field
          label="Tìm kiếm sự kiện"
          placeholder="Tên sự kiện hoặc địa điểm"
          value={input}
          onChangeText={setInput}
          returnKeyType="search"
          onSubmitEditing={() => {
            setQuery(input.trim());
            setPage(0);
          }}
        />
        <Button
          title="Tìm kiếm →"
          compact
          onPress={() => {
            setQuery(input.trim());
            setPage(0);
          }}
        />
      </Card>
      <Badge>{query ? `Kết quả: ${query}` : "Tất cả sự kiện"}</Badge>
      <Feedback message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        !resource.error && (
          <>
            {resource.data &&
              listOf(resource.data).map((event) => (
                <EventCard key={event.eventId} event={event} />
              ))}
            {!resource.data?.content?.length && (
              <Card>
                <Body muted>Không tìm thấy sự kiện phù hợp.</Body>
              </Card>
            )}
            <View style={styles.row}>
              <Button
                secondary
                title="← Trước"
                disabled={page === 0}
                onPress={() => setPage(page - 1)}
              />
              <Body>
                Trang {page + 1} / {Math.max(1, resource.data?.totalPages || 1)}
              </Body>
              <Button
                secondary
                title="Sau →"
                disabled={page + 1 >= (resource.data?.totalPages || 0)}
                onPress={() => setPage(page + 1)}
              />
            </View>
          </>
        )
      )}
    </Screen>
  );
}
