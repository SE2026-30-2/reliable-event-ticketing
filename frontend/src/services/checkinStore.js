const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('eventhub-checkin', 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('scans', { keyPath: 'idempotencyKey' });
    request.result.createObjectStore('settings');
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Không mở được bộ nhớ ngoại tuyến. Hãy cho phép lưu dữ liệu trình duyệt.'));
});

async function operation(store, mode, run) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = run(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Không lưu được lượt quét.'));
  });
}
export const readScans = () => operation('scans', 'readonly', (s) => s.getAll());
export const saveScan = (scan) => operation('scans', 'readwrite', (s) => s.put(scan));
export const readSetting = (key) => operation('settings', 'readonly', (s) => s.get(key));
export const saveSetting = (key, value) => operation('settings', 'readwrite', (s) => s.put(value, key));
