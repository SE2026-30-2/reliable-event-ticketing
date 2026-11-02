import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { AuthArtwork } from "./auth-artwork";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Title,
  Card,
  Field,
  Button,
  Feedback,
  Notice,
  styles,
  colors,
} from "@/components/ui-kit";
import { useAuth } from "@/contexts/auth";
import { identity } from "@/lib/api";
import { isEmail, messageOf } from "@/lib/types";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit() {
    setError("");
    if (
      !isEmail(email) ||
      !password ||
      (register &&
        (!name.trim() || password.length < 8 || password !== confirm))
    ) {
      setError(
        register
          ? "Nhập họ tên, email hợp lệ, mật khẩu ít nhất 8 ký tự và xác nhận trùng khớp."
          : "Vui lòng nhập email hợp lệ và mật khẩu.",
      );
      return;
    }
    setBusy(true);
    try {
      if (register) {
        await identity("/register", {
          method: "POST",
          public: true,
          body: { fullName: name.trim(), email: email.trim(), password },
        });
        setSuccess(true);
      } else {
        await auth.login(email.trim(), password);
        router.replace(
          eventId
            ? { pathname: "/events/[id]", params: { id: eventId } }
            : "/(tabs)",
        );
      }
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen auth>
      <View style={styles.center}>
        <Title>{register ? "Tạo tài khoản ngay" : "Chào mừng trở lại"}</Title>
        <Text style={[styles.muted, { textAlign: "center" }]}>
          {register
            ? "Chỉ vài bước đơn giản để trở thành thành viên của EventHub và khám phá thế giới sự kiện!"
            : "Đăng nhập để tiếp tục khám phá và tham gia những sự kiện hấp dẫn trên EventHub!"}
        </Text>
      </View>
      <AuthArtwork />
      <Card
        style={{
          borderWidth: 0,
          backgroundColor: "transparent",
          padding: 0,
          gap: 14,
        }}
      >
        <Feedback message={error || (!register ? auth.sessionError : "")} />
        {success ? (
          <>
            <Title>Đăng ký thành công</Title>
            <Notice success>
              Kiểm tra hộp thư để xác minh email trước khi đặt vé.
            </Notice>
            <Button
              title="Đăng nhập"
              onPress={() =>
                router.replace({ pathname: "/login", params: { eventId } })
              }
            />
          </>
        ) : (
          <>
            {register && (
              <Field
                label="Họ và tên"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
            )}
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={register ? "new-password" : "current-password"}
            />
            {register && (
              <Field
                label="Xác nhận mật khẩu"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoCapitalize="none"
              />
            )}
            {!register && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/forgot-password")}
                style={{ alignSelf: "flex-end", paddingVertical: 4 }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: "600",
                    fontSize: 13,
                  }}
                >
                  Quên mật khẩu
                </Text>
              </Pressable>
            )}
            {register && (
              <Notice>
                Thông tin tài khoản dùng để nhận vé và quản lý các sự kiện bạn
                tham gia.
              </Notice>
            )}
            <Button
              title={register ? "Đăng ký tài khoản" : "Đăng nhập"}
              busy={busy}
              onPress={submit}
            />
            <Button
              secondary
              title="Xác minh email"
              onPress={() => router.push("/verify-email")}
            />
            <Button
              secondary
              title={
                register
                  ? "Đã có tài khoản? Đăng nhập"
                  : "Chưa có tài khoản? Đăng ký"
              }
              onPress={() =>
                router.replace({
                  pathname: register ? "/login" : "/register",
                  params: { eventId },
                })
              }
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
