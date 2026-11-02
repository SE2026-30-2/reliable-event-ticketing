import { useCallback, useRef, useState } from "react";
import { View, Text } from "react-native";
import { RecordActions } from "../record-actions";
import { FilterPanel } from "../filter-panel";
import { useAuth } from "@/contexts/auth";
import { identity } from "@/lib/api";
import { adminUsers, normalizeSearch } from "@/lib/management";
import { dateTime, messageOf, type User } from "@/lib/types";
import { useResource } from "@/hooks/use-resource";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Heading,
  Loading,
  MetricStrip,
} from "../ui-kit";
import { FilterOptions } from "../filter-options";
import { ConfirmButton } from "../confirm-button";

function UserDetails({ id }: { id: string }) {
  const load = useCallback(
    (signal: AbortSignal) =>
      identity<User>(`/admin/users/${encodeURIComponent(id)}`, { signal }),
    [id],
  );
  const resource = useResource(load);
  return (
    <Card>
      <Heading>Chi tiết người dùng</Heading>
      <Feedback message={resource.error} retry={resource.reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <Body>Mã: {resource.data.id}</Body>
            <Body>Họ tên: {resource.data.fullName}</Body>
            <Body>Email: {resource.data.email}</Body>
            <Body>Trạng thái: {resource.data.status}</Body>
            <Body>Vai trò: {resource.data.roles.join(", ")}</Body>
            <Body>
              Email:{" "}
              {resource.data.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
            </Body>
            <Body>Đăng nhập lỗi: {resource.data.failedLoginAttempts ?? 0}</Body>
            <Body>Tham gia: {dateTime(resource.data.createdAt)}</Body>
          </>
        )
      )}
    </Card>
  );
}

