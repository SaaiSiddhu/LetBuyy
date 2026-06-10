import type { Context } from 'hono';
import {
    AppFunctionRuntimeInputSchema,
    LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
    applyAppFunctionRuntimeOutput,
    createAppFunctionCheckoutDecision,
    normalizeAppFunctionRuntimeOutput,
    type AppFunctionCheckoutDecision,
    type AppFunctionCheckoutPaymentMethod,
    type AppFunctionCheckoutShippingMethod,
    type AppFunctionRuntimeInput,
    type AppFunctionRuntimeOutput,
    type LetbuyyAppFunctionHook,
} from '@letbuyy/shared-types';
import type { Env } from '../index';
import { ObservabilityExecutionAdapter } from '../execution/observability-execution.adapter';
import { getSupabaseAdmin } from '../lib/supabase';

type GatewayContext = Context<{ Bindings: Env }>;

export const LETBUYY_APP_FUNCTION_RUNTIME_VERSION = '2026-06-05.ws13.functions' as const;
export const APP_FUNCTION_EXECUTION_HOOK_ORDER: LetbuyyAppFunctionHook[] = [
    'checkout.validation.run',
    'checkout.payment.customize',
    'checkout.shipping.rate',
    'cart.discount.calculate',
];

type AppFunctionRegistrationRow = {
    id: string;
    site_id: string;
    installation_id?: string | null;
    app_id: string;
    function_handle: string;
    name?: string | null;
    hooks?: string[] | null;
    runtime: 'wasm';
    wasm_module_url: string;
    wasm_sha256: string;
    wasm_entrypoint?: string | null;
    timeout_ms?: number | string | null;
    memory_limit_kb?: number | string | null;
    input_schema?: Record<string, unknown> | null;
    output_schema?: Record<string, unknown> | null;
    config?: Record<string, unknown> | null;
    manifest_schema_version?: string | null;
    app_version?: string | null;
};

export type AppFunctionExecutionStatus = 'succeeded' | 'failed' | 'skipped';

export interface AppFunctionExecutionSummary {
    registrationId: string;
    appId: string;
    hook: LetbuyyAppFunctionHook;
    handle: string;
    status: AppFunctionExecutionStatus;
    durationMs: number;
    operations: number;
    errorCode?: string;
}

export interface CheckoutFunctionEvaluationInput {
    siteId: string;
    requestId: string;
    cart: AppFunctionRuntimeInput['cart'];
    checkout: {
        payment_method: AppFunctionCheckoutPaymentMethod;
        shipping_method: AppFunctionCheckoutShippingMethod;
        customer: Record<string, unknown>;
        shipping_address: Record<string, unknown>;
    };
    couponCode?: string | null;
}

export interface CheckoutFunctionEvaluationResult {
    decision: AppFunctionCheckoutDecision;
    executions: AppFunctionExecutionSummary[];
}

type WasmJsonExports = WebAssembly.Exports & {
    memory?: WebAssembly.Memory;
    alloc?: (size: number) => number;
    dealloc?: (ptr: number, len: number) => void;
    result_len?: () => number;
};

type WebAssemblyCompiler = typeof WebAssembly & {
    compile(bytes: BufferSource): Promise<WebAssembly.Module>;
};

const WASM_PAGE_BYTES = 64 * 1024;
const MAX_APP_FUNCTION_WASM_BYTES = 128 * 1024;
const MAX_APP_FUNCTION_CODE_BODY_BYTES = 4 * 1024;
const wasmModuleCache = new Map<string, Promise<WebAssembly.Module>>();

function isMissingTableError(error: { message?: string; details?: string; hint?: string } | null | undefined, tableName: string): boolean {
    const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('not found')
    );
}

function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

function timeoutError(message: string): Error {
    const error = new Error(message);
    error.name = 'APP_FUNCTION_TIMEOUT';
    return error;
}

function resourceLimitError(message: string): Error {
    const error = new Error(message);
    error.name = 'APP_FUNCTION_RESOURCE_LIMIT';
    return error;
}

async function withTimeout<T>(work: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(timeoutError(`${label} exceeded ${timeoutMs}ms`)), timeoutMs);
    });

    try {
        return await Promise.race([work, timer]);
    } finally {
        if (timeout) clearTimeout(timeout);
    }
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return bytesToHex(new Uint8Array(digest));
}

