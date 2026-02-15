/**
 * Tool definitions for Claude Chat
 * These tools allow Claude to interact with PUNT's ticket management system
 */

import type { Tool as AnthropicTool } from '@anthropic-ai/sdk/resources/messages'

// Core ticket management tools
export const chatTools: AnthropicTool[] = [
  {
    name: 'list_tickets',
    description:
      'List tickets in a project with optional filters. Returns a summary of matching tickets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectKey: {
          type: 'string',
          description: 'Project key (e.g., PUNT)',
        },
        column: {
          type: 'string',
          description: 'Filter by column/status name (e.g., "In Progress", "To Do")',
        },
        type: {
          type: 'string',
          enum: ['epic', 'story', 'task', 'bug', 'subtask'],
          description: 'Filter by ticket type',
        },
        priority: {
          type: 'string',
          enum: ['lowest', 'low', 'medium', 'high', 'highest', 'critical'],
          description: 'Filter by priority',
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee name',
        },
        sprint: {
          type: 'string',
          description: 'Filter by sprint name',
        },
        resolution: {
          type: 'string',
          description:
            'Filter by resolution: "resolved", "unresolved", or specific value like "Done"',
        },
        search: {
          type: 'string',
          description: 'Text search across title and description',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tickets to return (default 20, max 100)',
        },
      },
      required: ['projectKey'],
    },
  },
  {
    name: 'get_ticket',
    description: 'Get detailed information about a specific ticket by its key (e.g., PUNT-123)',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          description: 'Ticket key like PUNT-123',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'create_ticket',
    description: 'Create a new ticket in a project',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectKey: {
          type: 'string',
          description: 'Project key (e.g., PUNT)',
        },
        title: {
          type: 'string',
          description: 'Ticket title',
        },
        description: {
          type: 'string',
          description: 'Ticket description (markdown supported)',
        },
        type: {
          type: 'string',
          enum: ['epic', 'story', 'task', 'bug', 'subtask'],
          description: 'Ticket type (default: task)',
        },
        priority: {
          type: 'string',
          enum: ['lowest', 'low', 'medium', 'high', 'highest', 'critical'],
          description: 'Priority level (default: medium)',
        },
        assignee: {
          type: 'string',
          description: 'Assignee name',
        },
        storyPoints: {
          type: 'number',
          description: 'Story points estimate',
        },
        sprint: {
          type: 'string',
          description: 'Sprint name to add ticket to',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Label names to assign',
        },
        parent: {
          type: 'string',
          description: 'Parent ticket key for subtasks (e.g., PUNT-5)',
        },
      },
      required: ['projectKey', 'title'],
    },
  },
  {
    name: 'update_ticket',
    description: 'Update an existing ticket',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          description: 'Ticket key (e.g., PUNT-123)',
        },
        title: {
          type: 'string',
          description: 'New title',
        },
        description: {
          type: 'string',
          description: 'New description',
        },
        type: {
          type: 'string',
          enum: ['epic', 'story', 'task', 'bug', 'subtask'],
        },
        priority: {
          type: 'string',
          enum: ['lowest', 'low', 'medium', 'high', 'highest', 'critical'],
        },
        column: {
          type: 'string',
          description: 'Move to column/status',
        },
        assignee: {
          type: 'string',
          description: 'New assignee name (null to unassign)',
        },
        storyPoints: {
          type: 'number',
          description: 'Story points',
        },
        sprint: {
          type: 'string',
          description: 'Sprint name (null for backlog)',
        },
        resolution: {
          type: 'string',
          enum: ['Done', "Won't Fix", 'Duplicate', 'Cannot Reproduce', 'Incomplete', "Won't Do"],
          description: 'Resolution status',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Label names (replaces existing)',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all projects the user has access to',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_project',
    description: 'Get details about a project including columns, members, and ticket count',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: {
          type: 'string',
          description: 'Project key (e.g., PUNT)',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'list_sprints',
    description: 'List sprints for a project',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectKey: {
          type: 'string',
          description: 'Project key (e.g., PUNT)',
        },
        status: {
          type: 'string',
          enum: ['planning', 'active', 'completed'],
          description: 'Filter by sprint status',
        },
      },
      required: ['projectKey'],
    },
  },
  {
    name: 'list_labels',
    description: 'List all labels for a project',
    input_schema: {
      type: 'object' as const,
      properties: {
        projectKey: {
          type: 'string',
          description: 'Project key (e.g., PUNT)',
        },
      },
      required: ['projectKey'],
    },
  },
]

// Tool name type for type safety
export type ChatToolName =
  | 'list_tickets'
  | 'get_ticket'
  | 'create_ticket'
  | 'update_ticket'
  | 'list_projects'
  | 'get_project'
  | 'list_sprints'
  | 'list_labels'
