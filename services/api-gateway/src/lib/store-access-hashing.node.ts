// Keep the package-import target local so Node/tsx can resolve it consistently.
// The Worker condition retains its existing static WebAssembly adapter.
export { argon2id, argon2Verify } from 'hash-wasm';