function readVarUint32(bytes: Uint8Array, offset: number): { value: number; offset: number } {
    let value = 0;
    let shift = 0;
    let cursor = offset;
    while (cursor < bytes.length) {
        const byte = bytes[cursor];
        cursor += 1;
        value |= (byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) return { value, offset: cursor };
        shift += 7;
        if (shift > 35) break;
    }
    throw resourceLimitError('Function module has invalid LEB128 encoding');
}

function skipVarInt(bytes: Uint8Array, offset: number): number {
    return readVarUint32(bytes, offset).offset;
}

function skipBlockType(bytes: Uint8Array, offset: number): number {
    const byte = bytes[offset];
    if (byte === undefined) throw resourceLimitError('Function module has invalid block type');
    if (byte === 0x40 || (byte >= 0x7b && byte <= 0x7f)) return offset + 1;
    return skipVarInt(bytes, offset);
}

function scanWasmInstructionBudget(bytes: Uint8Array, start: number, end: number, handle: string): void {
    let cursor = start;
    while (cursor < end) {
        const opcode = bytes[cursor];
        cursor += 1;

        switch (opcode) {
            case 0x02:
            case 0x04:
                cursor = skipBlockType(bytes, cursor);
                break;
            case 0x03:
            case 0x0c:
            case 0x0d:
            case 0x0e:
                throw resourceLimitError(`Function ${handle} uses loop or branch control flow outside the checkout instruction budget`);
            case 0x10:
            case 0x11:
            case 0x12:
            case 0x13:
            case 0x14:
            case 0x15:
                throw resourceLimitError(`Function ${handle} uses Wasm calls outside the checkout instruction budget`);
            case 0x20:
            case 0x21:
            case 0x22:
            case 0x23:
            case 0x24:
            case 0x41:
                cursor = skipVarInt(bytes, cursor);
                break;
            case 0x42:
                cursor = skipVarInt(bytes, cursor);
                break;
            case 0x43:
                cursor += 4;
                break;
            case 0x44:
                cursor += 8;
                break;
            case 0x28:
            case 0x29:
            case 0x2a:
            case 0x2b:
            case 0x2c:
            case 0x2d:
            case 0x2e:
            case 0x2f:
            case 0x30:
            case 0x31:
            case 0x32:
            case 0x33:
            case 0x34:
            case 0x35:
            case 0x36:
            case 0x37:
            case 0x38:
            case 0x39:
            case 0x3a:
            case 0x3b:
            case 0x3c:
            case 0x3d:
            case 0x3e:
                cursor = skipVarInt(bytes, skipVarInt(bytes, cursor));
                break;
            case 0x3f:
                cursor += 1;
                break;
            case 0x40:
                throw resourceLimitError(`Function ${handle} may not use memory.grow during checkout`);
            case 0xfb:
            case 0xfc:
            case 0xfd:
            case 0xfe:
                throw resourceLimitError(`Function ${handle} uses prefixed Wasm instructions outside the checkout instruction budget`);
            default:
                break;
        }

        if (cursor > end) {
            throw resourceLimitError(`Function ${handle} has invalid Wasm instruction immediates`);
        }
    }
}

export function appFunctionMemoryLimitBytes(registration: { memory_limit_kb?: number | string | null }): number {
    return positiveInt(registration.memory_limit_kb, 512, 64, 1024) * 1024;
}

