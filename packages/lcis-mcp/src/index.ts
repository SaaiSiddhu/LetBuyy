/**
 * @letbuyy/lcis-mcp — public surface for tests and external consumers.
 *
 * Exports:
 *  - TOOLS         : the testable tool registry (no server required)
 *  - createServer  : factory that wires all tools onto an McpServer
 *  - ToolResult    : the return type of every tool handler
 *  - ToolDef       : the generic tool definition shape
 */
export { TOOLS, type ToolDef, type ToolResult } from './tools';
export { createServer } from './server';
