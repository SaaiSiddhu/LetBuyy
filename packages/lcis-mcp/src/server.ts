/**
 * LCIS MCP server entry point.
 *
 * Registers all 7 tools from the registry and connects a StdioServerTransport.
 * The actual .connect() call is guarded so that importing this module for tests
 * does NOT start stdio I/O.
 *
 * READ-ONLY: this server never mutates state — it only reads from the LCIS engine.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getEngine, LCIS_VERSION } from '@letbuyy/lcis-core';
import { TOOLS } from './tools';

/** Create and configure the McpServer (no transport connected yet). */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'lcis-mcp',
    version: LCIS_VERSION,
  });

  const engine = getEngine();

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      async (args: Record<string, unknown>) => {
        const result = await tool.handler(args as never, engine);
        return result;
      },
    );
  }

  return server;
}

/**
 * Main entry point — only runs when executed directly (not imported).
 * Guard prevents stdio from starting during test imports.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err: unknown) => {
    process.stderr.write(`[lcis-mcp] fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
