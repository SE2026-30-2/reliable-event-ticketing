import Constants from "expo-constants";
import { Platform } from "react-native";

// Physical phones reach the development machine over LAN, not their own localhost.
const host =
  Constants.expoConfig?.hostUri?.split(":")[0] ||
  (Platform.OS === "android" ? "10.0.2.2" : "localhost");
export const endpoints = {
  identity: (
    process.env.EXPO_PUBLIC_USER_SERVICE_URL || `http://${host}:8087`
  ).replace(/\/$/, ""),
  ticketing: (
    process.env.EXPO_PUBLIC_TICKETING_SERVICE_URL || `http://${host}:8091`
  ).replace(/\/$/, ""),
};
let accessToken: string | null = null;
let unauthorized: (() => void) | undefined;
export function configureSession(
  token: string | null,
  onUnauthorized?: () => void,
) {
  accessToken = token;
  unauthorized = onUnauthorized;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
type Options = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  public?: boolean;
  token?: string;
  deviceKey?: string;
  responseType?: "text";
};
export async function request<T>(
  path: string,
  options: Options = {},
  service: keyof typeof endpoints = "ticketing",
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(cancel, 15000);
  const token = options.token ?? accessToken;
  try {
    const response = await fetch(`${endpoints[service]}${path}`, {
      method: options.method || "GET",
      signal: controller.signal,
      headers: {
        Accept:
          options.responseType === "text" ? "text/csv" : "application/json",
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(!options.public && !options.deviceKey && token
          ? { Authorization: `Bearer ${token}` }
          : {}),
        ...(options.deviceKey ? { "X-Device-Key": options.deviceKey } : {}),
      },
      ...(options.body !== undefined
        ? { body: JSON.stringify(options.body) }
        : {}),
    });
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : undefined;
    } catch {
      data = undefined;
    }
    if (!response.ok) {
      if (
        response.status === 401 &&
        !options.public &&
        !options.token &&
        !options.deviceKey
      )
        unauthorized?.();
      throw new ApiError(
        response.status,
        data?.message ||
          data?.detail ||
          (response.status === 401
            ? "Phiên đăng nhập đã hết hạn."
            : response.status === 403
              ? "Bạn không có quyền thực hiện thao tác này."
              : `Máy chủ trả lỗi ${response.status}. Vui lòng thử lại.`),
      );
    }
    return (options.responseType === "text" ? raw : data) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new Error(
        "Yêu cầu đã dừng hoặc quá thời gian chờ. Hãy tải lại dữ liệu trước khi thử tiếp.",
      );
    throw new Error(
      "Không thể kết nối máy chủ. Kiểm tra mạng và địa chỉ API trong mobile/.env.local.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }
}
export const identity = <T>(path: string, options?: Options) =>
  request<T>(`/api/user${path}`, options, "identity");
export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body });
export const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body });
