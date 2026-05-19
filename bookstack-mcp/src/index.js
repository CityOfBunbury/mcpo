#!/usr/bin/env node
/**
 * BookStack MCP Server
 * 
 * Runs as a stdio-based MCP server. Claude connects to it and gains tools
 * for searching, reading, creating, and updating BookStack content.
 *
 * Required environment variables:
 *   BOOKSTACK_BASE_URL  — e.g. https://docs.yourorg.com
 *   BOOKSTACK_TOKEN_ID  — API token ID from BookStack user profile
 *   BOOKSTACK_TOKEN_SECRET — API token secret
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { BookStackClient } from './bookstack-client.js';
import { TOOLS } from './tools.js';
import { handleTool } from './handlers.js';

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.BOOKSTACK_BASE_URL;
const TOKEN_ID = process.env.BOOKSTACK_TOKEN_ID;
const TOKEN_SECRET = process.env.BOOKSTACK_TOKEN_SECRET;

if (!BASE_URL || !TOKEN_ID || !TOKEN_SECRET) {
  console.error(
    'Missing required environment variables.\n' +
    'Set: BOOKSTACK_BASE_URL, BOOKSTACK_TOKEN_ID, BOOKSTACK_TOKEN_SECRET'
  );
  process.exit(1);
}

const client = new BookStackClient(BASE_URL, TOKEN_ID, TOKEN_SECRET);

// ── MCP Server ───────────────────────────────────────────────────────────────
const server = new Server(
  { name: 'bookstack-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleTool(name, args ?? {}, client);
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('BookStack MCP server running (stdio)');
