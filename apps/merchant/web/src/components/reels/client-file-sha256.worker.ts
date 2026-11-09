// Bounded browser-only digest; no original bytes are persisted in web storage.
// The existing production policy intentionally disallows Wasm compilation.
// Keep incremental bounded reads using the already locked pure-JS digest.
import { Hash } from 'fast-sha256';
let generation = 0;
self.onmessage = async (event: MessageEvent<{ requestId: string; file: File; maxBytes: number }>) => {
  const captured = ++generation, { requestId, file, maxBytes } = event.data;
  try {
    if (!(file instanceof File) || !Number.isSafeInteger(maxBytes) || maxBytes <= 0 || file.size > maxBytes) throw new Error('UPLOAD_FILE_LIMIT');
    const hash = new Hash();
    for (let offset = 0; offset < file.size; offset += 64 * 1024) {
      if (generation !== captured) return;
      const bytes = new Uint8Array(await file.slice(offset, offset + 64 * 1024).arrayBuffer());
      hash.update(bytes);
    }
    if (generation === captured) {
      const sha256 = Array.from(hash.digest(), value => value.toString(16).padStart(2, '0')).join('');
      hash.clean();
      self.postMessage({ requestId, sha256, bytes: file.size });
    }
  } catch { if (generation === captured) self.postMessage({ requestId, error: 'UPLOAD_FILE_HASH_UNAVAILABLE' }); }
};
