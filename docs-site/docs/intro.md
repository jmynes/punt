---
sidebar_position: 1
slug: /
---

# Getting Started with PUNT

**PUNT** (Project Unified Nimble Tracker) is a local-first ticketing system with Jira-like backlog and Kanban board functionality. Built for teams who want powerful project management without the complexity.

## Features

- **Kanban Board**: Drag-and-drop task management with customizable columns
- **Backlog Management**: Prioritize and organize work items
- **Sprint Planning**: Plan and track sprints with carryover support
- **Real-time Updates**: Multi-tab and multi-user synchronization via SSE
- **Self-hosted**: Full control over your data with SQLite database
- **Modern Stack**: Built with Next.js 16, React 19, and TypeScript

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/jmynes/punt.git
cd punt

# Install dependencies
pnpm install

# Set up the database
pnpm db:push

# Start the development server
pnpm dev
```

### First Steps

1. Open your browser to `http://localhost:3000`
2. Register a new account
3. Create your first project
4. Start adding tickets to your board!

## Architecture Overview

PUNT follows a modern full-stack architecture:

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16 (App Router), React 19 |
| State Management | Zustand with localStorage persistence |
| Backend | Next.js API Routes |
| Database | SQLite with Prisma ORM |
| Authentication | NextAuth.js v5 with credentials provider |
| Real-time | Server-Sent Events (SSE) |

## What's Next?

- [Authentication Guide](/user-guide/authentication) - Learn about login, registration, and user management
- [Projects](/user-guide/projects) - Create and manage projects
- [Kanban Board](/user-guide/kanban-board) - Master the drag-and-drop board
- [API Reference](/api-reference/overview) - Integrate with PUNT programmatically
