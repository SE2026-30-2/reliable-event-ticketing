import { request, identity } from "./api";
import { type Page, type Event, type User } from "./types";

export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}
async function allPages<T>(
  fetchPage: (page: number) => Promise<T[] | Page<T>>,
) {
  const values: T[] = [];
  for (let page = 0; ; page++) {
    const data = await fetchPage(page);
    values.push(...(Array.isArray(data) ? data : data.content));
    if (Array.isArray(data) || page + 1 >= data.totalPages) return values;
  }
}
export const managementEvents = (signal: AbortSignal) =>
  allPages<Event>((page) =>
    request(`/api/manage/events?page=${page}&size=100`, { signal }),
  );
export const adminUsers = (signal: AbortSignal) =>
  allPages<User>((page) =>
    identity(`/admin/users?page=${page}&size=100&sort=createdAt,desc`, {
      signal,
    }),
  );

export function eventStatuses(event?: Event): string[] {
  if (!event) return ["DRAFT", "PUBLISHED"];
  if (event.status === "DRAFT") return ["DRAFT", "PUBLISHED", "CANCELLED"];
  if (event.status === "PUBLISHED") return ["PUBLISHED", "CANCELLED"];
  return [event.status];
}
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value.trim());
