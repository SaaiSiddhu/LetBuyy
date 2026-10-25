// Owned manual fixture only. No browser state access, journal, provider or alternate checkout.
import { createHash } from 'node:crypto';
import { CheckoutContactSchema, CheckoutDeliverySchema, CheckoutPaymentIntentSchema, CheckoutConfirmSchema } from '@letbuyy/checkout-core';
import { UuidSchema } from '@letbuyy/shared-types';
import type { Gateway, GatewayResponse } from './gateway-harness';
import type { OwnedDatabase } from './owned-db-support';

const MAX_RECORDS = 32, MAX_FAILED_REQUESTS = 128, MAX_BODY_BYTES = 4096, MAX_REPLAYS = 3;
const PROOF = '/__threadline_proof';
export const EDITOR_CONFIRM_REPLAY_PATH = '/__threadline_editor_replay_confirm';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const uuid = (value: unknown): string | null => { const parsed = UuidSchema.safeParse(value); return parsed.success ? parsed.data : null; };

class ObservationError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
type PrivateConfirm = { path: string; body: string; headers: Headers; cartId: string; orderId: string;
  commandSha256: string; responseSha256: string; requestId: string | null; status: number; replays: number };
type CaptureInput = { method: string; path: string; body: string; headers: Headers; response: GatewayResponse };
type FailedRequest = { operation: 'cart-replace' | 'checkout-contact' | 'checkout-delivery' | 'checkout-payment-intent' | 'checkout-confirm'; cartId: string; status: number;
  responseCode: string | null; requestId: string | null; commandSha256: string; responseSha256: string };
const FAILURE_CODES = new Set(['INSUFFICIENT_INVENTORY', 'VARIANT_REQUIRED', 'VARIANT_NOT_FOUND', 'PRODUCT_NOT_FOUND',
  'VALIDATION', 'VALIDATION_ERROR', 'NOT_FOUND', 'CONFLICT', 'UNAUTHORIZED', 'FORBIDDEN',
  'CHECKOUT_STATE_CONFLICT', 'CHECKOUT_PRODUCT_CHANGED', 'CHECKOUT_PAYMENT_INTENT_MISMATCH', 'CHECKOUT_UNAVAILABLE', 'INTERNAL_ERROR']);
