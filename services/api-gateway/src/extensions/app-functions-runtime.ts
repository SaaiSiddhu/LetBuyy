import type { Context } from 'hono';
import {
    AppFunctionRuntimeInputSchema,
    applyAppFunctionRuntimeOutput,
    createAppFunctionCheckoutDecision,
    normalizeAppFunctionRuntimeOutput,
    type AppFunctionCheckoutDecision,
    type AppFunctionCheckoutPaymentMethod,
    type AppFunctionCheckoutShippingMethod,
    type AppFunctionRuntimeInput,
    type AppFunctionRuntimeOutput,
    type LetbuyyAppFunctionHook,
} from '@letbuyy/app-engine';
import type { Env } from '../index';
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
        return bytes;
    } finally {
        clearTimeout(timeout);
    }
}

async function compileVerifiedWasmModule(registration: AppFunctionRegistrationRow): Promise<WebAssembly.Module> {
    const timeoutMs = positiveInt(registration.timeout_ms, 5, 1, 5);
    const cacheKey = `${registration.wasm_module_url}:${registration.wasm_sha256}`;
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

function writeJsonInput(exports: WasmJsonExports, input: AppFunctionRuntimeInput): { ptr: number; len: number } {
    if (!(exports.memory instanceof WebAssembly.Memory) || typeof exports.alloc !== 'function') {
        throw new Error('Function module must export memory and alloc(size)');
    }

    const encoded = new TextEncoder().encode(JSON.stringify(input));
    const ptr = exports.alloc(encoded.length);
    if (!Number.isSafeInteger(ptr) || ptr < 0) throw new Error('Function alloc(size) returned an invalid pointer');
    new Uint8Array(exports.memory.buffer, ptr, encoded.length).set(encoded);
    return { ptr, len: encoded.length };
}

function readJsonOutput(exports: WasmJsonExports, ptr: number): unknown {
    if (!(exports.memory instanceof WebAssembly.Memory) || typeof exports.result_len !== 'function') {
        throw new Error('Function module must export memory and result_len()');
    }

    const len = exports.result_len();
    if (!Number.isSafeInteger(ptr) || ptr < 0 || !Number.isSafeInteger(len) || len < 0 || len > 64 * 1024) {
        throw new Error('Function returned an invalid JSON output pointer or length');
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
    const entrypoint = registration.wasm_entrypoint || 'run';
    const run = exports[entrypoint];
    if (typeof run !== 'function') throw new Error(`Function module must export ${entrypoint}(ptr, len)`);

    const { ptr, len } = writeJsonInput(exports, input);
    const outputPtr = await withTimeout(
        Promise.resolve((run as (ptr: number, len: number) => number)(ptr, len)),
        timeoutMs,
        `app function ${registration.function_handle} execution`,
    );
    const output = readJsonOutput(exports, outputPtr);
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
    const { data, error } = await getSupabaseAdmin(c)
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
        try {
            const output = await executeWasmJsonFunction(registration, parsed);
            outputs.push(output);
            executions.push({
                registrationId: registration.id,
                appId: registration.app_id,
                hook: parsed.hook,
                handle: registration.function_handle,
                status: 'succeeded',
                durationMs: Date.now() - started,
                operations: output.operations.length,
            });
        } catch {
            executions.push({
                registrationId: registration.id,
                appId: registration.app_id,
                hook: parsed.hook,
                handle: registration.function_handle,
                status: 'failed',
                durationMs: Date.now() - started,
                operations: 0,
                errorCode: 'APP_FUNCTION_FAILED',
            });
        }
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
