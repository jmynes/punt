# PUNT

**P**roject **U**nified **N**imble **T**racker — a local-first ticketing system with Jira-like backlog + Kanban board. Built for fast, self-hosted workflows without the bloat.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)

## Features

### Core Functionality

- **Backlog + Kanban** — Jira-like backlog with filters/search/sort and a drag-and-drop board
- **Multi-select + bulk actions** — Move, assign, change priority, delete via keyboard or context menu
- **Keyboard moves** — Arrow keys move tickets up/down and across columns
- **Copy/paste tickets** — Clone selected tickets with undo/redo support
- **Undo/redo everywhere** — Moves, updates, pastes, deletes are all reversible
- **Context menu** — Right-click in board/backlog for copy/paste/move/assign/priority/delete
- **Real-time sync** — Server-Sent Events keep all browser tabs in sync
- **Local-first** — Self-hosted; keep data on your machine
- **Dark UI** — Amber-accented dark theme

### Sprint Management

- **Sprint lifecycle** — Planning → Active → Completed workflow
- **Sprint planning** — Create sprints with goals, start/end dates
- **Carryover tracking** — Automatically carry incomplete tickets to next sprint or backlog
- **Sprint metrics** — Track completed/incomplete tickets and story points
- **Sprint extension** — Extend active sprints by days or to a specific date
- **Sprint settings** — Configure default duration, auto-carryover, and done columns per project

### Ticket Management

- **Rich ticket fields** — Type, priority, story points, time estimates, dates, versions
- **Subtasks** — Create child tickets under parent tickets
- **Labels** — Project-scoped labels with auto-assigned colors
- **Watchers** — CC users on tickets for notifications
- **Attachments** — Upload images, videos, documents to tickets
- **Ticket linking** — Blocks, relates to, duplicates, clones relationships
- **Comments** — Threaded comments on tickets
- **Edit history** — Full audit trail of all ticket changes

### Rich Text Editor

- **MDXEditor Integration** — Full-featured WYSIWYG markdown editor with live preview
- **Rich Text Formatting** — Bold, italic, underline, strikethrough, subscript, superscript, highlight
- **Lists** — Bullet lists, numbered lists, and checklists
- **Links & Images** — Insert hyperlinks and images with custom upload dialog
- **Tables** — Insert and edit tables with column/row controls
- **Code Blocks** — Syntax-highlighted code blocks with language selection (CodeMirror 6 with oneDark theme)
- **Block Types** — Headings (H1-H6), quotes, paragraphs
- **Thematic Breaks** — Horizontal rules
- **Multiple Views** — Switch between rich text, source (markdown), and diff views
- **Responsive Toolbar** — Toolbar buttons automatically group into dropdowns on smaller screens
- **Dark Mode Theming** — All editor dialogs, popovers, and UI elements styled for dark mode

### Project Management

- **Multiple projects** — Create unlimited projects with unique keys (e.g., PUNT, API, MOB)
- **Default columns** — Projects start with To Do, In Progress, Review, Done
- **Project colors** — Customize project colors for visual distinction
- **Role-based access** — Owner, Admin, Member roles with appropriate permissions

### User Management & Admin

- **User registration** — Public registration with rate limiting
- **User profiles** — Edit name, email, avatar
- **Avatar upload** — Image cropping, WebP conversion, metadata stripping
- **Admin console** — System admin users can manage all users
- **User enable/disable** — Soft delete mechanism preserves data
- **System settings** — Configure upload limits and allowed file types

## Status & Limitations

- Desktop-focused; **mobile responsive improvements in progress**
- API/infra still WIP; expect breaking changes

### Known Issues

- **MDXEditor Code Block Markdown Shortcut**: To create a code block using markdown shortcuts, type ``` followed by the language identifier (e.g., `js`) and press **SPACE** (not Enter). This is a limitation of the Lexical markdown transformer. See [MDXEditor issue #290](https://github.com/mdx-editor/editor/issues/290).

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router + Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui + Radix UI |
| Rich Text Editor | MDXEditor (Lexical-based) |
| Code Editor | CodeMirror 6 (oneDark theme) |
| Database | SQLite + Prisma |
| State | Zustand + TanStack Query |
| Drag & Drop | dnd-kit |
| Real-time | Server-Sent Events (SSE) |
| Auth | NextAuth.js v5 |
| Linting | Biome |
| Package Manager | pnpm |

## Getting Started

### Prerequisites

- **Node.js 22+** — [Download](https://nodejs.org/)
- **pnpm 9+** — Install via `npm install -g pnpm` or see [pnpm.io](https://pnpm.io/installation)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/punt.git
cd punt

# Install dependencies
pnpm install
```

### Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Then edit `.env` to set your auth secret:

```env
# Database (SQLite) - path is relative to the prisma/ directory
DATABASE_URL="file:./punt.db"

# NextAuth.js - Generate a secure secret with: openssl rand -base64 32
AUTH_SECRET="your-generated-secret-here"

# Optional: Enable debug logging
NEXT_PUBLIC_DEBUG=false

# Optional: Trust reverse proxy headers for rate limiting
# Only set to true if behind a trusted reverse proxy (nginx, cloudflare, etc.)
TRUST_PROXY=false
```

> **Important:** The `DATABASE_URL` must use a relative path starting with `./`. This path is relative to the `prisma/` directory, so `file:./punt.db` creates the database at `prisma/punt.db`.

> **Security Note:** Only set `TRUST_PROXY=true` if you're running behind a trusted reverse proxy. Without a proxy, enabling this allows rate limit bypass via header spoofing.

### Database Setup

```bash
# Generate the Prisma client
pnpm db:generate

# Create the database and apply the schema
pnpm db:push
```

### Create Admin User