// Same character/length envelope as the canonical public route normalizer. No percent-decoding or SQL syntax.
const routeToken = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,120}$/.test(normalized) ? normalized : null;
};
const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`;

function localPath(path: string): URL | null {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('#')) return null;
  try { const parsed = new URL(path, 'http://fixture.invalid'); return parsed.origin === 'http://fixture.invalid' && parsed.pathname === path.split('?')[0] ? parsed : null; } catch { return null; }
}
function orderId(response: GatewayResponse): string | null {
  if (response.status < 200 || response.status >= 300) return null;
  const data = record(record(response.json as unknown).data);
  return uuid(record(data.order).id) || uuid(record(data.checkout).order_id);
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new ObservationError(503, 'PROOF_UNAVAILABLE');
  return value;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new ObservationError(503, 'PROOF_UNAVAILABLE');
  return value;
}

export class ThemeEditorFixtureObservation {
  #siteId: string;
  #nonce: string;
  #owned: Pick<OwnedDatabase, 'psql'>;
  #gateway: Pick<Gateway, 'request'>;
  #records: PrivateConfirm[] = [];
  #captureFailures = 0;
  #failedRequests: FailedRequest[] = [];
  #failedCaptureFailures = 0;
  #busy = false;

  constructor(input: { profile: string; siteId: string; nonce: string; owned: Pick<OwnedDatabase, 'psql'>; gateway: Pick<Gateway, 'request'> }) {
    if (input.profile !== 'editor' || !uuid(input.siteId) || !uuid(input.nonce)) throw new ObservationError(403, 'EDITOR_PROFILE_REQUIRED');
    this.#siteId = input.siteId; this.#nonce = input.nonce; this.#owned = input.owned; this.#gateway = input.gateway;
  }

  #ownsConfirmation(cartId: string, selectedOrder: string): boolean {
    return this.#owned.psql(`SELECT EXISTS(SELECT 1 FROM checkout_sessions s JOIN carts c ON c.id=s.cart_id AND c.store_id=s.site_id JOIN orders o ON o.id=s.order_id AND o.store_id=s.site_id WHERE s.site_id='${this.#siteId}' AND s.cart_id='${cartId}' AND s.order_id='${selectedOrder}' AND s.deleted_at IS NULL AND o.payment_method='cod');`) === 't';
  }

  /** Diagnostics have no command/header storage and are never replay candidates. */
  #captureFailed(input: CaptureInput, parsed: URL | null): void {
    if (!parsed) return;
    const checkoutStep = parsed.pathname.match(/^\/v1\/checkout\/([a-f0-9-]{36})\/(contact|delivery|payment-intent|confirm)$/i);
    const replace = parsed.pathname.match(/^\/v1\/storefront\/([^/]+)\/cart(?:\/([^/]+))?$/);
    const isCheckoutStep = input.method === 'POST' && checkoutStep && uuid(checkoutStep[1]);
    const isReplace = replace && !parsed.search && (input.method === 'PATCH' && replace[2] || input.method === 'POST' && !replace[2]);
    if (!isCheckoutStep && !isReplace) return;
    try {
      if (Buffer.byteLength(input.body) > MAX_BODY_BYTES || Buffer.byteLength(input.response.text) > MAX_BODY_BYTES) {
        throw new ObservationError(413, 'CAPTURE_LIMIT');
      }
      let operation: FailedRequest['operation'], where: string;
      if (isCheckoutStep && checkoutStep) {
        if (checkoutStep[2] !== 'confirm') {
          const keys = [...parsed.searchParams.keys()];
          const permitted = ['site_id', 'cart_token', 'expires_at', 'cart_digest', 'signature', 'channel'];
          if (keys.some(key => !permitted.includes(key)) || new Set(keys).size !== keys.length) return;
        }
        const sites = parsed.searchParams.getAll('site_id');
        if (sites.length !== 1 || uuid(sites[0]) !== this.#siteId) return;
        const body: unknown = JSON.parse(input.body);
        if (checkoutStep[2] === 'contact') { CheckoutContactSchema.parse(body); operation = 'checkout-contact'; }
        else if (checkoutStep[2] === 'delivery') { CheckoutDeliverySchema.parse(body); operation = 'checkout-delivery'; }
        else if (checkoutStep[2] === 'payment-intent') { CheckoutPaymentIntentSchema.parse(body); operation = 'checkout-payment-intent'; }
        else { CheckoutConfirmSchema.parse(body); operation = 'checkout-confirm'; }
        where = `c.id=${sqlText(checkoutStep[1])}`;
      } else if (isReplace && replace) {
        const subdomain = routeToken(replace[1]);
        const rawToken: unknown = replace[2] ?? record(JSON.parse(input.body)).cart_token;
        const token = typeof rawToken === 'string' ? routeToken(rawToken) : null;
        if (!subdomain || !token) return;
        operation = 'cart-replace';
        where = `c.session_id=${sqlText(token)} AND s.subdomain=${sqlText(subdomain)}`;
      } else return;
      if (this.#failedRequests.length >= MAX_FAILED_REQUESTS) throw new ObservationError(413, 'CAPTURE_LIMIT');
      // psql has no parameter API. All values above pass canonical UUID/route-token validation and are quoted.
      const cartId = uuid(this.#owned.psql(`SELECT c.id::text FROM public.carts c JOIN public.sites s ON s.id=c.store_id WHERE c.store_id=${sqlText(this.#siteId)} AND ${where} AND c.deleted_at IS NULL LIMIT 1;`));
      if (!cartId) return;
      const code = record(record(input.response.json as unknown).error).code;
      this.#failedRequests.push({ operation, cartId, status: input.response.status,
        responseCode: typeof code === 'string' && FAILURE_CODES.has(code) ? code : null,
        requestId: uuid(input.response.headers.get('X-Request-ID')),
        commandSha256: digest(input.method + '\n' + input.path + '\n' + input.body), responseSha256: digest(input.response.text) });
    } catch { this.#failedCaptureFailures++; }
  }

  /** Called only after the real Gateway completes. Observation cannot change its acknowledgement. */
  capture(input: CaptureInput): void {
    const parsed = localPath(input.path), match = parsed?.pathname.match(/^\/v1\/checkout\/([a-f0-9-]{36})\/confirm$/i);
    if (Number.isInteger(input.response.status) && input.response.status >= 400 && input.response.status <= 599) {
      this.#captureFailed(input, parsed); return;
    }
    if (input.method !== 'POST' || !match || !uuid(match[1]) || input.response.status < 200 || input.response.status >= 300) return;
    try {
      if (Buffer.byteLength(input.body) > MAX_BODY_BYTES) throw new ObservationError(413, 'CAPTURE_LIMIT');
      if ([...input.headers].reduce((bytes, [key, value]) => bytes + Buffer.byteLength(key) + Buffer.byteLength(value), 0) > 16384) throw new ObservationError(413, 'CAPTURE_LIMIT');
      CheckoutConfirmSchema.parse(JSON.parse(input.body));
      const selectedOrder = orderId(input.response);
      if (!selectedOrder || !this.#ownsConfirmation(match[1], selectedOrder)) throw new ObservationError(404, 'CONFIRM_NOT_OWNED');
      const commandSha256 = digest('POST\n' + input.path + '\n' + input.body);
      if (this.#records.some(item => item.commandSha256 === commandSha256 && item.orderId === selectedOrder)) return;
      if (this.#records.length >= MAX_RECORDS) throw new ObservationError(413, 'CAPTURE_LIMIT');
      this.#records.push({ path: input.path, body: input.body, headers: new Headers(input.headers), cartId: match[1], orderId: selectedOrder,
        commandSha256, responseSha256: digest(input.response.text), requestId: uuid(input.response.headers.get('X-Request-ID')),
        status: input.response.status, replays: 0 });
    } catch { this.#captureFailures++; }
  }

  summary() {
    return { captureFailures: this.#captureFailures, failedCaptureFailures: this.#failedCaptureFailures,
      failedRequests: this.#failedRequests.map(item => ({ ...item })), records: this.#records.map((item, index) => ({ index,
      orderId: item.orderId, commandSha256: item.commandSha256, responseSha256: item.responseSha256,
      requestId: item.requestId, status: item.status, replays: item.replays })) };
  }

  #proof(selectedOrder: string | null, selectedProduct: string | null) {
    if (!selectedOrder && !selectedProduct) throw new ObservationError(400, 'PROOF_SELECTOR_REQUIRED');
    if (selectedOrder && this.#owned.psql(`SELECT EXISTS(SELECT 1 FROM orders WHERE id='${selectedOrder}' AND store_id='${this.#siteId}');`) !== 't') throw new ObservationError(404, 'PROOF_NOT_OWNED');
    if (selectedProduct && this.#owned.psql(`SELECT EXISTS(SELECT 1 FROM products WHERE id='${selectedProduct}' AND store_id='${this.#siteId}');`) !== 't') throw new ObservationError(404, 'PROOF_NOT_OWNED');
    if (selectedOrder && selectedProduct && this.#owned.psql(`SELECT EXISTS(SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.id='${selectedOrder}' AND o.store_id='${this.#siteId}' AND i.product_id='${selectedProduct}');`) !== 't') throw new ObservationError(404, 'PROOF_SELECTION_MISMATCH');
    const orderWhere = selectedOrder ? `o.id='${selectedOrder}' AND` : selectedProduct ? `i.product_id='${selectedProduct}' AND` : '';
    const productIds = selectedProduct ? `SELECT '${selectedProduct}'::uuid` : `SELECT i.product_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.id='${selectedOrder}' AND o.store_id='${this.#siteId}'`;
    const inventoryCount = Number(this.#owned.psql(`SELECT count(*) FROM inventory_levels WHERE product_id IN (${productIds});`));
    const lineCount = Number(this.#owned.psql(`SELECT count(*) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${orderWhere} o.store_id='${this.#siteId}';`));
    if (number(inventoryCount) > 200 || number(lineCount) > 1000) throw new ObservationError(413, 'PROOF_LIMIT');
    const raw = record(JSON.parse(this.#owned.psql(`SELECT jsonb_build_object(
      'siteOrderCount',(SELECT count(*) FROM orders WHERE store_id='${this.#siteId}'),
      'orderLineCount',(SELECT count(*) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${orderWhere} o.store_id='${this.#siteId}'),
      'snapshotSha256',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',i.id,'snapshot',i.product_snapshot) ORDER BY i.id),'[]'::jsonb)::text,'UTF8')),'hex') FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ${orderWhere} o.store_id='${this.#siteId}'),
      'productOrderLineCount',(SELECT count(*) FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.store_id='${this.#siteId}' AND i.product_id IN (${productIds})),
      'inventoryRows',(SELECT count(*) FROM inventory_levels WHERE product_id IN (${productIds})),
      'inventorySha256',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(il) ORDER BY il.id),'[]'::jsonb)::text,'UTF8')),'hex') FROM inventory_levels il WHERE il.product_id IN (${productIds})),
      'inventoryEventCount',(SELECT count(*) FROM inventory_events WHERE product_id IN (${productIds})),
      'inventoryAdjustmentCount',(SELECT count(*) FROM inventory_adjustments WHERE product_id IN (${productIds}))
    );`)));
    const rows = number(raw.inventoryRows);
    if (rows > 200) throw new ObservationError(413, 'PROOF_LIMIT');
    return { orderId: selectedOrder, productId: selectedProduct, siteOrderCount: number(raw.siteOrderCount),
      orderLineCount: number(raw.orderLineCount), snapshotSha256: hash(raw.snapshotSha256), productOrderLineCount: number(raw.productOrderLineCount),
      inventoryRows: rows, inventorySha256: hash(raw.inventorySha256), inventoryEventCount: number(raw.inventoryEventCount),
      inventoryAdjustmentCount: number(raw.inventoryAdjustmentCount) };
  }

  /** Finite private controls. Null means the ordinary fixture bridge handles this path. */
  async control(input: { method: string; path: string; nonce?: string; body: string }): Promise<{ status: number; body: unknown } | null> {
    const parsed = localPath(input.path);
    if (!parsed || ![PROOF, EDITOR_CONFIRM_REPLAY_PATH].includes(parsed.pathname)) return null;
    try {
      if (input.nonce !== this.#nonce) throw new ObservationError(403, 'FIXTURE_CONTROL_REQUIRED');
      if (parsed.pathname === PROOF) {
        if (input.method !== 'GET' || input.body) throw new ObservationError(405, 'METHOD_NOT_ALLOWED');
        if (!parsed.search) return { status: 200, body: { editorObservations: this.summary() } };
        const keys = [...parsed.searchParams.keys()];
        if (keys.some(key => !['order_id','product_id'].includes(key)) || new Set(keys).size !== keys.length) throw new ObservationError(400, 'INVALID_PROOF_SELECTOR');
        const selectedOrder = parsed.searchParams.has('order_id') ? uuid(parsed.searchParams.get('order_id')) : null;
        const selectedProduct = parsed.searchParams.has('product_id') ? uuid(parsed.searchParams.get('product_id')) : null;
        if ((parsed.searchParams.has('order_id') && !selectedOrder) || (parsed.searchParams.has('product_id') && !selectedProduct)) throw new ObservationError(400, 'INVALID_PROOF_SELECTOR');
        return { status: 200, body: this.#proof(selectedOrder, selectedProduct) };
      }
      if (input.method !== 'POST') throw new ObservationError(405, 'METHOD_NOT_ALLOWED');
      if (parsed.search || Buffer.byteLength(input.body) > 128) throw new ObservationError(400, 'INVALID_REPLAY_SELECTOR');
      let parsedBody: unknown;
      try { parsedBody = JSON.parse(input.body); } catch { throw new ObservationError(400, 'INVALID_REPLAY_SELECTOR'); }
      const body = record(parsedBody);
      if (Object.keys(body).some(key => !['index', 'mode'].includes(key)) || !Object.hasOwn(body, 'index') || typeof body.index !== 'number' || !Number.isInteger(body.index) || body.index < 0 || body.index >= MAX_RECORDS
        || (Object.hasOwn(body, 'mode') && body.mode !== 'same-key-conflict')) throw new ObservationError(400, 'INVALID_REPLAY_SELECTOR');
      const conflict = body.mode === 'same-key-conflict';
      const original = this.#records[body.index];
      if (!original) throw new ObservationError(404, 'CONFIRM_NOT_RECORDED');
      if (original.replays >= MAX_REPLAYS) throw new ObservationError(429, 'REPLAY_LIMIT');
      if (this.#busy) throw new ObservationError(409, 'REPLAY_IN_PROGRESS');
      if (!this.#ownsConfirmation(original.cartId, original.orderId)) throw new ObservationError(404, 'CONFIRM_NOT_OWNED');
      this.#busy = true; original.replays++;
      try {
        let replayBody = original.body;
        if (conflict) {
          const command = CheckoutConfirmSchema.parse(JSON.parse(original.body));
          const first = 'cod_fixture_same_key_conflict_1', second = 'cod_fixture_same_key_conflict_2';
          replayBody = JSON.stringify(CheckoutConfirmSchema.parse({ ...command,
            payment_intent_id: command.payment_intent_id === first ? second : first }));
        }
        const before = this.#proof(original.orderId, null);
        const result = await this.#gateway.request(original.path, { method: 'POST', headers: new Headers(original.headers), body: replayBody });
        const after = this.#proof(original.orderId, null), selectedOrder = orderId(result);
        const errorCode = record(record(result.json as unknown).error).code;
        return { status: result.status >= 200 && result.status < 300 ? 200 : result.status, body: { index: body.index, originalOrderId: original.orderId, orderId: selectedOrder,
          commandSha256: original.commandSha256, responseSha256: digest(result.text), responseStatus: result.status,
          ...(conflict ? { mode: 'same-key-conflict', replayCommandSha256: digest('POST\n' + original.path + '\n' + replayBody),
            responseCode: typeof errorCode === 'string' && ['CONFLICT', 'CHECKOUT_PAYMENT_INTENT_MISMATCH', 'VALIDATION_ERROR', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CHECKOUT_UNAVAILABLE', 'INTERNAL_ERROR'].includes(errorCode) ? errorCode : null } : {}),
          requestId: uuid(result.headers.get('X-Request-ID')), sameOrder: selectedOrder === original.orderId,
          effectsUnchanged: JSON.stringify(before) === JSON.stringify(after), before, after } };
      } finally { this.#busy = false; }
    } catch (error) {
      return { status: error instanceof ObservationError ? error.status : 503,
        body: { error: error instanceof ObservationError ? error.code : 'FIXTURE_OBSERVATION_UNAVAILABLE' } };
    }
  }

  dispose() { this.#records.length = 0; this.#failedRequests.length = 0; }
}
