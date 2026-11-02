import { ApiError, post, request } from "./api";
import { listOf, type Page, type Payment, type Ticket } from "./types";

export const terminalPayment = (status: string) =>
  ["COMPLETED", "FAILED", "EXPIRED", "REFUNDED", "REFUND_REQUIRED"].includes(
    status,
  );

export async function findPayment(reservationId: string, signal?: AbortSignal) {
  try {
    return await request<Payment>(
      `/api/payment/requests/by-reservation/${encodeURIComponent(reservationId)}`,
      { signal },
    );
  } catch (error) {
    // A reservation can exist before its first payment request (or use the mock provider).
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
export const syncPayment = (txnRef: string) =>
  post<Payment>(`/api/payment/vnpay/sync/${encodeURIComponent(txnRef)}`);

export async function reservationTickets(
  reservationId: string,
  signal: AbortSignal,
) {
  const tickets: Ticket[] = [];
  for (let page = 0; ; page++) {
    const result = await request<Page<Ticket> | Ticket[]>(
      `/api/my/tickets?page=${page}&size=100`,
      { signal },
    );
    tickets.push(
      ...listOf(result).filter(
        (ticket) => ticket.reservationId === reservationId,
      ),
    );
    if (Array.isArray(result) || page + 1 >= result.totalPages) break;
  }
  return tickets;
}
