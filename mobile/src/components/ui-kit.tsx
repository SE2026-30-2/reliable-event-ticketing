import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/contexts/auth";
import { dateTime, type Event } from "@/lib/types";
export const colors = {
  primary: "#4353ff",
  ink: "#0f172a",
  muted: "#64748b",
  background: "#f8fafc",
  line: "#e2e8f0",
  soft: "#eef2ff",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.7,
  },
  heading: { fontSize: 19, fontWeight: "700", color: colors.ink },
  text: { fontSize: 15, color: colors.ink, lineHeight: 23 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 22 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  input: {
    minHeight: 50,
    backgroundColor: "#fff",
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
  badge: {
    color: colors.primary,
    backgroundColor: colors.soft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: "700",
    alignSelf: "flex-start",
  },
});
export function Screen({ children }: PropsWithChildren) {
  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Title({ children }: PropsWithChildren) {
  return <Text style={styles.title}>{children}</Text>;
}
export function Heading({ children }: PropsWithChildren) {
  return <Text style={styles.heading}>{children}</Text>;
}
export function Body({
  children,
  muted = false,
}: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={muted ? styles.muted : styles.text}>{children}</Text>;
}
export function Badge({ children }: PropsWithChildren) {
  return <Text style={styles.badge}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  disabled,
  busy,
  secondary,
  danger,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 13,
        paddingHorizontal: 18,
        paddingVertical: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger
          ? "#fff1f2"
          : secondary
            ? colors.soft
            : colors.primary,
        opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.primary : "#fff"} />
      ) : (
        <Text
          style={{
            color: danger ? "#be123c" : secondary ? colors.primary : "#fff",
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        {...props}
      />
    </View>
  );
}
export function Feedback({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: "#fff1f2",
        borderRadius: 14,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ color: "#be123c", lineHeight: 22 }}>{message}</Text>
      {retry && <Button secondary title="Thử lại" onPress={retry} />}
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 40 }}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Body muted>Đang tải dữ liệu…</Body>
    </View>
  );
}
export function Gate({
  children,
  roles,
}: PropsWithChildren<{ roles?: string[] }>) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user)
    return (
      <Screen>
        <Title>Chào bạn đến EventPass</Title>
        <Body muted>Đăng nhập để quản lý vé và tài khoản của bạn.</Body>
        <Button title="Đăng nhập" onPress={() => router.push("/login")} />
        <Button
          secondary
          title="Tạo tài khoản"
          onPress={() => router.push("/register")}
        />
      </Screen>
    );
  if (roles && !user.roles.some((role) => roles.includes(role)))
    return (
      <Screen>
        <Title>Không có quyền truy cập</Title>
        <Body muted>
          Tài khoản của bạn không có quyền sử dụng màn hình này.
        </Body>
      </Screen>
    );
  return children;
}
export function Banner({ uri }: { uri?: string }) {
  return uri ? (
    <Image
      source={{ uri }}
      accessibilityLabel="Ảnh sự kiện"
      style={{
        height: 190,
        width: "100%",
        borderRadius: 16,
        backgroundColor: colors.soft,
      }}
    />
  ) : (
    <View
      style={{
        height: 140,
        borderRadius: 16,
        backgroundColor: colors.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 44, color: colors.primary }}>✦</Text>
      <Badge>EventPass</Badge>
    </View>
  );
}
export function EventCard({
  event,
  manage = false,
}: {
  event: Event;
  manage?: boolean;
}) {
  return (
    <Card>
      <Banner uri={event.bannerUrl} />
      <Badge>{manage ? event.status : "SỰ KIỆN"}</Badge>
      <Heading>{event.name}</Heading>
      <Body muted>{event.venue || "Chưa cập nhật địa điểm"}</Body>
      <Body muted>{dateTime(event.startsAt)}</Body>
      <Button
        title={manage ? "Quản lý sự kiện" : "Xem chi tiết →"}
        secondary
        onPress={() =>
          router.push(
            manage
              ? { pathname: "/manage/[id]", params: { id: event.eventId } }
              : { pathname: "/events/[id]", params: { id: event.eventId } },
          )
        }
      />
    </Card>
  );
}
