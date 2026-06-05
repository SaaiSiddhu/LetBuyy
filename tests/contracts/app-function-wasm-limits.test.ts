import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    appFunctionMemoryLimitBytes,
    validateWasmModuleLimits,
} from '../../services/api-gateway/src/extensions/app-functions-runtime';

const testDir = dirname(fileURLToPath(import.meta.url));
const runtimeSource = readFileSync(join(testDir, '../../services/api-gateway/src/extensions/app-functions-runtime.ts'), 'utf8');
const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

function wasm(bytes: number[]): Uint8Array {
    return new Uint8Array(bytes);
}

test('app function runtime enforces declared Wasm memory limits', () => {
    assert.equal(appFunctionMemoryLimitBytes({ memory_limit_kb: '64' }), 64 * 1024);
    assert.equal(appFunctionMemoryLimitBytes({ memory_limit_kb: 2048 }), 1024 * 1024);

    const onePageMemoryModule = wasm([...header, 0x05, 0x03, 0x01, 0x00, 0x01]);
    assert.doesNotThrow(() => validateWasmModuleLimits(onePageMemoryModule, {
        function_handle: 'memory_ok',
        memory_limit_kb: 64,
    }));

    const sixteenPageMemoryModule = wasm([...header, 0x05, 0x03, 0x01, 0x00, 0x10]);
    assert.throws(() => validateWasmModuleLimits(sixteenPageMemoryModule, {
        function_handle: 'memory_too_large',
        memory_limit_kb: 64,
    }), /memory declaration exceeds/);
});

test('app function runtime rejects imports and synchronous loop-capable Wasm', () => {
    const importModule = wasm([
        ...header,
        0x02, 0x0c, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x04, 0x74, 0x69, 0x63, 0x6b, 0x00, 0x00,
    ]);
    assert.throws(() => validateWasmModuleLimits(importModule, {
        function_handle: 'imports_host',
        memory_limit_kb: 64,
    }), /may not import host capabilities/);

    const loopModule = wasm([
        ...header,
        0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
        0x03, 0x02, 0x01, 0x00,
        0x0a, 0x07, 0x01, 0x05, 0x00, 0x03, 0x40, 0x0b, 0x0b,
    ]);
    assert.throws(() => validateWasmModuleLimits(loopModule, {
        function_handle: 'spins',
        memory_limit_kb: 64,
    }), /loop or branch control flow/);

    const recursiveCallModule = wasm([
        ...header,
        0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
        0x03, 0x02, 0x01, 0x00,
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x12, 0x00, 0x0b,
    ]);
    assert.throws(() => validateWasmModuleLimits(recursiveCallModule, {
        function_handle: 'tail_call',
        memory_limit_kb: 64,
    }), /Wasm calls/);

    const prefixedInstructionModule = wasm([
        ...header,
        0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
        0x03, 0x02, 0x01, 0x00,
        0x0a, 0x05, 0x01, 0x03, 0x00, 0xfd, 0x0b,
    ]);
    assert.throws(() => validateWasmModuleLimits(prefixedInstructionModule, {
        function_handle: 'prefixed',
        memory_limit_kb: 64,
    }), /prefixed Wasm instructions/);
});

test('app function runtime source keeps static and runtime resource gates wired', () => {
    assert.match(runtimeSource, /MAX_APP_FUNCTION_WASM_BYTES/);
    assert.match(runtimeSource, /MAX_APP_FUNCTION_CODE_BODY_BYTES/);
    assert.match(runtimeSource, /validateWasmModuleLimits\(bytes, registration\)/);
    assert.match(runtimeSource, /enforceWasmRuntimeMemoryLimit\(exports, registration, 'instantiate'\)/);
    assert.match(runtimeSource, /memory\.grow/);
    assert.match(runtimeSource, /Date\.now\(\) - started > timeoutMs/);
});
