import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';

test('public auth requests omit stale tokens while protected requests retain auth handling', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const storage = new Map([['access_token', 'expired-token'], ['refresh_token', 'refresh'], ['user', '{}']]);
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  let unauthorizedEvents = 0;
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window = { dispatchEvent: (event) => {
    assert.equal(event.type, 'auth:unauthorized');
    unauthorizedEvents++;
  } };

  try {
    const { userClient: client } = await server.ssrLoadModule('/src/services/axiosClient.js');
    const { authService } = await server.ssrLoadModule('/src/services/authService.js');
    const { userService } = await server.ssrLoadModule('/src/services/userService.js');
    const requests = [];
    let rejectRequest = false;
    // Even an inherited Authorization header must be removed on public requests.
    client.defaults.headers.common.Authorization = 'Bearer inherited-token';
    client.defaults.adapter = async (config) => {
      requests.push(config);
      if (rejectRequest) {
        throw { config, response: { status: 401, data: { message: 'Unauthorized' } } };
      }
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };

    await authService.login({ email: 'test@example.com', password: 'test' });
    assert.equal(requests.at(-1).url, '/api/user/login');
    assert.equal(requests.at(-1).headers.get('Authorization'), undefined);
    await authService.register({ email: 'test@example.com', password: 'test' });
    assert.equal(requests.at(-1).url, '/api/user/register');
    assert.equal(requests.at(-1).headers.get('Authorization'), undefined);

    await userService.getProfile();
    assert.equal(requests.at(-1).headers.get('Authorization'), 'Bearer expired-token');
    rejectRequest = true;
    await assert.rejects(authService.login({}), /Unauthorized/);
    assert.equal(storage.get('access_token'), 'expired-token');
    assert.equal(unauthorizedEvents, 0);
    await assert.rejects(userService.getProfile(), /Unauthorized/);
    assert.equal(storage.size, 0);
    assert.equal(unauthorizedEvents, 1);
  } finally {
    await server.close();
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
