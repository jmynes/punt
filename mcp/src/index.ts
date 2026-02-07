#!/usr/bin/env node
import { resolve } from 'node:path'
import { config } from 'dotenv'

// Load .env from parent directory (where the main PUNT app lives)
config({ path: resolve(import.meta.dirname, '../../.env') })

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerColumnTools } from './tools/columns.js'
import { registerLabelTools } from './tools/labels.js'
import { registerMemberTools } from './tools/members.js'
import { registerProjectTools } from './tools/projects.js'
import { registerSprintTools } from './tools/sprints.js'
import { registerTicketTools } from './tools/tickets.js'

const server = new McpServer({
  name: 'punt',
  version: '1.0.0',
})

// Register all tools
registerTicketTools(server)
registerProjectTools(server)
registerSprintTools(server)
registerMemberTools(server)
registerLabelTools(server)
registerColumnTools(server)

// Connect via stdio
const transport = new StdioServerTransport()
await server.connect(transport)
