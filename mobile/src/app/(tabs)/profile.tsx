import { useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
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
  Heading,
  Icon,
  styles,
  colors,
  Notice,
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
      <View style={styles.center}>
        <Title>Hồ sơ cá nhân</Title>
      </View>
      <Feedback message={error} />
      {!!notice && <Notice success>{notice}</Notice>}
      <Image
        source={require("../../../assets/eventhub/concert.jpg")}
        style={{ width: "100%", height: 125, borderRadius: 16 }}
      />
      <View style={{ alignItems: "center", gap: 9, marginTop: -56 }}>
        <View
          style={{
            width: 90,
            height: 90,
            borderRadius: 45,
            backgroundColor: colors.soft,
            borderColor: "#fff",
            borderWidth: 4,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{ color: colors.primary, fontSize: 32, fontWeight: "800" }}
          >
            {user?.fullName
              ?.trim()
              .split(/\s+/)
              .map((n) => n[0])
              .slice(-2)
              .join("")
              .toUpperCase()}
          </Text>
        </View>
        <Title>{user?.fullName}</Title>
        <Badge>
          {user?.roles.includes("ADMIN")
            ? "Quản trị viên"
            : user?.roles.includes("ORGANIZER")
              ? "Nhà tổ chức"
              : "Người mua"}
        </Badge>
        <View style={styles.row}>
          <Icon name="mail" size={16} />
          <Body>{user?.email}</Body>
        </View>
      </View>
      <Card>
        <Heading>Thông tin cá nhân</Heading>
        <Badge>
          {user?.emailVerified ? "ĐÃ XÁC MINH EMAIL" : "CHƯA XÁC MINH EMAIL"}
        </Badge>
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
      <Card>
        <Heading>Bảo mật</Heading>
        <Body muted>Quản lý mật khẩu và bảo mật tài khoản của bạn.</Body>
        <Button
          secondary
          title="Đổi mật khẩu"
          icon="lock"
          onPress={() => router.push("/forgot-password")}
        />
      </Card>
      {!user?.emailVerified && (
        <Button
          secondary
          title="Nhập token xác minh email"
          onPress={() => router.push("/verify-email")}
        />
      )}
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
        icon="logout"
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
