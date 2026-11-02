import { useState } from "react";
import { View } from "react-native";
import { Button, Gate, Screen, Title, styles } from "@/components/ui-kit";
import { AdminUsers } from "@/components/admin/users";
import { AdminDevices } from "@/components/admin/devices";
import { AdminPayments } from "@/components/admin/payments";
function AdminContent() {
  const [tab, setTab] = useState("users");
  return (
    <Screen>
      <Title>Quản trị hệ thống</Title>
      <View style={styles.row}>
        {[
          ["users", "Người dùng"],
          ["devices", "Thiết bị"],
          ["payments", "Thanh toán"],
        ].map(([key, title]) => (
          <Button
            key={key}
            title={title}
            secondary={tab !== key}
            onPress={() => setTab(key)}
          />
        ))}
      </View>
      {tab === "users" ? (
        <AdminUsers />
      ) : tab === "devices" ? (
        <AdminDevices />
      ) : (
        <AdminPayments />
      )}
    </Screen>
  );
}
export default function Admin() {
  return (
    <Gate roles={["ADMIN"]}>
      <AdminContent />
    </Gate>
  );
}
