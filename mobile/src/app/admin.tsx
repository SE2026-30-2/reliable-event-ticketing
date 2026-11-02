import { useState } from "react";
import { Gate, Screen, Title, Body } from "@/components/ui-kit";
import { FilterOptions } from "@/components/filter-options";
import { AdminUsers } from "@/components/admin/users";
import { AdminDevices } from "@/components/admin/devices";
import { AdminPayments } from "@/components/admin/payments";
function AdminContent() {
  const [tab, setTab] = useState("users");
  return (
    <Screen>
      <Title>
        {tab === "users"
          ? "Quản trị người dùng"
          : tab === "devices"
            ? "Thiết bị toàn cầu"
            : "Giao dịch & Hoàn tiền"}
      </Title>
      <Body muted>
        {tab === "users"
          ? "Quản lý tài khoản người dùng trên EventHub"
          : tab === "devices"
            ? "Quản lý thiết bị check-in cho toàn hệ thống và theo từng sự kiện."
            : "Theo dõi, tra cứu và xử lý hoàn tiền các giao dịch đặt vé."}
      </Body>
      <FilterOptions
        label="Quản trị hệ thống"
        value={tab}
        onChange={setTab}
        options={[
          ["users", "Người dùng"],
          ["devices", "Thiết bị"],
          ["payments", "Thanh toán"],
        ]}
      />
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
