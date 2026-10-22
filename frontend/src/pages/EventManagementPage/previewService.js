// Isolated, in-memory data for the development-only preview. No API or storage writes.
export function createPreviewService() {
  const event = { eventId: 'preview', name: 'The Dreams Concert 2026', venue: 'SVĐ Mỹ Đình, Hà Nội', description: 'Đêm nhạc bùng nổ với những bản hit đình đám, cùng dàn nghệ sĩ hàng đầu trong không gian âm thanh và ánh sáng đỉnh cao!', startsAt: '2026-12-25T08:00:00Z', endsAt: '2026-12-25T15:00:00Z', status: 'PUBLISHED', bannerUrl: '' };
  const types = [
    { ticketTypeId: 'vip', name: 'VIP', priceCents: 50000000, quota: 1500, issuedCount: 1250, remaining: 250 },
    { ticketTypeId: 'a', name: 'Khu A', priceCents: 40000000, quota: 1500, issuedCount: 980, remaining: 520 },
    { ticketTypeId: 'b', name: 'Khu B', priceCents: 30000000, quota: 1500, issuedCount: 1198, remaining: 302 },
  ].map((type) => ({ ...type, validFrom: event.startsAt, validUntil: event.endsAt, maxEntries: 1, bundleSize: 1 }));
  const coupons = [{ couponId: 'c1', code: 'DREAMS20', type: 'PERCENT', value: 20, redeemedCount: 428, maxRedemptions: 500, active: true }, { couponId: 'c2', code: 'EARLYBIRD', type: 'FIXED', value: 5000000, redeemedCount: 312, maxRedemptions: 500, active: false }];
  const devices = [{ deviceId: 'd1', label: 'Cổng A · Máy 01', status: 'ACTIVE', createdAt: '2026-10-17T08:00:00Z', lastSeenAt: '2026-10-17T09:00:00Z' }];
  const tickets = Array.from({ length: 23 }, (_, i) => ({ ticketId: `ticket-${i + 1}`, ticketTypeId: types[i % 3].ticketTypeId, holderName: `Khách minh họa ${i + 1}`, holderEmail: `guest${i + 1}@example.com`, ownerEmail: `guest${i + 1}@example.com`, status: 'ISSUED', source: 'PURCHASE', issuedAt: '2026-10-17T08:00:00Z' }));
  const copy = (value) => Promise.resolve(structuredClone(value));
  const report = () => ({ eventId: event.eventId, name: event.name, generatedAt: new Date().toISOString(), ticketTypes: types.map((t) => ({ ...t, issued: t.issuedCount, reserved: 0, refunded: 0, voided: 0, guests: 0, checkedIn: Math.floor(t.issuedCount * .93), revenueCents: t.issuedCount * t.priceCents })), totals: { ticketsIssued: types.reduce((sum, t) => sum + t.issuedCount, 0), guestTickets: tickets.filter((t) => t.source === 'GUEST').length, checkedIn: 3210, noShow: 218, collectedCents: 128450000000, netRevenueCents: 128450000000, refundedCents: 0, couponDiscountCents: 450000000 } });
  const id = () => crypto.randomUUID();
  return {
    workspace: () => copy({ event, report: report() }),
    update: (_id, body) => { Object.assign(event, body); return copy(event); },
    ticketTypes: () => copy(types),
    createTicketType: (_id, body) => { const row = { ...body, ticketTypeId: id(), issuedCount: 0, remaining: body.quota }; types.push(row); return copy(row); },
    coupons: () => copy(coupons),
    createCoupon: (_id, body) => {
      if (coupons.some((c) => c.code === body.code)) return Promise.reject(new Error('Mã giảm giá đã tồn tại.'));
      const row = { ...body, couponId: id(), active: true, redeemedCount: 0 }; coupons.push(row); return copy(row);
    },
    setCouponActive: (_id, couponId, active) => { const row = coupons.find((c) => c.couponId === couponId); row.active = active; return copy(row); },
    inviteGuests: (_id, body) => {
      const type = types.find((t) => t.ticketTypeId === body.ticketTypeId);
      if (body.guests.length > type.remaining) return Promise.reject(new Error('Không đủ quota để phát vé cho toàn bộ danh sách.'));
      const issued = body.guests.map((g) => ({ ticketId: id(), ticketTypeId: type.ticketTypeId, holderName: g.name, holderEmail: g.email, status: 'ISSUED', source: 'GUEST', issuedAt: new Date().toISOString() }));
      tickets.unshift(...issued); type.issuedCount += issued.length; type.remaining -= issued.length; return copy(issued);
    },
    tickets: (_id, page) => copy({ content: tickets.slice(page * 20, page * 20 + 20), totalPages: Math.ceil(tickets.length / 20), totalElements: tickets.length, number: page }),
    updateTicketStatus: (ticketId, body) => { const row = tickets.find((t) => t.ticketId === ticketId); Object.assign(row, { status: body.status, statusReason: body.reason }); return copy(row); },
    devices: () => copy(devices),
    createDevice: (_id, label) => { const row = { deviceId: id(), label, status: 'ACTIVE', createdAt: new Date().toISOString() }; devices.push(row); return copy({ ...row, apiKey: `preview-only-${id()}` }); },
    revokeDevice: (deviceId) => { const row = devices.find((d) => d.deviceId === deviceId); row.status = 'REVOKED'; row.revokedAt = new Date().toISOString(); return copy(row); },
    live: () => copy({ stats: { totalIssued: 3428, acceptedCount: 3210, duplicateCount: 28, deviceRejectedCount: 3, invalidCount: 12 }, timeline: [120, 185, 150, 280, 420, 370, 230].map((accepted, i) => ({ bucketStart: `2026-12-25T${String(8 + Math.floor(i / 4)).padStart(2, '0')}:${String(i % 4 * 15).padStart(2, '0')}:00Z`, accepted, duplicate: i + 1, rejected: i % 3 })) }),
    exportCsv: (_id, kind) => copy(new Blob([`\uFEFFpreview,type\r\ntrue,${kind}\r\n`], { type: 'text/csv;charset=utf-8' })),
  };
}