export function validateWasmModuleLimits(
    bytes: Uint8Array,
    registration: { function_handle?: string | null; memory_limit_kb?: number | string | null },
): void {
    const handle = registration.function_handle || 'unknown';
    const memoryLimitBytes = appFunctionMemoryLimitBytes(registration);
    const memoryLimitPages = Math.floor(memoryLimitBytes / WASM_PAGE_BYTES);

    if (bytes.byteLength > MAX_APP_FUNCTION_WASM_BYTES) {
        throw resourceLimitError(`Function ${handle} module exceeds ${MAX_APP_FUNCTION_WASM_BYTES} bytes`);
    }
    if (
        bytes[0] !== 0x00 ||
        bytes[1] !== 0x61 ||
        bytes[2] !== 0x73 ||
        bytes[3] !== 0x6d ||
        bytes[4] !== 0x01 ||
        bytes[5] !== 0x00 ||
        bytes[6] !== 0x00 ||
        bytes[7] !== 0x00
    ) {
        throw resourceLimitError(`Function ${handle} is not a valid Wasm module`);
    }

    let offset = 8;
    while (offset < bytes.length) {
        const sectionId = bytes[offset];
        offset += 1;
        const size = readVarUint32(bytes, offset);
        offset = size.offset;
        const sectionEnd = offset + size.value;
        if (sectionEnd > bytes.length) throw resourceLimitError(`Function ${handle} has an invalid Wasm section`);

        if (sectionId === 2) {
            const imports = readVarUint32(bytes, offset);
            if (imports.value > 0) throw resourceLimitError(`Function ${handle} may not import host capabilities`);
        }

        if (sectionId === 5) {
            let cursor = offset;
            const memories = readVarUint32(bytes, cursor);
            cursor = memories.offset;
            if (memories.value > 1) throw resourceLimitError(`Function ${handle} may export at most one memory`);
            for (let index = 0; index < memories.value; index += 1) {
                const flags = bytes[cursor];
                cursor += 1;
                const min = readVarUint32(bytes, cursor);
                cursor = min.offset;
                const hasMax = (flags & 0x01) === 0x01;
                const max = hasMax ? readVarUint32(bytes, cursor) : null;
                if (max) cursor = max.offset;
                if (min.value > memoryLimitPages || (max && max.value > memoryLimitPages)) {
                    throw resourceLimitError(`Function ${handle} memory declaration exceeds ${memoryLimitBytes} bytes`);
                }
            }
        }

        if (sectionId === 10) {
            let cursor = offset;
            const functionCount = readVarUint32(bytes, cursor);
            cursor = functionCount.offset;
            for (let index = 0; index < functionCount.value; index += 1) {
                const bodySize = readVarUint32(bytes, cursor);
                cursor = bodySize.offset;
                const bodyEnd = cursor + bodySize.value;
                if (bodyEnd > sectionEnd) throw resourceLimitError(`Function ${handle} has an invalid Wasm code body`);
                if (bodySize.value > MAX_APP_FUNCTION_CODE_BODY_BYTES) {
                    throw resourceLimitError(`Function ${handle} code body exceeds ${MAX_APP_FUNCTION_CODE_BODY_BYTES} bytes`);
                }
                const localCount = readVarUint32(bytes, cursor);
                cursor = localCount.offset;
                for (let localIndex = 0; localIndex < localCount.value; localIndex += 1) {
                    const count = readVarUint32(bytes, cursor);
                    cursor = count.offset + 1;
                }
                scanWasmInstructionBudget(bytes, cursor, bodyEnd, handle);
                cursor = bodyEnd;
            }
        }

        offset = sectionEnd;
    }
}

function enforceWasmRuntimeMemoryLimit(
    exports: WasmJsonExports,
    registration: { function_handle?: string | null; memory_limit_kb?: number | string | null },
    phase: string,
): void {
    if (!(exports.memory instanceof WebAssembly.Memory)) return;
    const limit = appFunctionMemoryLimitBytes(registration);
    if (exports.memory.buffer.byteLength > limit) {
        throw resourceLimitError(`Function ${registration.function_handle || 'unknown'} memory exceeded ${limit} bytes during ${phase}`);
    }
}

async function verifiedWasmBytes(registration: AppFunctionRegistrationRow, timeoutMs: number): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(registration.wasm_module_url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Function module fetch failed with HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const digest = await sha256Hex(bytes);
        if (digest !== registration.wasm_sha256.toLowerCase()) {
            throw new Error('Function module SHA-256 verification failed');
        }
        validateWasmModuleLimits(bytes, registration);
        return bytes;
    } finally {
        clearTimeout(timeout);
    }
}

async function compileVerifiedWasmModule(registration: AppFunctionRegistrationRow): Promise<WebAssembly.Module> {
    const timeoutMs = positiveInt(registration.timeout_ms, 5, 1, 5);
    const cacheKey = `${registration.wasm_module_url}:${registration.wasm_sha256}:mem${appFunctionMemoryLimitBytes(registration)}`;
    const cached = wasmModuleCache.get(cacheKey);
    if (cached) return cached;

    const compiler = WebAssembly as WebAssemblyCompiler;
    const compiled = withTimeout(
        verifiedWasmBytes(registration, timeoutMs).then((bytes) => compiler.compile(bytes)),
        timeoutMs,
        `app function ${registration.function_handle} module load`,
    );
    wasmModuleCache.set(cacheKey, compiled);
    return compiled;
}

