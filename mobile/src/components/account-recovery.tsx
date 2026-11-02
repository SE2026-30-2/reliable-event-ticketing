import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Screen,
  Title,
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
    <Screen>
      <Title>{title}</Title>
      <Card>
        <Feedback message={error} />
        {notice ? (
          <Body>{notice}</Body>
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
            <Button title={title} busy={busy} onPress={submit} />
          </>
        )}
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
