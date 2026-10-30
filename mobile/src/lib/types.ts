export interface User {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  status: string;
  emailVerified: boolean;
  createdAt: string;
}
export interface Event {
  eventId: string;
  name: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: string;
  description?: string;
  bannerUrl?: string;
}
export interface TicketType {
  ticketTypeId: string;
  eventId: string;
  name: string;
  priceCents: number;
  remaining: number;
  quota: number;
  maxEntries: number;
  bundleSize: number;
}
export interface Ticket {
  ticketId: string;
  ticketTypeId: string;
  eventId: string;
  holderName: string;
  holderEmail: string;
  status: string;
  priceCents: number;
  qrPayload?: string;
  reservationId: string;
  reservationExpiresAt?: string;
  validFrom: string;
  validUntil: string;
}
export interface WaitlistEntry {
  entryId: string;
  ticketTypeId: string;
  quantity: number;
  status: string;
  reservationId?: string;
  offeredAt?: string;
  offerExpiresAt?: string;
}
export interface Page<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
}
export interface Quote {
  grossCents: number;
  discountCents: number;
  totalCents: number;
}
export interface Reservation {
  reservationId: string;
  tickets: Ticket[];
  totalCents: number;
  discountCents: number;
}
export interface Device {
  deviceId: string;
  label: string;
  eventId?: string;
  status: string;
  createdAt: string;
  apiKey?: string;
}
export interface Coupon {
  couponId: string;
  code: string;
  type: string;
  value: number;
  active: boolean;
  redeemedCount: number;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    cents / 100,
  );
export const dateTime = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("vi-VN")
    : "Chưa cập nhật";
export const listOf = <T>(value: T[] | Page<T>): T[] =>
  Array.isArray(value) ? value : value.content;
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
export const isEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
