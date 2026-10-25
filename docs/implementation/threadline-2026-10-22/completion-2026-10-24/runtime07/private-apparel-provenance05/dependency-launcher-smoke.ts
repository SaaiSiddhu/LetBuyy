// Harmless compiler/control smoke. No imports, app/test/Worker/runner or network APIs.
const value: Readonly<{ marker: string; sum: number }> = { marker: 'DEPENDENCY_ONLY_TS_SMOKE_PASS', sum: 20 + 22 };
if (value.sum !== 42) throw new Error('Compiler smoke result mismatch');
process.stdout.write(JSON.stringify(value) + '\n');