export function AdminUsers() {
  const { user: current } = useAuth();
  const resource = useResource(adminUsers);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const users = (resource.data || []).filter(
    (user) =>
      normalizeSearch(`${user.fullName} ${user.email}`).includes(
        normalizeSearch(query),
      ) &&
      (!role || user.roles.includes(role)) &&
      (!status || user.status === status) &&
      (!verified || String(user.emailVerified) === verified),
  );
  const pages = Math.max(1, Math.ceil(users.length / 20));
  const currentPage = Math.min(page, pages - 1);
  async function update(user: User, kind: "status" | "roles") {
    if (lock.current || current?.id === user.id) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // Read current roles before changing one role; preserve unrelated privileges.
      const latest = await identity<User>(
        `/admin/users/${encodeURIComponent(user.id)}`,
      );
      if (
        (kind === "status" && latest.status !== user.status) ||
        (kind === "roles" &&
          latest.roles.includes("ORGANIZER") !==
            user.roles.includes("ORGANIZER"))
      )
        throw new Error(
          "Tài khoản đã thay đổi. Kiểm tra lại trước khi xác nhận.",
        );
      const roles = new Set(latest.roles);
      if (roles.has("ORGANIZER")) roles.delete("ORGANIZER");
      else roles.add("ORGANIZER");
      if (!roles.size) roles.add("USER");
      await identity(`/admin/users/${encodeURIComponent(user.id)}/${kind}`, {
        method: "PATCH",
        body:
          kind === "status"
            ? { status: latest.status === "LOCKED" ? "ACTIVE" : "LOCKED" }
            : { roles: [...roles] },
      });
      setNotice("Đã cập nhật tài khoản.");
      setDetail("");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      resource.reload();
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Heading>Quản lý người dùng</Heading>
      {!resource.loading && !resource.error && (
        <MetricStrip
          items={[
            {
              label: "Tổng người dùng",
              value: resource.data?.length ?? 0,
              icon: "user",
            },
            {
              label: "Nhà tổ chức",
              value:
                resource.data?.filter((user) =>
                  user.roles.includes("ORGANIZER"),
                ).length ?? 0,
              icon: "ticket",
            },
            {
              label: "Đã xác thực",
              value:
                resource.data?.filter((user) => user.emailVerified).length ?? 0,
              icon: "shield",
            },
          ]}
        />
      )}
      <Field
        label="Tìm người dùng theo tên hoặc email"
        value={query}
        editable={!busy}
        onChangeText={(value) => {
          setQuery(value);
          setPage(0);
        }}
      />
      <FilterPanel>
        <FilterOptions
          label="Vai trò"
          value={role}
          options={[
            ["", "Tất cả vai trò"],
            ["USER", "Người mua"],
            ["ORGANIZER", "Ban tổ chức"],
            ["ADMIN", "Quản trị viên"],
          ]}
          disabled={busy}
          onChange={(value) => {
            setRole(value);
            setPage(0);
          }}
        />
        <FilterOptions
          label="Trạng thái tài khoản"
          value={status}
          options={[
            ["", "Tất cả tài khoản"],
            ["ACTIVE", "Đang hoạt động"],
            ["LOCKED", "Đã khóa"],
          ]}
          disabled={busy}
          onChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
        />
        <FilterOptions
          label="Xác minh email"
          value={verified}
          options={[
            ["", "Tất cả email"],
            ["true", "Đã xác minh"],
            ["false", "Chưa xác minh"],
          ]}
          disabled={busy}
          onChange={(value) => {
            setVerified(value);
            setPage(0);
          }}
        />
      </FilterPanel>
      <Feedback message={resource.error || error} retry={resource.reload} />
      {!!notice && <Body>{notice}</Body>}
      {resource.loading ? (
        <Loading />
      ) : (
        !resource.error && (
          <>
            <Body>{users.length} người dùng phù hợp</Body>
            {!users.length && (
              <Body muted>Không tìm thấy người dùng phù hợp.</Body>
            )}
            {users
              .slice(currentPage * 20, (currentPage + 1) * 20)
              .map((user) => (
                <Card key={user.id} style={{ padding: 10, gap: 5 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "center",
                      paddingRight: 26,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: "#eee6ff",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: "#653cff", fontWeight: "800" }}>
                        {user.fullName
                          ?.trim()
                          .split(/\s+/)
                          .map((n) => n[0])
                          .slice(-2)
                          .join("")}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#11113d",
                          fontWeight: "700",
                        }}
                      >
                        {user.fullName}
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: "#595b7b", marginTop: 3 }}
                      >
                        {user.email}
                      </Text>
                    </View>
                  </View>
                  <Badge>
                    {user.status} ·{" "}
                    {user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
                  </Badge>
                  <Body muted>{user.roles.join(", ")}</Body>
                  <RecordActions label={user.fullName}>
                    <Button
                      secondary
                      title={
                        detail === user.id
                          ? "Đóng chi tiết người dùng"
                          : "Xem chi tiết người dùng"
                      }
                      onPress={() =>
                        setDetail(detail === user.id ? "" : user.id)
                      }
                    />
                    {detail === user.id && (
                      <UserDetails key={user.id} id={user.id} />
                    )}
                    <ConfirmButton
                      title={
                        user.status === "LOCKED"
                          ? "Mở khóa tài khoản"
                          : "Khóa tài khoản"
                      }
                      disabled={busy || current?.id === user.id}
                      description={`Thay đổi trạng thái tài khoản ${user.email}?`}
                      onConfirm={() => update(user, "status")}
                    />
                    <ConfirmButton
                      title={
                        user.roles.includes("ORGANIZER")
                          ? "Gỡ quyền tổ chức"
                          : "Cấp quyền tổ chức"
                      }
                      disabled={busy || current?.id === user.id}
                      description={`Thay đổi quyền tổ chức sự kiện của ${user.email}?`}
                      onConfirm={() => update(user, "roles")}
                    />
                  </RecordActions>
                </Card>
              ))}
            <Button
              secondary
              title="← Trước"
              disabled={busy || currentPage === 0}
              onPress={() => setPage(currentPage - 1)}
            />
            <Body>
              Trang {currentPage + 1} / {pages}
            </Body>
            <Button
              secondary
              title="Sau →"
              disabled={busy || currentPage + 1 >= pages}
              onPress={() => setPage(currentPage + 1)}
            />
          </>
        )
      )}
      <Button
        secondary
        title="Tải lại người dùng"
        disabled={busy}
        onPress={resource.reload}
      />
    </>
  );
}
