import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNetworkState } from "expo-network";
import { AppState, View } from "react-native";
import {
  Badge,
  Body,
  Button,
  Card,
  Feedback,
  Field,
  Heading,
  Screen,
  Title,
} from "@/components/ui-kit";
import {
  certificate,
  historyFor,
  migratePending,
  refreshCertificate,
  submitScan,
  syncScans,
  type Scan,
} from "@/lib/checkin";
import { dateTime, messageOf } from "@/lib/types";

export default function Checkin() {
  const [permission, requestPermission] = useCameraPermissions();
  const network = useNetworkState();
  const [deviceKey, setDeviceKey] = useState("");
  const [eventId, setEventId] = useState("");
  const [payload, setPayload] = useState("");
  const [camera, setCamera] = useState(false);
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [certificateAt, setCertificateAt] = useState<string>();
  const [history, setHistory] = useState<Scan[]>([]);
  const [result, setResult] = useState<Scan>();
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(30);
  const [autoSync, setAutoSync] = useState(true);
  const [scannerInput, setScannerInput] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setCamera(false);
      };
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      await migratePending();
      const cached = await certificate();
      if (active) {
        setCertificateAt(cached?.updatedAt);
        setReady(true);
      }
    })().catch((error) => {
      if (active) setError(messageOf(error));
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (deviceKey.trim() && ready)
      historyFor(deviceKey.trim())
        .then((scans) => {
          if (active) setHistory(scans);
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        });
    return () => {
      active = false;
    };
  }, [deviceKey, ready]);
  async function act(task: () => Promise<void>) {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setCamera(false);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function scan(value: string) {
    if (!deviceKey.trim() || !value.trim() || lock.current) return;
    setResult(undefined);
    await act(async () => {
      const response = await submitScan(
        deviceKey.trim(),
        value.trim(),
        eventId.trim(),
      );
      setResult(response.scan);
      setPayload("");
      setHistory(await historyFor(deviceKey.trim()));
      if (response.networkError) setError(response.networkError);
    });
  }
  const pending = history.filter((scan) => scan.pending).length;
  async function sync() {
    await act(async () => {
      const count = await syncScans(deviceKey.trim());
      const scans = await historyFor(deviceKey.trim());
      setHistory(scans);
      setResult(scans[0]);
      setNotice(`Đã đồng bộ ${count} lượt quét.`);
    });
  }
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  });
  useEffect(() => {
    if (
      !autoSync ||
      !focused ||
      !foreground ||
      !ready ||
      network.isConnected === false ||
      !deviceKey.trim() ||
      pending === 0
    )
      return;
    const timer = setInterval(() => {
      void syncRef.current();
    }, 15000);
    return () => clearInterval(timer);
  }, [
    autoSync,
    focused,
    foreground,
    ready,
    deviceKey,
    pending,
    network.isConnected,
  ]);
  const visible = history.filter(
    (scan) =>
      filter === "all" ||
      (filter === "pending"
        ? scan.pending
        : filter === "ACCEPTED"
          ? scan.outcome === "ACCEPTED"
          : scan.outcome !== "ACCEPTED"),
  );
  return (
    <Screen>
      <Title>Soát vé sự kiện</Title>
      <Badge>
        {network.isConnected === false ? "NGOẠI TUYẾN" : "CÓ KẾT NỐI MẠNG"}
      </Badge>
      <Body muted>
        Dùng khóa thiết bị do ban tổ chức cấp. Khi mất mạng, kết quả kiểm tra
        chữ ký là tạm thời; đồng bộ để máy chủ xác nhận.
      </Body>
      <Feedback message={error} />
      {!!notice && <Body>{notice}</Body>}
      <Card>
        <Field
          label="Khóa thiết bị"
          value={deviceKey}
          onChangeText={(value) => {
            setDeviceKey(value);
            setHistory([]);
            setResult(undefined);
          }}
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
        />
        <Field
          label="Mã sự kiện để kiểm tra offline"
          value={eventId}
          onChangeText={setEventId}
          autoCapitalize="none"
          editable={!busy}
        />
        <Body muted>
          Nhập đúng mã sự kiện để tạm chấp nhận vé khi offline. Thiếu mã sự kiện
          hoặc chứng thư sẽ cần chờ máy chủ.
        </Body>
        <Body muted>Chứng thư: {dateTime(certificateAt)}</Body>
        <Button
          secondary
          title="Cập nhật chứng thư offline"
          disabled={!ready}
          busy={busy}
          onPress={() =>
            act(async () => {
              setCertificateAt((await refreshCertificate()).updatedAt);
              setNotice("Đã lưu chứng thư xác minh chữ ký QR.");
            })
          }
        />
        <Badge>CHỜ ĐỒNG BỘ: {pending}</Badge>
        <Button
          title="Đồng bộ lượt quét"
          disabled={!ready || !deviceKey.trim() || pending === 0}
          busy={busy}
          onPress={sync}
        />
        <Button
          secondary
          title={autoSync ? "Tự đồng bộ: Bật" : "Tự đồng bộ: Tắt"}
          disabled={busy}
          onPress={() => setAutoSync(!autoSync)}
        />
        <Body muted>
          Hàng đợi được lưu trên thiết bị, giữ nguyên mã idempotency khi thử
          lại. Offline không kiểm tra được vé bị thu hồi hoặc lượt đã dùng trên
          thiết bị khác.
        </Body>
      </Card>
      <Card>
        <Button
          secondary
          title={
            scannerInput ? "Chế độ máy quét Bluetooth / USB" : "Chế độ nhập tay"
          }
          disabled={busy}
          onPress={() => setScannerInput(!scannerInput)}
        />
        <Field
          label="Nội dung mã QR"
          value={payload}
          onChangeText={setPayload}
          multiline={!scannerInput}
          returnKeyType="done"
          onSubmitEditing={() => {
            void scan(payload);
          }}
          autoCapitalize="none"
          editable={!busy}
          maxLength={16384}
        />
        <Button
          title="Kiểm tra vé"
          busy={busy}
          disabled={!ready || !deviceKey.trim() || !payload.trim()}
          onPress={() => scan(payload)}
        />
        <Button
          secondary
          title={camera ? "Đóng camera" : "Quét mã bằng camera"}
          disabled={!ready || busy || !deviceKey.trim()}
          onPress={async () => {
            if (camera) {
              setCamera(false);
              return;
            }
            try {
              const allowed =
                permission?.granted || (await requestPermission()).granted;
              if (allowed) setCamera(true);
              else
                setError(
                  "Chưa có quyền camera. Cho phép camera trong cài đặt hoặc nhập nội dung QR.",
                );
            } catch (error) {
              setError(messageOf(error));
            }
          }}
        />
      </Card>
      {camera && focused && foreground && permission?.granted && (
        <View style={{ height: 320, overflow: "hidden", borderRadius: 22 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              void scan(data);
            }}
          />
        </View>
      )}
      {result && (
        <Card>
          <Badge>
            {result.pending
              ? "KẾT QUẢ OFFLINE · CHỜ ĐỒNG BỘ"
              : "MÁY CHỦ ĐÃ XÁC NHẬN"}
          </Badge>
          <Heading>
            {result.outcome === "ACCEPTED"
              ? result.pending
                ? "Chữ ký hợp lệ · Tạm chấp nhận"
                : "VÉ HỢP LỆ"
              : result.outcome === "PENDING"
                ? "Chưa có chứng thư · Chưa cho vào"
                : "KHÔNG CHẤP NHẬN"}
          </Heading>
          <Body>{result.outcome}</Body>
          {!!result.detail && <Body>{result.detail}</Body>}
          {!!result.ticketId && <Body muted>Mã vé: {result.ticketId}</Body>}
          {!!result.entryNo && <Body>Lượt vào: {result.entryNo}</Body>}
          <Body muted>
            {dateTime(result.serverReceivedAt || result.clientCheckinAt)}
          </Body>
        </Card>
      )}
      <Heading>Lịch sử thiết bị ({history.length})</Heading>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          ["all", "Tất cả"],
          ["ACCEPTED", "Cho vào"],
          ["rejected", "Chưa cho vào"],
          ["pending", "Chờ đồng bộ"],
        ].map(([key, label]) => (
          <Button
            key={key}
            title={label}
            secondary={filter !== key}
            onPress={() => {
              setFilter(key);
              setLimit(30);
            }}
          />
        ))}
      </View>
      {visible.slice(0, limit).map((scan) => (
        <Card key={scan.idempotencyKey}>
          <Badge>{scan.pending ? "CHỜ ĐỒNG BỘ" : "ĐÃ ĐỒNG BỘ"}</Badge>
          <Body>
            {scan.outcome} · {scan.ticketId || "Không xác định vé"}
          </Body>
          <Body muted>{dateTime(scan.clientCheckinAt)}</Body>
          {!!scan.localOutcome && scan.localOutcome !== scan.outcome && (
            <Body>Kết quả cục bộ trước đó: {scan.localOutcome}</Body>
          )}
          <Button
            secondary
            title="Xem kết quả lượt quét"
            onPress={() => setResult(scan)}
          />
        </Card>
      ))}
      {visible.length > limit && (
        <Button
          secondary
          title="Xem thêm lịch sử"
          onPress={() => setLimit(limit + 30)}
        />
      )}
    </Screen>
  );
}