function writeJsonInput(
    exports: WasmJsonExports,
    registration: AppFunctionRegistrationRow,
    input: AppFunctionRuntimeInput,
): { ptr: number; len: number } {
    if (!(exports.memory instanceof WebAssembly.Memory) || typeof exports.alloc !== 'function') {
        throw new Error('Function module must export memory and alloc(size)');
    }
    enforceWasmRuntimeMemoryLimit(exports, registration, 'input allocation');

    const encoded = new TextEncoder().encode(JSON.stringify(input));
    const ptr = exports.alloc(encoded.length);
    if (!Number.isSafeInteger(ptr) || ptr < 0) throw new Error('Function alloc(size) returned an invalid pointer');
    if (ptr + encoded.length > exports.memory.buffer.byteLength) {
        throw resourceLimitError(`Function ${registration.function_handle} input allocation exceeds exported memory`);
    }
    new Uint8Array(exports.memory.buffer, ptr, encoded.length).set(encoded);
    enforceWasmRuntimeMemoryLimit(exports, registration, 'input write');
    return { ptr, len: encoded.length };
}

function readJsonOutput(exports: WasmJsonExports, registration: AppFunctionRegistrationRow, ptr: number): unknown {
    if (!(exports.memory instanceof WebAssembly.Memory) || typeof exports.result_len !== 'function') {
        throw new Error('Function module must export memory and result_len()');
    }
    enforceWasmRuntimeMemoryLimit(exports, registration, 'output read');

    const len = exports.result_len();
    if (!Number.isSafeInteger(ptr) || ptr < 0 || !Number.isSafeInteger(len) || len < 0 || len > 64 * 1024) {
        throw new Error('Function returned an invalid JSON output pointer or length');
    }
    if (ptr + len > exports.memory.buffer.byteLength) {
        throw resourceLimitError(`Function ${registration.function_handle} output pointer exceeds exported memory`);
    }

    const output = new TextDecoder().decode(new Uint8Array(exports.memory.buffer, ptr, len));
    return JSON.parse(output);
}

async function executeWasmJsonFunction(
    registration: AppFunctionRegistrationRow,
    input: AppFunctionRuntimeInput,
): Promise<AppFunctionRuntimeOutput> {
    const timeoutMs = positiveInt(registration.timeout_ms, 5, 1, 5);
    const module = await compileVerifiedWasmModule(registration);
    const instance = await withTimeout(
        WebAssembly.instantiate(module, {}),
        timeoutMs,
        `app function ${registration.function_handle} instantiate`,
    );
    const exports = instance.exports as WasmJsonExports;
    enforceWasmRuntimeMemoryLimit(exports, registration, 'instantiate');
    const entrypoint = registration.wasm_entrypoint || 'run';
    const run = exports[entrypoint];
    if (typeof run !== 'function') throw new Error(`Function module must export ${entrypoint}(ptr, len)`);

    const { ptr, len } = writeJsonInput(exports, registration, input);
    const started = Date.now();
    const outputPtr = await withTimeout(
        Promise.resolve((run as (ptr: number, len: number) => number)(ptr, len)),
        timeoutMs,
        `app function ${registration.function_handle} execution`,
    );
    if (Date.now() - started > timeoutMs) {
        throw timeoutError(`app function ${registration.function_handle} execution exceeded ${timeoutMs}ms`);
    }
    enforceWasmRuntimeMemoryLimit(exports, registration, 'execution');
    const output = readJsonOutput(exports, registration, outputPtr);
    if (typeof exports.dealloc === 'function') exports.dealloc(ptr, len);

    const normalized = normalizeAppFunctionRuntimeOutput(output);
    if (!normalized.ok) throw new Error(normalized.message);
    return normalized.value;
}

export async function loadEnabledAppFunctionRegistrations(
    c: GatewayContext,
    siteId: string,
    hook: LetbuyyAppFunctionHook,
): Promise<AppFunctionRegistrationRow[]> {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('app_function_registrations')
        .select('id, site_id, installation_id, app_id, function_handle, name, hooks, runtime, wasm_module_url, wasm_sha256, wasm_entrypoint, timeout_ms, memory_limit_kb, input_schema, output_schema, config, manifest_schema_version, app_version, created_at, updated_at')
        .eq('site_id', siteId)
        .eq('status', 'enabled')
        .contains('hooks', [hook])
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (error || !Array.isArray(data)) {
        if (isMissingTableError(error, 'app_function_registrations')) return [];
        throw new Error('App Function registry lookup failed');
    }

    return (data as AppFunctionRegistrationRow[]).filter((registration) => (
        registration.runtime === 'wasm' &&
        typeof registration.wasm_module_url === 'string' &&
        registration.wasm_module_url.startsWith('https://') &&
        /^[a-f0-9]{64}$/i.test(registration.wasm_sha256)
    ));
}

