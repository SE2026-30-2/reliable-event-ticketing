import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
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
import { request } from "@/lib/api";
import { storage } from "@/lib/storage";
import { dateTime, messageOf } from "@/lib/types";
interface ScanBody {
  qrPayload: string;
  idempotencyKey: string;
  clientCheckinAt: string;
}
interface Pending {
  device: string;
  body: ScanBody;
}
interface Result {
  ticketId?: string;
  outcome: string;
  detail?: string;
  serverReceivedAt: string;
  entryNo?: number;
}
export default function Checkin() {
  const [permission, requestPermission] = useCameraPermissions();
  const [deviceKey, setDeviceKey] = useState("");
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
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<Result>();
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
    storage
      .get("eventpass.pending-scan")
      .then((value) => {
        if (active && value) setPending(JSON.parse(value));
      })
      .catch((error) => {
        if (active) setError(messageOf(error));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function scan(value: string) {
    if (
      lock.current ||
      !ready ||
      !deviceKey.trim() ||
      (!value.trim() && !pending)
    )
      return;
    lock.current = true;
    setBusy(true);
    setCamera(false);
    setError("");
    setResult(undefined);
    try {
      const device = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        deviceKey.trim(),
      );
      if (pending && pending.device !== device)
        throw new Error(
          "Lượt quét chưa xác nhận thuộc khóa thiết bị khác. Nhập đúng khóa để thử lại.",
        );
      const entry: Pending = pending || {
        device,
        body: {
          qrPayload: value.trim(),
          idempotencyKey: Crypto.randomUUID(),
          clientCheckinAt: new Date().toISOString(),
        },
      };
      // Persist before submitting; retries use the same idempotency key after a lost response.
      await storage.set("eventpass.pending-scan", JSON.stringify(entry));
      setPending(entry);
      const response = await request<Result>("/api/checkin", {
        method: "POST",
        body: entry.body,
        deviceKey: deviceKey.trim(),
      });
      if (!response?.outcome)
        throw new Error("Phản hồi không hợp lệ. Giữ lại lượt quét để thử lại.");
      await storage.remove("eventpass.pending-scan");
      setPending(null);
      setResult(response);
      setPayload("");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Title>Soát vé sự kiện</Title>
      <Body muted>
        Dùng khóa thiết bị do ban tổ chức cấp. Lượt quét chỉ được chấp nhận sau
        khi máy chủ xác nhận.
      </Body>
      <Card>
        <Field
          label="Khóa thiết bị"
          value={deviceKey}
          onChangeText={setDeviceKey}
          secureTextEntry
          autoCapitalize="none"
          editable={!busy}
        />
        <Feedback message={error} />
        {pending && (
          <>
            <Badge>CHỜ MÁY CHỦ XÁC NHẬN</Badge>
            <Body muted>
              Lượt quét được giữ lại. Thử lại bằng cùng khóa thiết bị để tránh
              ghi nhận hai lần.
            </Body>
            <Button
              title="Thử lại lượt quét"
              busy={busy}
              disabled={!deviceKey.trim()}
              onPress={() => scan("")}
            />
          </>
        )}
        {!pending && (
          <>
            <Field
              label="Nội dung mã QR"
              value={payload}
              onChangeText={setPayload}
              multiline
              autoCapitalize="none"
              editable={!busy}
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
          </>
        )}
      </Card>
      {camera && focused && foreground && permission?.granted && !pending && (
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
            {result.outcome === "ACCEPTED" ? "VÉ HỢP LỆ" : "KHÔNG CHẤP NHẬN"}
          </Badge>
          <Heading>{result.outcome}</Heading>
          <Body>{result.detail}</Body>
          {!!result.ticketId && <Body muted>Mã vé: {result.ticketId}</Body>}
          {!!result.entryNo && <Body>Lượt vào: {result.entryNo}</Body>}
          <Body muted>{dateTime(result.serverReceivedAt)}</Body>
        </Card>
      )}
    </Screen>
  );
}
