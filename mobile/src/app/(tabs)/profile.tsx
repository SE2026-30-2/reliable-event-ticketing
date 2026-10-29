import { useState } from "react";
import { router } from "expo-router";
import {
  Gate,
  Screen,
  Title,
  Card,
  Badge,
  Body,
  Button,
  Feedback,
} from "@/components/ui-kit";
import { useAuth } from "@/contexts/auth";
import { identity } from "@/lib/api";
import { dateTime, messageOf } from "@/lib/types";
function ProfileContent() {
  const { user, reload, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function act(task: () => Promise<unknown>, success = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(success);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Title>Tài khoản của tôi</Title>
      <Feedback message={error} />
      {!!notice && <Body>{notice}</Body>}
      <Card>
        <Badge>
          {user?.emailVerified ? "ĐÃ XÁC MINH EMAIL" : "CHƯA XÁC MINH EMAIL"}
        </Badge>
        <Title>{user?.fullName}</Title>
        <Body>{user?.email}</Body>
        <Body muted>Vai trò: {user?.roles.join(", ")}</Body>
        <Body muted>Trạng thái: {user?.status}</Body>
        <Body muted>Tham gia: {dateTime(user?.createdAt)}</Body>
        <Button
          secondary
          title="Cập nhật thông tin"
          busy={busy}
          onPress={() => act(reload)}
        />
        {!user?.emailVerified && (
          <Button
            title="Gửi lại email xác minh"
            disabled={busy}
            onPress={() =>
              act(
                () =>
                  identity("/email/verify/resend", {
                    method: "POST",
                    body: {},
                  }),
                "Đã yêu cầu gửi email xác minh. Vui lòng kiểm tra hộp thư.",
              )
            }
          />
        )}
      </Card>
      <Button
        secondary
        title="Soát vé sự kiện"
        onPress={() => router.push("/checkin")}
      />
      {user?.roles.includes("ADMIN") && (
        <Button
          secondary
          title="Quản trị hệ thống"
          onPress={() => router.push("/admin")}
        />
      )}
      <Button
        danger
        title="Đăng xuất"
        disabled={busy}
        onPress={() => act(logout)}
      />
    </Screen>
  );
}
export default function Profile() {
  return (
    <Gate>
      <ProfileContent />
    </Gate>
  );
}
