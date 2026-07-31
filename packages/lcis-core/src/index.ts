/**
 * @letbuyy/lcis-core — the consolidated, deterministic LCIS engine.
 *
 * Public surface: the canonical contracts (types), the runtime (artifact loading),
 * the graph foundation, the consolidated crown-jewel services, the composition facade
 * (createEngine/getEngine), and the shared observability + response envelope used by the
 * access layer (CLI / MCP / API / PR-check). This engine ships no server and no UI.
 */
export * from './contracts/index';
export * from './runtime/index';
export * from './graph/index';
export * from './blast-radius/index';
export * from './memory/index';
export * from './decision/index';
export * from './architecture/index';
export * from './verification/index';
export * from './engine';
export * from './observability';
