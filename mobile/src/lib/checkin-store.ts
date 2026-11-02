// Metro selects checkin-store.native.ts on Android/iOS. Web uses persistent localStorage.
export async function readValue(key: string): Promise<string | null> {
  return localStorage.getItem(`eventpass.checkin.${key}`);
}
export async function writeValue(key: string, value: string) {
  localStorage.setItem(`eventpass.checkin.${key}`, value);
}
export async function readScanValues(): Promise<string[]> {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith("eventpass.checkin.scan."))
    .map((key) => localStorage.getItem(key)!);
}
export async function withScanLock<T>(run: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      "Trình duyệt cần hỗ trợ Web Locks để lưu lượt quét an toàn.",
    );
  return navigator.locks.request("eventpass.checkin", run);
}
