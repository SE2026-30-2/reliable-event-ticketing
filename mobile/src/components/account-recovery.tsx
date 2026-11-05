import { useRef, useState } from "react";
import { View, Text } from "react-native";
import { AuthArtwork } from "./auth-artwork";
import { router, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Screen,
  Title,
  Notice,
  styles,
} from "@/components/ui-kit";
import { useAuth } from "@/contexts/auth";
import { identity } from "@/lib/api";
import { isEmail, messageOf } from "@/lib/types";

export function AccountRecovery({
  mode,
}: {
  mode: "forgot" | "reset" | "verify";
}) {
  const { token: queryToken } = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(queryToken || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const auth = useAuth();
  const title =
    mode === "forgot"
      ? "Quên mật khẩu"
      : mode === "reset"
        ? "Đặt lại mật khẩu"
        : "Xác minh email";
  async function submit() {
    if (lock.current) return;
    setError("");
    if (mode === "forgot" ? !isEmail(email) : !token.trim()) {
      setError(
        mode === "forgot"
          ? "Nhập email hợp lệ."
          : "Nhập mã token trong liên kết email.",
      );
      return;
    }
    if (mode === "reset" && (password.length < 8 || password !== confirm)) {
      setError("Mật khẩu cần ít nhất 8 ký tự và xác nhận trùng khớp.");
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await identity(
        mode === "forgot"
          ? "/password/forgot"
          : mode === "reset"
            ? "/password/reset"
            : "/email/verify",
        {
          method: "POST",
          public: true,
          body:
            mode === "forgot"
              ? { email: email.trim() }
              : mode === "reset"
                ? { token: token.trim(), newPassword: password }
                : { token: token.trim() },
        },
      );
      setPassword("");
      setConfirm("");
      setToken("");
      setNotice(
        mode === "forgot"
          ? "Nếu email tồn tại, hệ thống sẽ gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư."
          : mode === "reset"
            ? "Đã đặt lại mật khẩu. Đăng nhập bằng mật khẩu mới."
            : "Xác minh email thành công.",
      );
      if (mode === "verify" && auth.user) await auth.reload().catch(() => {});
      if (mode === "reset" && auth.user) await auth.logout().catch(() => {});
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen auth>
      {mode === "verify" && <AuthArtwork kind="mail" />}
      <View style={styles.center}>
        <Title>
          {mode === "verify" && notice ? "Email đã được xác minh!" : title}
        </Title>
        <Text style={[styles.muted, { textAlign: "center" }]}>
          {mode === "forgot"
            ? "Nhập email đã đăng ký với EventHub, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn."
            : mode === "reset"
              ? "Tạo mật khẩu mới để tiếp tục sử dụng tài khoản EventHub của bạn."
              : "Xác minh email để khám phá và tham gia các sự kiện trên EventHub."}
        </Text>
      </View>
      {mode === "reset" && <AuthArtwork kind="lock" />}
      <Card
        style={{
          borderWidth: 0,
          backgroundColor: "transparent",
          padding: 0,
          gap: 16,
        }}
      >
        <Feedback message={error} />
        {notice ? (
          <Notice success>{notice}</Notice>
        ) : (
          <>
            <Body muted>
              {mode === "forgot"
                ? "Nhập email tài khoản để nhận liên kết khôi phục."
                : "Mở liên kết email trong ứng dụng hoặc dán giá trị token từ liên kết vào bên dưới."}
            </Body>
            {mode === "forgot" ? (
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!busy}
              />
            ) : (
              <Field
                label="Token từ email"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                secureTextEntry
                editable={!busy}
              />
            )}
            {mode === "reset" && (
              <>
                <Field
                  label="Mật khẩu mới"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!busy}
                />
                <Field
                  label="Xác nhận mật khẩu mới"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!busy}
                />
              </>
            )}
            <Button
              title={
                mode === "forgot"
                  ? "Gửi hướng dẫn"
                  : mode === "reset"
                    ? "Lưu mật khẩu mới"
                    : title
              }
              icon={mode === "forgot" ? "mail" : "lock"}
              busy={busy}
              onPress={submit}
            />
          </>
        )}
        {mode === "verify" && !!notice && (
          <Button
            title="Khám phá sự kiện"
            icon="calendar"
            onPress={() => router.replace("/(tabs)")}
          />
        )}
        <Notice>
          {mode === "reset"
            ? "Mật khẩu cần ít nhất 8 ký tự. Hãy sử dụng mật khẩu riêng cho tài khoản của bạn."
            : "Vui lòng kiểm tra cả thư mục Spam (Thư rác) nếu không thấy email."}
        </Notice>
        {mode === "forgot" && (
          <Button
            secondary
            title="Tôi đã có liên kết đặt lại mật khẩu"
            onPress={() => router.push("/reset-password")}
          />
        )}
        <Button
          secondary
          title="Về đăng nhập"
          onPress={() => router.replace("/login")}
        />
      </Card>
    </Screen>
  );
}