async function recordAppFunctionExecutionMetric(
    c: GatewayContext,
    input: AppFunctionRuntimeInput,
    registration: AppFunctionRegistrationRow,
    execution: AppFunctionExecutionSummary,
): Promise<void> {
    try {
        const adapter = new ObservabilityExecutionAdapter(getSupabaseAdmin(c));
        const dimensions = {
            lifecycle_version: LETBUYY_APP_EXTENSION_LIFECYCLE_VERSION,
            runtime_version: LETBUYY_APP_FUNCTION_RUNTIME_VERSION,
            installation_id: registration.installation_id || null,
            app_id: registration.app_id,
            registration_id: registration.id,
            function_handle: registration.function_handle,
            hook: input.hook,
            status: execution.status,
        };
        const metadata = {
            operations: execution.operations,
            error_code: execution.errorCode || null,
        };

        await adapter.recordMetric({
            metricName: 'app_function.execution.count',
            siteId: input.site_id,
            requestId: input.request.request_id,
            metricValue: 1,
            unit: 'count',
            dimensions,
            metadata,
        });
        await adapter.recordMetric({
            metricName: execution.status === 'failed'
                ? 'app_function.execution.failed_securely'
                : 'app_function.execution.duration_ms',
            siteId: input.site_id,
            requestId: input.request.request_id,
            metricValue: execution.status === 'failed' ? 1 : execution.durationMs,
            unit: execution.status === 'failed' ? 'count' : 'ms',
            dimensions,
            metadata,
        });
    } catch {
        // Optional metrics tables must not block checkout Function fail-closed behavior.
    }
}

async function executeAppFunctionHook(
    c: GatewayContext,
    input: AppFunctionRuntimeInput,
): Promise<{ outputs: AppFunctionRuntimeOutput[]; executions: AppFunctionExecutionSummary[] }> {
    const parsed = AppFunctionRuntimeInputSchema.parse(input);
    const registrations = await loadEnabledAppFunctionRegistrations(c, parsed.site_id, parsed.hook);
    const outputs: AppFunctionRuntimeOutput[] = [];
    const executions: AppFunctionExecutionSummary[] = [];

    for (const registration of registrations) {
        const started = Date.now();
        let execution: AppFunctionExecutionSummary;
        try {
            const output = await executeWasmJsonFunction(registration, parsed);
            outputs.push(output);
            execution = {
                registrationId: registration.id,
                appId: registration.app_id,
                hook: parsed.hook,
                handle: registration.function_handle,
                status: 'succeeded',
                durationMs: Date.now() - started,
                operations: output.operations.length,
            };
        } catch {
            execution = {
                registrationId: registration.id,
                appId: registration.app_id,
                hook: parsed.hook,
                handle: registration.function_handle,
                status: 'failed',
                durationMs: Date.now() - started,
                operations: 0,
                errorCode: 'APP_FUNCTION_FAILED',
            };
        }
        executions.push(execution);
        await recordAppFunctionExecutionMetric(c, parsed, registration, execution);
    }

    return { outputs, executions };
}

export async function evaluateCheckoutAppFunctions(
    c: GatewayContext,
    input: CheckoutFunctionEvaluationInput,
): Promise<CheckoutFunctionEvaluationResult> {
    let decision = createAppFunctionCheckoutDecision({
        couponCode: input.couponCode,
        shippingMethod: input.checkout.shipping_method,
        paymentMethod: input.checkout.payment_method,
    });
    const executions: AppFunctionExecutionSummary[] = [];

    for (const hook of APP_FUNCTION_EXECUTION_HOOK_ORDER) {
        const runtimeInput: AppFunctionRuntimeInput = {
            hook,
            site_id: input.siteId,
            cart: input.cart,
            checkout: input.checkout,
            request: {
                request_id: input.requestId,
                occurred_at: new Date().toISOString(),
            },
        };
        const result = await executeAppFunctionHook(c, runtimeInput);
        executions.push(...result.executions);

        for (const output of result.outputs) {
            decision = applyAppFunctionRuntimeOutput(decision, output);
        }

        if (result.executions.some((execution) => execution.status === 'failed')) {
            decision.validationErrors.push({
                field: hook,
                message: 'An enabled checkout Function failed securely. Please try again or contact the store.',
            });
        }
    }

    return { decision, executions };
}
