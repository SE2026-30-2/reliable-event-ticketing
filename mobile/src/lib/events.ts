import { type Event } from "./types";

export const categories: [string, string][] = [
  ["MUSIC", "Âm nhạc"],
  ["SPORTS", "Thể thao"],
  ["SEMINAR", "Hội thảo"],
  ["ARTS", "Nghệ thuật & điện ảnh"],
  ["COMMUNITY", "Cộng đồng"],
  ["OTHER", "Khác"],
];
export const categoryLabel = (value?: string) =>
  categories.find(([id]) => id === value)?.[1] || "Chưa phân loại";

export function salesSchedule(start: string, end: string, endsAt: string) {
  if (!start.trim() && !end.trim()) return {};
  const from = Date.parse(start),
    until = Date.parse(end);
  if (
    !Number.isFinite(from) ||
    !Number.isFinite(until) ||
    until <= from ||
    until > Date.parse(endsAt)
  )
    throw new Error(
      "Nhập đủ lịch mở bán: giờ đóng bán phải sau giờ mở bán và không sau giờ kết thúc sự kiện.",
    );
  return {
    salesStartAt: new Date(from).toISOString(),
    salesEndAt: new Date(until).toISOString(),
  };
}

export function salesMessage(event: Event, now: number) {
  if (event.status !== "PUBLISHED") return "Sự kiện hiện không mở bán.";
  if (Date.parse(event.endsAt) <= now) return "Sự kiện đã kết thúc.";
  if (event.salesStartAt && Date.parse(event.salesStartAt) > now)
    return "Chưa đến thời gian mở bán.";
  if (event.salesEndAt && Date.parse(event.salesEndAt) <= now)
    return "Đã hết thời gian mở bán.";
  return "";
}
