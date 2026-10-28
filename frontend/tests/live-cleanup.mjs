import fs from 'node:fs';
import { request } from '@playwright/test';

export default async function cleanup() {
  const path = 'tmp/live-fixtures.private.json';
  if (!fs.existsSync(path)) return;
  const saved = JSON.parse(fs.readFileSync(path, 'utf8'));
  const api = await request.newContext();
  const results = [];
  async function update(kind, id, port, apiPath, body) {
    const response = await api.patch(`http://localhost:${port}${apiPath}`, {
      headers: { Authorization: `Bearer ${saved.admin.accessToken}`, 'Content-Type': 'application/json' }, ...(body ? { data: body } : {}),
    });
    results.push({ kind, id, status: response.status() });
  }
  for (const id of [saved.device?.deviceId, ...saved.extraDevices].filter(Boolean)) await update('device', id, 8091, `/api/checkin/devices/${id}/revoke`);
  for (const id of [saved.event?.eventId, ...saved.extraEvents].filter(Boolean)) await update('event', id, 8091, `/api/event/${id}`, { status: 'CANCELLED' });
  for (const account of [saved.buyer, saved.organizer, ...(saved.extraUsers || [])].filter(Boolean)) await update('test-user', account.user.id, 8087, `/api/user/admin/users/${account.user.id}/status`, { status: 'LOCKED' });
  fs.writeFileSync('tmp/live-audit.json', JSON.stringify({ prefix: saved.prefix, eventId: saved.event?.eventId, testUserIds: [saved.buyer?.user.id, saved.organizer?.user.id], findings: fs.existsSync('tmp/live-findings.json') ? JSON.parse(fs.readFileSync('tmp/live-findings.json', 'utf8')) : [], cleanup: results }, null, 2));
  fs.unlinkSync(path);
  await api.dispose();
  if (results.some((result) => result.status >= 300)) console.warn('Some QA fixtures could not be cleaned up; inspect tmp/live-audit.json.');
}
