import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyOffline } from '../src/services/checkinCrypto.js';

const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwks = { keys: [{ ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'test-key' }] };
const now = Math.floor(Date.now() / 1000);
const claims = { tid: crypto.randomUUID(), eid: crypto.randomUUID(), tt: crypto.randomUUID(), vf: now - 60, vu: now + 600, me: 2 };
async function sign(data) {
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(encoded));
  return `test-key.${encoded}.${Buffer.from(signature).toString('base64url')}`;
}
test('verifies the backend compact QR format and multi-entry claims', async () => {
  const result = await verifyOffline(await sign(claims), jwks);
  assert.equal(result.outcome, 'ACCEPTED'); assert.equal(result.maxEntries, 2); assert.equal(result.ticketId, claims.tid);
});
test('rejects tampered payloads and invalid signatures', async () => {
  const token = await sign(claims);
  const parts = token.split('.'); parts[1] = Buffer.from(JSON.stringify({ ...claims, me: 99 })).toString('base64url');
  assert.equal((await verifyOffline(parts.join('.'), jwks)).outcome, 'INVALID_SIGNATURE');
  assert.equal((await verifyOffline('not-a-ticket', jwks)).outcome, 'INVALID_SIGNATURE');
});
test('unknown signing keys remain pending instead of granting entry', async () => {
  assert.equal((await verifyOffline(await sign(claims), { keys: [] })).outcome, 'PENDING');
});
test('checks both validity boundaries and event binding', async () => {
  assert.equal((await verifyOffline(await sign({ ...claims, vu: now - 1 }), jwks)).outcome, 'EXPIRED_WINDOW');
  assert.equal((await verifyOffline(await sign({ ...claims, vf: now + 60 }), jwks)).outcome, 'EXPIRED_WINDOW');
  assert.equal((await verifyOffline(await sign(claims), jwks, crypto.randomUUID())).outcome, 'WRONG_EVENT');
});
test('malformed signed claims cannot grant entry', async () => {
  assert.equal((await verifyOffline(await sign({ ...claims, tid: '', vf: null }), jwks)).outcome, 'INVALID_SIGNATURE');
});
