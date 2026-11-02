import { Tabs } from "expo-router";
import { Icon } from "@/components/eventhub-icons";
import { colors, Loading } from "@/components/ui-kit";
import { useAuth } from "@/contexts/auth";
export default function TabLayout() {
  const { user, ready } = useAuth();
  const manager = user?.roles.some((role) =>
    ["ADMIN", "ORGANIZER"].includes(role),
  );
  if (!ready) return <Loading />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerTitle: "EventHub",
        headerTitleStyle: {
          color: colors.primary,
          fontWeight: "800",
          fontSize: 23,
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          borderTopColor: colors.line,
          backgroundColor: "#fff",
          minHeight: 62,
          paddingTop: 7,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Khám phá",
          tabBarIcon: ({ color }) => (
            <Icon name="home" color={color} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Vé của tôi",
          tabBarIcon: ({ color }) => (
            <Icon name="ticket" color={color} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          title: "Tổ chức",
          href: manager ? "/(tabs)/manage" : null,
          tabBarIcon: ({ color }) => (
            <Icon name="calendar" color={color} size={23} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color }) => (
            <Icon name="user" color={color} size={23} />
          ),
        }}
      />
    </Tabs>
  );
}
