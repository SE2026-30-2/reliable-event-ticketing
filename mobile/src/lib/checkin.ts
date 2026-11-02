import * as Crypto from "expo-crypto";
import { getNetworkStateAsync } from "expo-network";
import { request } from "./api";
import {
  verifyOffline,
  type Certificate,
  type Verification,
} from "./checkin-crypto";
import {
  readScanValues,
  readValue,
  withScanLock,
  writeValue,
} from "./checkin-store";
import { storage } from "./storage";
export interface Scan extends Verification {
  device: string;
  qrPayload?: string;
  idempotencyKey: string;
  clientCheckinAt: string;
  pending: boolean;
  serverReceivedAt?: string;
  detail?: string;
  localOutcome?: string;
}
export const fingerprint = (key: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
const save = (scan: Scan) =>
  writeValue(`scan.${scan.idempotencyKey}`, JSON.stringify(scan));
async function allScans(): Promise<Scan[]> {
  return (await readScanValues()).map((value) => JSON.parse(value));
}
export async function certificate(): Promise<Certificate | null> {
  const value = await readValue("certificate");
  return value ? JSON.parse(value) : null;
}
export async function refreshCertificate() {
  const jwks = await request<Certificate["jwks"]>("/.well-known/jwks.json", {
    public: true,
  });
  if (!jwks?.keys?.some((key) => key.kty === "RSA" && key.n && key.e))
    throw new Error("Máy chủ chưa cung cấp chứng thư RSA.");
  const cached = { jwks, updatedAt: new Date().toISOString() };
  await writeValue("certificate", JSON.stringify(cached));
  return cached;
}
// Preserve the previous app's single unconfirmed scan, including its idempotency key.
export async function migratePending() {
  return withScanLock(async () => {
    const value = await storage.get("eventpass.pending-scan");
    if (!value) return;
    const old = JSON.parse(value);
    await save({
      ...old.body,
      device: old.device,
      pending: true,
      outcome: "PENDING",
    });
    await storage.remove("eventpass.pending-scan");
  });
}
export async function historyFor(key: string) {
  const device = await fingerprint(key);
  return (await allScans())
    .filter((scan) => scan.device === device)
    .sort((a, b) => b.clientCheckinAt.localeCompare(a.clientCheckinAt));
}
function confirmed(scan: Scan, response: Partial<Scan>): Scan {
  if (
    !response ||
    typeof response.outcome !== "string" ||
    !response.serverReceivedAt
  )
    throw new Error(
      "Phản hồi soát vé không hợp lệ. Giữ lại lượt quét để đồng bộ.",
    );
  return {
    ...scan,
    ticketId: response.ticketId,
    outcome: response.outcome,
    entryNo: response.entryNo,
    detail: response.detail,
    serverReceivedAt: response.serverReceivedAt,
    pending: false,
    localOutcome: scan.outcome,
    qrPayload: undefined,
  };
}
export function submitScan(key: string, payload: string, eventId: string) {
  return withScanLock(async () => {
    const device = await fingerprint(key);
    const previous = await allScans();
    const verification = verifyOffline(payload, await certificate(), eventId);
    if (verification.outcome === "ACCEPTED" && !eventId)
      verification.outcome = "PENDING";
    const sameTicket = previous.filter(
      (scan) => scan.ticketId && scan.ticketId === verification.ticketId,
    );
    if (verification.outcome === "ACCEPTED") {
      const used = sameTicket.filter((scan) => scan.outcome === "ACCEPTED");
      const count =
        Math.max(
          0,
          ...used
            .filter((scan) => !scan.pending)
            .map((scan) => scan.entryNo || 1),
        ) + used.filter((scan) => scan.pending).length;
      verification.entryNo = count + 1;
      if (
        count >= verification.maxEntries! ||
        sameTicket.some((scan) => !scan.pending && scan.outcome === "DUPLICATE")
      )
        verification.outcome = "DUPLICATE";
    }
    if (
      sameTicket.some(
        (scan) => !scan.pending && scan.outcome === "TICKET_VOIDED",
      )
    )
      verification.outcome = "TICKET_VOIDED";
    const lastDevice = previous
      .filter((scan) => scan.device === device && !scan.pending)
      .sort((a, b) => b.clientCheckinAt.localeCompare(a.clientCheckinAt))[0];
    if (["DEVICE_NOT_FOUND", "DEVICE_REVOKED"].includes(lastDevice?.outcome))
      verification.outcome = lastDevice.outcome;
    let scan: Scan = {
      ...verification,
      device,
      qrPayload: payload,
      idempotencyKey: Crypto.randomUUID(),
      clientCheckinAt: new Date().toISOString(),
      pending: true,
    };
    await save(scan);
    // A LAN can reach the backend without public internet, so only skip a known disconnection.
    const connection = await getNetworkStateAsync().catch(() => null);
    if (connection?.isConnected === false)
      return {
        scan,
        networkError: "Đang ngoại tuyến. Lượt quét đã lưu để đồng bộ.",
      };
    let networkError = "";
    try {
      const response = await request<Scan>("/api/checkin", {
        method: "POST",
        deviceKey: key,
        body: bodyOf(scan),
      });
      scan = confirmed(scan, response);
    } catch (error) {
      networkError =
        error instanceof Error ? error.message : "Không kết nối được máy chủ.";
    }
    // Storage errors must reach the UI, even if the server already processed the scan.
    if (!scan.pending) await save(scan);
    return { scan, networkError };
  });
}
const bodyOf = (scan: Scan) => ({
  qrPayload: scan.qrPayload,
  idempotencyKey: scan.idempotencyKey,
  clientCheckinAt: scan.clientCheckinAt,
});
export function syncScans(key: string) {
  return withScanLock(async () => {
    const pending = (await historyFor(key))
      .filter((scan) => scan.pending)
      .reverse();
    for (let i = 0; i < pending.length; i += 100) {
      const batch = pending.slice(i, i + 100);
      const responses = await request<Scan[]>("/api/checkin/batch", {
        method: "POST",
        deviceKey: key,
        body: batch.map(bodyOf),
      });
      if (!Array.isArray(responses) || responses.length !== batch.length)
        throw new Error("Phản hồi đồng bộ không đầy đủ. Giữ lại hàng đợi.");
      const results = batch.map((scan, index) =>
        confirmed(scan, responses[index]),
      );
      for (const scan of results) await save(scan);
    }
    return pending.length;
  });
}