Run the seed command to create your first system administrator:

```bash
pnpm db:seed --username <username> --password <password> --name "<display name>" [--email <email>]
```

**Example:**
```bash
pnpm db:seed --username admin --password "MySecurePass123" --name "Admin User" --email "admin@example.com"
```

**Password requirements:**
- At least 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

**Username requirements:**
- 3-30 characters
- Letters, numbers, underscores, and hyphens only

### Start the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the admin credentials you created.

### Linting & Formatting

This project uses [Biome](https://biomejs.dev/) for linting and formatting, with automatic enforcement via pre-commit hooks.

**Automatic Setup:** Pre-commit hooks are configured automatically when you run `pnpm install` (via the `prepare` script). No additional setup required.

```bash
# Check for issues
pnpm lint

# Fix issues automatically
pnpm lint:fix

# Format code
pnpm format
```

**Pre-commit hooks:** Staged files are automatically linted and fixed before each commit using [husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged). Commits will fail if there are unfixable lint errors.

**VS Code integration:** The project includes recommended extensions (`.vscode/extensions.json`) and settings (`.vscode/settings.json`) for Biome. When you open the project, VS Code will prompt you to install the Biome extension, which provides:
- Real-time error highlighting
- Format on save
- Auto-organize imports

### Testing

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Open Vitest UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage

# Run tests in CI mode (with coverage)
pnpm test:ci
```

See [docs/TESTING.md](docs/TESTING.md) for detailed testing guidelines.

## Project Structure

```
punt/
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Admin user seeding script
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── (auth)/           # Login/register pages
│   │   ├── admin/            # Admin pages (users, settings)
│   │   ├── profile/          # User profile page
│   │   ├── projects/[projectId]/
│   │   │   ├── board/        # Kanban board view
│   │   │   ├── backlog/      # Backlog table view
│   │   │   └── sprints/      # Sprint planning view
│   │   └── api/              # API routes
│   ├── components/
│   │   ├── admin/            # User management
│   │   ├── auth/             # Login/register forms
│   │   ├── backlog/          # Table view
│   │   ├── board/            # Kanban board (dnd-kit)
│   │   ├── common/           # Shared components
│   │   ├── layout/           # Layout components
│   │   ├── profile/          # Profile editing
│   │   ├── projects/         # Project management
│   │   ├── sprints/          # Sprint components
│   │   ├── tickets/          # Ticket components
│   │   └── ui/               # shadcn/ui components
│   ├── hooks/                # React hooks
│   ├── lib/                  # Utilities, auth, database
│   ├── stores/               # Zustand stores
│   └── types/                # TypeScript types
└── public/                   # Static assets
```

## API Overview

PUNT provides a comprehensive REST API:

### Authentication
- `POST /api/auth/register` — Public registration (rate limited)
- `POST /api/auth/[...nextauth]` — NextAuth handlers

### User Profile
- `GET/PATCH /api/me` — Get/update profile
- `PATCH /api/me/email` — Update email
- `PATCH /api/me/password` — Change password
- `POST/DELETE /api/me/avatar` — Upload/delete avatar
- `DELETE /api/me/account` — Delete account

### Projects
- `GET/POST /api/projects` — List/create projects
- `GET/PATCH/DELETE /api/projects/[projectId]` — Manage project
- `GET /api/projects/[projectId]/columns` — List columns
- `GET /api/projects/[projectId]/members` — List members

### Tickets
- `GET/POST /api/projects/[projectId]/tickets` — List/create tickets
- `GET/PATCH/DELETE /api/projects/[projectId]/tickets/[ticketId]` — Manage ticket
- `GET/POST/DELETE /api/projects/[projectId]/tickets/[ticketId]/attachments` — Manage attachments

### Labels
- `GET/POST /api/projects/[projectId]/labels` — List/create labels
- `DELETE /api/projects/[projectId]/labels/[labelId]` — Delete label

### Sprints
- `GET/POST /api/projects/[projectId]/sprints` — List/create sprints
- `GET/PATCH/DELETE /api/projects/[projectId]/sprints/[sprintId]` — Manage sprint
- `POST /api/projects/[projectId]/sprints/[sprintId]/start` — Start sprint
- `POST /api/projects/[projectId]/sprints/[sprintId]/complete` — Complete sprint
- `POST /api/projects/[projectId]/sprints/[sprintId]/extend` — Extend sprint
- `GET/PATCH /api/projects/[projectId]/sprints/settings` — Sprint settings

### Admin (requires system admin)
- `GET/POST /api/admin/users` — List/create users
- `GET/PATCH/DELETE /api/admin/users/[userId]` — Manage user
- `GET/PATCH /api/admin/settings` — System settings

### Real-time
- `GET /api/projects/[projectId]/events` — Server-Sent Events for project updates

## Deployment

PUNT is designed to run on your own infrastructure:

### Docker (Recommended)

```bash
# Coming soon
docker-compose up -d
```

### Manual

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

### Environment Variables

Copy and configure the environment file:

```bash
cp .env.example .env
# Edit .env and set AUTH_SECRET to a secure value
```

See [Environment Setup](#environment-setup) for details on the database path.

## Security

- **Authentication** — bcryptjs password hashing (12 salt rounds), JWT sessions in HTTP-only cookies
- **Authorization** — Role-based access (owner/admin/member), IDOR protection on all routes
- **Input validation** — Zod schemas, password strength requirements, open redirect prevention
- **Rate limiting** — Database-backed limits on auth endpoints
- **File uploads** — MIME type whitelist, size limits, SVG blocked (XSS prevention)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

AGPL-3.0 License - see LICENSE file for details.

---

**PUNT** — Because your tickets deserve better than bloated enterprise software.
