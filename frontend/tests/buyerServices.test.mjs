import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('buyer services load all owned pages, recover reservations and preserve API errors', async () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => 'test-token' };
  const server = await createServer({ cacheDir: 'tmp/buyer-unit-vite-cache', server: { middlewareMode: true, ws: false }, appType: 'custom' });
  try {
    const { default: client } = await server.ssrLoadModule('/src/services/axiosClient.js');
    const { ticketService } = await server.ssrLoadModule('/src/services/ticketService.js');
    const { validatePayment } = await server.ssrLoadModule('/src/services/paymentService.js');
    const calls = [], reservationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    let failPage = false;
    client.defaults.adapter = async config => {
      calls.push(config);
      if (failPage && config.params.page === 1) throw { config, response: { status: 429, headers: { 'retry-after': '5' }, data: { message: 'Too many requests' } } };
      const page = config.params.page;
      return { status: 200, data: { content: [{ ticketId: `ticket-${page}`, reservationId: page === 1 ? reservationId : 'other', eventId: 'event', priceCents: 0, status: 'RESERVED' }], totalPages: 3 }, config, headers: {} };
    };
    const all = await ticketService.getAllMyTickets();
    assert.equal(all.length, 3);
    assert.deepEqual(calls.map(config => config.params.page), [0, 1, 2]);
    const restored = await ticketService.getReservation(reservationId.toUpperCase());
    assert.equal(restored.tickets.length, 1);
    assert.equal(restored.totalCents, 0);
    assert.equal(restored.tickets[0].ticketId, 'ticket-1');
    await assert.rejects(ticketService.getReservation('missing-reservation'), /Không tìm thấy/);
    failPage = true;
    await assert.rejects(ticketService.getAllMyTickets(), failure => failure.response.status === 429 && failure.response.headers['retry-after'] === '5');
    const payment = { paymentRequestId: 'payment', reservationId, status: 'COMPLETED', provider: 'FREE', amountCents: 0 };
    assert.equal(validatePayment(payment, reservationId.toUpperCase()), payment);
    assert.throws(() => validatePayment({ ...payment, reservationId: 'different' }, reservationId), /chưa xác nhận/);
    assert.throws(() => validatePayment({ ...payment, status: 'success' }, reservationId), /chưa xác nhận/);
    assert.throws(() => validatePayment({ ...payment, amountCents: -1 }, reservationId), /chưa xác nhận/);
  } finally {
    await server.close();
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
