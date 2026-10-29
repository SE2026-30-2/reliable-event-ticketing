import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/components/ui-kit";
import { useAuth } from "@/contexts/auth";
export default function TabLayout() {
  const { user } = useAuth();
  const manager = user?.roles.some((role) =>
    ["ADMIN", "ORGANIZER"].includes(role),
  );
  return (
    <Tabs
      screenOptions={{
        headerTitle: "EventPass",
        headerTitleStyle: {
          color: colors.primary,
          fontWeight: "800",
          fontSize: 23,
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Khám phá",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 24 }}>⌂</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Vé của tôi",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 23 }}>▤</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: "Tổ chức",
          href: manager ? "/(tabs)/manage" : null,
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 23 }}>▦</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 23 }}>◎</Text>
          ),
        }}
      />
    </Tabs>
  );
}
