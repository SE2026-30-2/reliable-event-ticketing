const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');

export const eventName = (id, events) => !id ? 'Sử dụng cho mọi sự kiện' : events.find((event) => event.eventId === id)?.name || id;

export function filterDevices(devices, events, { query = '', scope = '', type = '', status = '' }) {
  const search = normalize(query.trim());
  return devices.filter((device) => {
    const kind = device.eventId ? 'event' : 'global';
    return (!scope || scope === kind) && (!type || type === kind) && (!status || device.status === status)
      && (!search || normalize(`${device.label} ${device.deviceId} ${eventName(device.eventId, events)}`).includes(search));
  });
}

export function withoutKey(device) {
  // Keep the one-time credential out of list state.
  const { deviceId, label, eventId, status, createdAt, revokedAt, lastSeenAt } = device;
  return { deviceId, label, eventId: eventId ?? null, status: status || 'ACTIVE', createdAt, revokedAt, lastSeenAt };
}

export function createPreviewService() {
  const events = [
    { eventId: 'demo-concert', name: 'The Dreams Concert 2026', status: 'PUBLISHED' },
    { eventId: 'demo-football', name: 'Viettel FC vs Hà Nội FC', status: 'PUBLISHED' },
    { eventId: 'demo-marathon', name: 'Hanoi Marathon 2026', status: 'DRAFT' },
  ];
  let devices = ['Cổng check-in A1', 'iPad Check-in 01', 'Máy quét QR Sân khấu', 'iPhone 15 - Team 1', 'Máy quét cầm tay 02'].map((label, i) => ({
    deviceId: `DEV_00${i + 1}`, label, eventId: [null, events[0].eventId, events[1].eventId, events[2].eventId, null][i],
    status: i === 4 ? 'REVOKED' : 'ACTIVE', createdAt: '2026-10-20T08:00:00Z',
    lastSeenAt: i === 2 ? null : '2026-10-22T07:30:00Z', revokedAt: i === 4 ? '2026-10-21T08:00:00Z' : null,
  }));
  return {
    list: async () => devices.map((item) => ({ ...item })),
    events: async () => events,
    create: async (body) => {
      const device = { ...body, deviceId: crypto.randomUUID(), status: 'ACTIVE', createdAt: new Date().toISOString(), lastSeenAt: null, revokedAt: null };
      devices = [device, ...devices];
      return { ...device, apiKey: `demo_only_${crypto.randomUUID()}` };
    },
    revoke: async (id) => {
      devices = devices.map((item) => item.deviceId === id ? { ...item, status: 'REVOKED', revokedAt: new Date().toISOString() } : item);
      return { ...devices.find((item) => item.deviceId === id) };
    },
  };
}
