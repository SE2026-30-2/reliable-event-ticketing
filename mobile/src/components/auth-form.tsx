import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  Screen,
  Title,
  Body,
  Card,
  Field,
  Button,
  Feedback,
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
  const [visible, setVisible] = useState(false);
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
    <Screen>
      <Title>
        {register ? "Tham gia cùng EventPass" : "Chào mừng trở lại!"}
      </Title>
      <Body muted>
        {register
          ? "Tạo tài khoản để khám phá sự kiện và quản lý vé điện tử."
          : "Đăng nhập để tiếp tục những trải nghiệm đáng nhớ."}
      </Body>
      <Card>
        <Feedback message={error || (!register ? auth.sessionError : "")} />
        {success ? (
          <>
            <Title>Đăng ký thành công</Title>
            <Body>Kiểm tra hộp thư để xác minh email trước khi đặt vé.</Body>
            <Button
              title="Đăng nhập"
              onPress={() => router.replace("/login")}
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
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoComplete={register ? "new-password" : "current-password"}
            />
            {register && (
              <Field
                label="Xác nhận mật khẩu"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!visible}
                autoCapitalize="none"
              />
            )}
            <Button
              secondary
              title={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onPress={() => setVisible(!visible)}
            />
            <Button
              title={register ? "Đăng ký tài khoản" : "Đăng nhập"}
              busy={busy}
              onPress={submit}
            />
            <Button
              secondary
              title={
                register
                  ? "Đã có tài khoản? Đăng nhập"
                  : "Chưa có tài khoản? Đăng ký"
              }
              onPress={() => router.replace(register ? "/login" : "/register")}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
