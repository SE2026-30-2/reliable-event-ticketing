import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/contexts/auth";
import { colors } from "@/components/ui-kit";
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerTintColor: colors.primary,
            headerTitleStyle: { fontWeight: "700" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: "Đăng nhập" }} />
          <Stack.Screen name="register" options={{ title: "Tạo tài khoản" }} />
          <Stack.Screen
            name="events/[id]"
            options={{ title: "Chi tiết sự kiện" }}
          />
          <Stack.Screen name="tickets/[id]" options={{ title: "Vé điện tử" }} />
          <Stack.Screen
            name="manage/[id]"
            options={{ title: "Quản lý sự kiện" }}
          />
          <Stack.Screen name="admin" options={{ title: "Quản trị hệ thống" }} />
          <Stack.Screen name="checkin" options={{ title: "Soát vé" }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
