import { useState, type PropsWithChildren } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { dateTime, type Event } from "@/lib/types";
import {
  BrandMark,
  ButtonGradient,
  Icon,
  type IconName,
} from "./eventhub-icons";
export { Icon } from "./eventhub-icons";
export const colors = {
  primary: "#653cff",
  ink: "#11113d",
  muted: "#595b7b",
  background: "#fcfbff",
  line: "#e0dcf4",
  soft: "#f0ebff",
  success: "#138b35",
  danger: "#d52c46",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 18,
    gap: 14,
    paddingBottom: 36,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 11,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.7,
    lineHeight: 33,
  },
  heading: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 23,
  },
  text: { fontSize: 14, color: colors.ink, lineHeight: 21, flexShrink: 1 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 20, flexShrink: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 2,
    color: colors.ink,
    fontSize: 14,
  },
  badge: {
    color: colors.primary,
    backgroundColor: colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    fontSize: 11,
    fontWeight: "700",
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  center: { alignItems: "center", gap: 8 },
  field: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
});
export function Brand() {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      <BrandMark />
      <Text
        style={{
          fontWeight: "800",
          color: colors.ink,
          fontSize: 24,
          letterSpacing: -0.7,
        }}
      >
        EventHub
      </Text>
    </View>
  );
}
export function Screen({
  children,
  auth = false,
}: PropsWithChildren<{ auth?: boolean }>) {
  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 44,
              marginBottom: auth ? 4 : 0,
            }}
          >
            {!auth && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quay lại"
                hitSlop={10}
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/(tabs)")
                }
                style={{ position: "absolute", left: 0, padding: 8 }}
              >
                <Icon name="back" color={colors.ink} />
              </Pressable>
            )}
            <Brand />
            {!auth && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tài khoản của tôi"
                onPress={() => router.push("/(tabs)/profile")}
                style={{
                  position: "absolute",
                  right: 0,
                  padding: 8,
                  borderRadius: 20,
                  backgroundColor: colors.soft,
                }}
              >
                <Icon name="user" />
              </Pressable>
            )}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Title({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}
export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}
export function Body({
  children,
  muted = false,
}: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={muted ? styles.muted : styles.text}>{children}</Text>;
}
export function Badge({ children }: PropsWithChildren) {
  const value = typeof children === "string" ? children : "";
  const good = /^(ACTIVE|ISSUED|PUBLISHED|COMPLETED|REFUNDED|ACCEPTED)$/.test(
    value,
  );
  const bad = /^(LOCKED|CANCELLED|REVOKED|VOIDED|FAILED|EXPIRED)$/.test(value);
  return (
    <Text
      style={[
        styles.badge,
        good && { color: "#138b35", backgroundColor: "#e2f8e8" },
        bad && { color: "#c32943", backgroundColor: "#fff0f2" },
      ]}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  disabled,
  busy,
  secondary,
  danger,
  compact = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  danger?: boolean;
  compact?: boolean;
  icon?: IconName;
}) {
  const color = danger ? colors.danger : secondary ? colors.primary : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 36 : 46,
        borderRadius: compact ? 10 : 12,
        paddingHorizontal: compact ? 12 : 16,
        paddingVertical: compact ? 8 : 12,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: secondary || danger ? 1 : 0,
        borderColor: danger ? "#ffb7c2" : colors.line,
        backgroundColor: danger
          ? "#fff4f6"
          : secondary
            ? "#faf8ff"
            : colors.primary,
        ...(Platform.OS === "web" && !secondary && !danger
          ? { backgroundImage: "linear-gradient(110deg, #974cff, #4c30ff)" }
          : {}),
        opacity: disabled || busy ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      {Platform.OS !== "web" && !secondary && !danger && <ButtonGradient />}
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icon && <Icon name={icon} size={18} color={color} />}
          <Text
            style={{
              color,
              fontWeight: "700",
              fontSize: compact ? 12 : 14,
              textAlign: "center",
              flexShrink: 1,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  icon,
  style,
  secureTextEntry,
  ...props
}: TextInputProps & { label: string; icon?: IconName }) {
  const [visible, setVisible] = useState(false);
  const inferred =
    icon ||
    (/tìm/i.test(label)
      ? "search"
      : /email/i.test(label)
        ? "mail"
        : /mật khẩu/i.test(label)
          ? "lock"
          : /họ.*tên/i.test(label)
            ? "user"
            : undefined);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13 }}>
        {label}
      </Text>
      <View
        style={[styles.field, props.multiline && { alignItems: "flex-start" }]}
      >
        {inferred && <Icon name={inferred} color="#686389" size={18} />}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#9993b3"
          {...props}
          secureTextEntry={secureTextEntry && !visible}
          style={[styles.input, style]}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible
                ? `Ẩn ${label.toLowerCase()}`
                : `Hiện ${label.toLowerCase()}`
            }
            hitSlop={8}
            onPress={() => setVisible(!visible)}
          >
            <Icon name="eye" size={19} color="#77708f" />
          </Pressable>
        )}
      </View>
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
        backgroundColor: "#fff0f2",
        borderRadius: 12,
        padding: 13,
        gap: 10,
        borderWidth: 1,
        borderColor: "#ffd6de",
      }}
    >
      <Text style={{ color: "#b92242", lineHeight: 21, fontSize: 13 }}>
        {message}
      </Text>
      {retry && <Button secondary title="Thử lại" onPress={retry} />}
    </View>
  );
}
export function Notice({
  children,
  success = false,
}: PropsWithChildren<{ success?: boolean }>) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 10,
        borderRadius: 12,
        backgroundColor: success ? "#e1f6e8" : colors.soft,
        padding: 14,
        alignItems: "center",
      }}
    >
      <Icon
        name={success ? "check" : "info"}
        color={success ? colors.success : colors.primary}
      />
      <Text style={[styles.text, { flex: 1, fontSize: 13 }]}>{children}</Text>
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 32, alignItems: "center", gap: 10 }}>
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
        <Title>Chào bạn đến EventHub</Title>
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
export function Banner({
  uri,
  compact = false,
}: {
  uri?: string;
  compact?: boolean;
}) {
  const [failedUri, setFailedUri] = useState<string>();
  return uri && uri !== failedUri ? (
    <Image
      source={{ uri }}
      onError={() => setFailedUri(uri)}
      accessibilityLabel="Ảnh sự kiện"
      style={{
        height: compact ? 90 : 180,
        width: "100%",
        borderRadius: 13,
        backgroundColor: colors.soft,
      }}
    />
  ) : (
    <View
      style={{
        height: compact ? 90 : 150,
        borderRadius: 13,
        backgroundColor: colors.soft,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Icon name="calendar" size={32} />
      <Body muted>EventHub · Sự kiện</Body>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${manage ? "Quản lý sự kiện" : "Xem chi tiết"}: ${event.name}`}
      onPress={() =>
        router.push(
          manage
            ? { pathname: "/manage/[id]", params: { id: event.eventId } }
            : { pathname: "/events/[id]", params: { id: event.eventId } },
        )
      }
    >
      <Card style={{ flexDirection: "row", gap: 12, padding: 9 }}>
        <View style={{ width: 100 }}>
          <Banner uri={event.bannerUrl} compact />
        </View>
        <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
          <Text style={[styles.heading, { fontSize: 14, lineHeight: 19 }]}>
            {event.name}
          </Text>
          <View style={{ flexDirection: "row", gap: 5 }}>
            <Icon name="pin" size={14} color={colors.muted} />
            <Text
              numberOfLines={2}
              style={[styles.muted, { fontSize: 11, lineHeight: 16, flex: 1 }]}
            >
              {event.venue || "Chưa cập nhật địa điểm"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 5 }}>
            <Icon name="calendar" size={14} color={colors.muted} />
            <Text style={[styles.muted, { fontSize: 11, flex: 1 }]}>
              {dateTime(event.startsAt)}
            </Text>
          </View>
          {manage && <Badge>{event.status}</Badge>}
          <Text
            style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}
          >
            {manage ? "Quản lý sự kiện" : "Xem chi tiết"} →
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
export function MetricStrip({
  items,
}: {
  items: { label: string; value: string | number; icon?: IconName }[];
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {items.map((item) => (
        <Card
          key={item.label}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 10,
            gap: 6,
            backgroundColor: "#f9f7ff",
          }}
        >
          {item.icon && <Icon name={item.icon} size={20} />}
          <Text style={[styles.muted, { fontSize: 10, lineHeight: 15 }]}>
            {item.label}
          </Text>
          <Text style={{ color: colors.ink, fontWeight: "800", fontSize: 16 }}>
            {item.value}
          </Text>
        </Card>
      ))}
    </View>
  );
}
export function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        justifyContent: "space-between",
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: "#f0edf8",
      }}
    >
      <Text style={styles.muted}>{label}</Text>
      <Text
        style={[
          styles.text,
          { fontWeight: "600", textAlign: "right", flex: 1 },
        ]}
      >
        {value ?? "—"}
      </Text>
    </View>
  );
}
