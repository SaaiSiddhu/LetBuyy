// Concrete private-original storage execution. No processing or publication.
// No bucket IAM/privacy decision is inferred from object metadata.
// Gateway must validate its approved private binding/profile and current actor,
// persisted intent/lease before calling. This adapter cannot inspect bucket IAM.
export interface OriginalIntent {
  siteId: string; intentId: string; objectNonce: string; profileDigest: string;
  bytes: number; sha256: string; contentType: 'video/mp4' | 'video/webm';
  // Null until first canonical completion. Afterwards the exact upload version
  // is mandatory on every recovery; it is not an addressable historical object.
  expectedVersion: string | null;
}
export interface TransferBudget { maxBytes: number; maxWallMs: number }
export interface StoredObject {
  key: string; version: string; etag: string; size: number;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
  checksums: { sha256?: ArrayBuffer };
}
export interface StoredBody extends StoredObject { body: ReadableStream<Uint8Array> }
export interface PrivateR2Binding {
  head(key: string): Promise<StoredObject | null>;
  get(key: string, options: { onlyIf: Headers }): Promise<StoredBody | StoredObject | null>;
  put(key: string, value: ReadableStream<Uint8Array>, options: {
    onlyIf: Headers; sha256: ArrayBuffer;
    httpMetadata: { contentType: string; cacheControl: string };
    customMetadata: Record<string, string>;
  }): Promise<StoredObject | null>;
}
export interface VerifiedOriginal {
  verificationScope: 'r2-private-original-bytes-v1'; key: string;
  objectVersion: string; actualBytes: number; actualSha256: string;
  signatureConsistentContentType: 'video/mp4' | 'video/webm';
  profileDigest: string; // approval/privacy evidence remains a Gateway concern
}
type Digest = WritableStream<Uint8Array> & { digest: Promise<ArrayBuffer> };
type Native = { FixedLengthStream?: new (length: number) => {
  readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array>;
} };
const CHUNK_BYTES = 64 * 1024, PREFIX_BYTES = 64; // implementation memory sizes
function fail(code: string): never { throw new Error(code); }
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), b => b.toString(16).padStart(2, '0')).join('');
const unhex = (value: string) => Uint8Array.from(value.match(/../g)!, pair => Number.parseInt(pair, 16)).buffer;
export function privateOriginalRuntimeAvailable(): boolean {
  return typeof crypto !== 'undefined'
    && typeof (crypto as unknown as { DigestStream?: unknown }).DigestStream === 'function'
    && typeof (globalThis as unknown as Native).FixedLengthStream === 'function';
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function originalKey(i: OriginalIntent): string {
  if (![i.siteId, i.intentId, i.objectNonce].every(x => uuid.test(x))) fail('PRIVATE_R2_INTENT_INVALID');
  return `private-reel-originals/${i.siteId}/${i.intentId}/${i.objectNonce}`;
}
function metadata(i: OriginalIntent) {
  return { site_id: i.siteId, intent_id: i.intentId, object_nonce: i.objectNonce, profile_digest: i.profileDigest, expected_sha256: i.sha256 };
}
function validate(i: OriginalIntent, budget: TransferBudget) {
  originalKey(i);
  if (!/^[a-f0-9]{64}$/.test(i.sha256) || !/^[a-f0-9]{64}$/.test(i.profileDigest)
    || !Number.isSafeInteger(i.bytes) || i.bytes < 16
    || !Number.isSafeInteger(budget.maxBytes) || i.bytes > budget.maxBytes
    || !Number.isSafeInteger(budget.maxWallMs) || budget.maxWallMs <= 0
    || !['video/mp4', 'video/webm'].includes(i.contentType)) fail('PRIVATE_R2_LIMIT_OR_INTENT_INVALID');
}
function container(prefix: Uint8Array, expected: OriginalIntent) {
  const mp4 = prefix.length >= 16 && String.fromCharCode(...prefix.slice(4, 8)) === 'ftyp'
    && new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength).getUint32(0) >= 16
    && new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength).getUint32(0) <= expected.bytes
    && ['isom','iso2','iso5','iso6','mp41','mp42','avc1'].includes(String.fromCharCode(...prefix.slice(8,12)));
  const docType = [0x42,0x82,0x84,0x77,0x65,0x62,0x6d];
  const webm = prefix.length >= 11 && [0x1a,0x45,0xdf,0xa3].every((b,n)=>prefix[n]===b)
    && prefix.some((_,offset)=>docType.every((b,n)=>prefix[offset+n]===b));
  if (!(expected.contentType === 'video/mp4' ? mp4 : webm)) fail('PRIVATE_R2_CONTAINER_MISMATCH');
  // Prefix consistency is an intake filter only: no codec, duration, complete
  // container validity, malware, rights, managed processing or playback claim.
}
function assertObject(o: StoredObject, i: OriginalIntent, version?: string) {
  if (o.key !== originalKey(i) || !o.version || o.size !== i.bytes
    || (version && o.version !== version) || (i.expectedVersion && o.version !== i.expectedVersion)
    || o.httpMetadata?.contentType !== i.contentType
    || !o.checksums?.sha256 || hex(o.checksums.sha256) !== i.sha256
    || Object.entries(metadata(i)).some(([k, v]) => o.customMetadata?.[k] !== v)) fail('PRIVATE_R2_OBJECT_MISMATCH');
}
function digestStream(): Digest {
  const Constructor = (crypto as unknown as { DigestStream?: new (name: string) => Digest }).DigestStream;
  if (!Constructor) fail('PRIVATE_R2_NATIVE_DIGEST_UNAVAILABLE');
  return new Constructor('SHA-256');
}
function scope(budget: TransferBudget, parent?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('PRIVATE_R2_TRANSFER_ABORTED'));
  const timer = setTimeout(abort, budget.maxWallMs);
  parent?.addEventListener('abort', abort, { once: true });
  if (parent?.aborted) abort();
  return { signal: controller.signal, abort,
    close() { clearTimeout(timer); parent?.removeEventListener('abort', abort); } };
}
function timed<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void promise.catch(() => undefined); return Promise.reject(new Error('PRIVATE_R2_TRANSFER_ABORTED')); }
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('PRIVATE_R2_TRANSFER_ABORTED'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
async function consume(body: ReadableStream<Uint8Array>, i: OriginalIntent, signal: AbortSignal, sink?: WritableStreamDefaultWriter<Uint8Array>) {
  // Fail closed without the native bounded reader. No whole-body fallback.
  const digest = digestStream(), hash = digest.getWriter();
  const digestOutcome = digest.digest.then(value => ({ value }), error => ({ error }));
  let reader: ReadableStreamBYOBReader;
  try { reader = body.getReader({ mode: 'byob' }); }
  catch { await hash.abort('PRIVATE_R2_BYOB_UNAVAILABLE').catch(() => undefined); hash.releaseLock(); void body.cancel().catch(() => undefined); fail('PRIVATE_R2_BYOB_UNAVAILABLE'); }
  const prefix = new Uint8Array(Math.min(PREFIX_BYTES, i.bytes));
  let bytes = 0, prefixSize = 0, typeChecked = false;
  const abort = () => {
    void reader.cancel('PRIVATE_R2_TRANSFER_ABORTED').catch(() => undefined);
    void hash.abort('PRIVATE_R2_TRANSFER_ABORTED').catch(() => undefined);
    if (sink) void sink.abort('PRIVATE_R2_TRANSFER_ABORTED').catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) fail('PRIVATE_R2_TRANSFER_ABORTED');
      const { done, value } = await timed(reader.read(new Uint8Array(CHUNK_BYTES)), signal);
      if (value?.byteLength) {
        bytes += value.byteLength;
        if (bytes > i.bytes) fail('PRIVATE_R2_TOO_MANY_BYTES');
        await timed(hash.write(value), signal);
        let offset = 0;
        if (!typeChecked) {
          const count = Math.min(prefix.length - prefixSize, value.length);
          prefix.set(value.subarray(0, count), prefixSize); prefixSize += count; offset = count;
          if (prefixSize === prefix.length) {
            container(prefix, i); typeChecked = true;
            if (sink) await timed(sink.write(prefix), signal);
          }
        }
        if (typeChecked && offset < value.length && sink) await timed(sink.write(value.subarray(offset)), signal);
      }
      if (done) break;
    }
    if (bytes !== i.bytes || !typeChecked) fail('PRIVATE_R2_TRUNCATED');
    await timed(hash.close(), signal);
    const outcome = await timed(digestOutcome, signal);
    if ('error' in outcome) fail('PRIVATE_R2_DIGEST_FAILED');
    const measured = hex(outcome.value);
    if (measured !== i.sha256) fail('PRIVATE_R2_CHECKSUM_MISMATCH');
    if (sink) await timed(sink.close(), signal);
    return { bytes, sha256: measured };
  } catch (error) { abort(); throw error; }
  finally { signal.removeEventListener('abort', abort); reader.releaseLock(); hash.releaseLock(); }
}
async function verify(bucket: PrivateR2Binding, i: OriginalIntent, signal: AbortSignal, requiredVersion?: string): Promise<VerifiedOriginal> {
  const before = await timed(bucket.head(originalKey(i)), signal);
  if (!before) fail('PRIVATE_R2_OBJECT_MISSING');
  assertObject(before, i, requiredVersion);
  const object = await timed(bucket.get(originalKey(i), { onlyIf: new Headers({ 'If-Match': '"' + before.etag + '"' }) }), signal);
  if (!object || !('body' in object) || !object.body) fail('PRIVATE_R2_READ_PRECONDITION_FAILED');
  try { assertObject(object, i, before.version); }
  catch (error) { void object.body.cancel().catch(() => undefined); throw error; }
  const measured = await consume(object.body, i, signal);
  const after = await timed(bucket.head(originalKey(i)), signal);
  if (!after) fail('PRIVATE_R2_OBJECT_MISSING');
  assertObject(after, i, before.version);
  return { verificationScope: 'r2-private-original-bytes-v1', key: originalKey(i), objectVersion: before.version,
    actualBytes: measured.bytes, actualSha256: measured.sha256,
    signatureConsistentContentType: i.contentType, profileDigest: i.profileDigest };
}
export async function inspectPrivateOriginal(bucket: PrivateR2Binding, i: OriginalIntent, budget: TransferBudget, parent?: AbortSignal) {
  validate(i, budget); const op = scope(budget, parent);
  try { return await verify(bucket, i, op.signal); } finally { op.abort(); op.close(); }
}
export async function transferPrivateOriginal(bucket: PrivateR2Binding, i: OriginalIntent, body: ReadableStream<Uint8Array>, budget: TransferBudget, parent?: AbortSignal) {
  validate(i, budget); const op = scope(budget, parent);
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  const pumping = new AbortController();
  const abortPump = () => pumping.abort(new Error('PRIVATE_R2_TRANSFER_ABORTED'));
  op.signal.addEventListener('abort', abortPump, { once: true });
  try {
    if (typeof (crypto as unknown as { DigestStream?: unknown }).DigestStream !== 'function') fail('PRIVATE_R2_NATIVE_DIGEST_UNAVAILABLE');
    if (await timed(bucket.head(originalKey(i)), op.signal)) {
      void body.cancel('PRIVATE_R2_RECOVER_EXISTING').catch(() => undefined);
      return await verify(bucket, i, op.signal);
    }
    const Fixed = (globalThis as unknown as Native).FixedLengthStream;
    if (!Fixed) fail('PRIVATE_R2_NATIVE_FIXED_LENGTH_UNAVAILABLE');
    const fixed = new Fixed(i.bytes); writer = fixed.writable.getWriter();
    const put = bucket.put(originalKey(i), fixed.readable, { onlyIf: new Headers({ 'If-None-Match': '*' }),
      sha256: unhex(i.sha256), httpMetadata: { contentType: i.contentType, cacheControl: 'private, no-store' }, customMetadata: metadata(i) });
    // Start both concurrently; a failed condition may return without reading
    // the body. Cancel only this pump, then verify the winning existing object.
    void put.then(stored => { if (!stored) abortPump(); }, abortPump);
    const pump = consume(body, i, pumping.signal, writer).then(value => ({ value }), error => ({ error }));
    const stored = await timed(put, op.signal);
    if (stored) {
      const outcome = await timed(pump, op.signal);
      if ('error' in outcome) throw outcome.error;
    } else { abortPump(); await timed(pump, op.signal); }
    if (stored) assertObject(stored, i);
    // null is a conditional-create race, never permission to overwrite.
    return await verify(bucket, i, op.signal, stored?.version);
  } finally {
    op.abort(); op.close(); op.signal.removeEventListener('abort', abortPump);
    if (writer) { const release = writer; void release.abort('PRIVATE_R2_FINISHED').catch(() => undefined).finally(() => release.releaseLock()); }
    // Timeout/abort means remote outcome may be unknown: never delete, release
    // the intent's storage charge, generate a new key, or mint custody here.
    // A later live-authorized retry HEADs and fully rehashes this SAME key.
  }
}
