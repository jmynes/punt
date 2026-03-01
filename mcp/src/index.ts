#!/usr/bin/env node
// Load .env FIRST - must be before any other imports that read env vars
import './env.js'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerColumnTools } from './tools/columns.js'
import { registerLabelTools } from './tools/labels.js'
import { registerMemberTools } from './tools/members.js'
import { registerProjectTools } from './tools/projects.js'
import { registerRepositoryTools } from './tools/repository.js'
import { registerSprintTools } from './tools/sprints.js'
import { registerTicketTools } from './tools/tickets.js'
import { registerWhoamiTools } from './tools/whoami.js'

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
registerRepositoryTools(server)
registerWhoamiTools(server)

// Connect via stdio
const transport = new StdioServerTransport()
await server.connect(transport)
