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
        style={{
          backgroundColor: "#eef2ff",
          borderColor: "#e0e7ff",
          paddingVertical: 28,
        }}
      >
        <Badge>KHÁM PHÁ · TRẢI NGHIỆM · KẾT NỐI</Badge>
        <Title>Những sự kiện tuyệt vời đang chờ bạn!</Title>
        <Body muted>
          Từ âm nhạc, thể thao đến hội thảo. Đừng bỏ lỡ những khoảnh khắc đáng
          nhớ.
        </Body>
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
          onPress={() => {
            setQuery(input.trim());
            setPage(0);
          }}
        />
      </Card>
      <Title>{query ? `Kết quả: ${query}` : "Khám phá sự kiện"}</Title>
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
