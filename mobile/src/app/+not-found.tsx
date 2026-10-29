import { router } from "expo-router";
import { Body, Button, Screen, Title } from "@/components/ui-kit";
export default function NotFound() {
  return (
    <Screen>
      <Title>Không tìm thấy trang</Title>
      <Body>Đường dẫn không tồn tại.</Body>
      <Button title="Về trang chủ" onPress={() => router.replace("/(tabs)")} />
    </Screen>
  );
}
