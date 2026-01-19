# PUNT

**P**roject **U**nified **N**imble **T**racker — an opinionated, WIP ticketing system inspired by Jira’s backlog + Kanban board. Built for fast, local-first workflows without the bloat.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)

## Features

### Core Functionality

- 🗂 **Backlog + Kanban** — Jira-like backlog with filters/search/sort and a drag-and-drop board
- 🖱 **Multi-select + bulk actions** — Move, assign, change priority, delete via keyboard or context menu
- ↕ **Keyboard moves** — Arrow keys move tickets up/down and across columns
- 📋 **Copy/paste tickets** — Clone selected tickets with undo/redo support
- ↩️ **Undo/redo everywhere** — Moves, updates, pastes, deletes are all reversible
- 🧭 **Context menu** — Right-click in board/backlog for copy/paste/move/assign/priority/delete
- 🖼 **Avatars + priority emblems** — Consistent initials/colors and priority badges across UI
- 🌀 **Scrollable columns + drop-at-end** — Columns scroll when long; reliable drop targets at ends
- 🏠 **Local-first** — Self-hosted; keep data on your machine
- 🌙 **Dark UI** — Amber-accented dark theme
- 🚀 **Fast** — Next.js (App Router + Turbopack) + React 19

### Rich Text Editor

- ✍️ **MDXEditor Integration** — Full-featured WYSIWYG markdown editor with live preview
- 📝 **Rich Text Formatting** — Bold, italic, underline, strikethrough, subscript, superscript, highlight
- 📋 **Lists** — Bullet lists, numbered lists, and checklists
- 🔗 **Links & Images** — Insert hyperlinks and images with custom upload dialog
- 📊 **Tables** — Insert and edit tables with column/row controls
- 💻 **Code Blocks** — Syntax-highlighted code blocks with language selection (CodeMirror 6 with oneDark theme)
- 📐 **Block Types** — Headings (H1-H6), quotes, paragraphs
- ➖ **Thematic Breaks** — Horizontal rules
- 👁️ **Multiple Views** — Switch between rich text, source (markdown), and diff views
- 📱 **Responsive Toolbar** — Toolbar buttons automatically group into dropdowns on smaller screens
- 🎨 **Dark Mode Theming** — All editor dialogs, popovers, and UI elements styled for dark mode
- 🖼️ **Custom Image Upload** — Modern drag-and-drop image upload with preview and URL support

## Status & Limitations

- Desktop-focused; **mobile responsive improvements in progress**
- API/infra still WIP; expect breaking changes

### Known Issues

- **MDXEditor Code Block Markdown Shortcut**: To create a code block using markdown shortcuts, you must type ``` followed by the language identifier (e.g., `js`) and then press **SPACE** (not Enter). This is a limitation of the underlying Lexical markdown transformer. See [MDXEditor issue #290](https://github.com/mdx-editor/editor/issues/290) and [feature request #716](https://github.com/mdx-editor/editor/issues/716) for more details. The code block button in the toolbar works as expected.

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

Create a `.env` file in the project root:

```env
# Database (SQLite)
DATABASE_URL="file:./punt.db"

# NextAuth.js - Generate a secure secret with: openssl rand -base64 32
AUTH_SECRET="your-secret-key-here"

# Optional: Enable debug logging
NEXT_PUBLIC_DEBUG=false
```

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

```bash
# Check for issues
pnpm lint

# Fix issues automatically
pnpm lint:fix

# Format code
pnpm format
```

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
│   │   ├── admin/            # Admin pages
│   │   ├── profile/          # User profile page
│   │   ├── projects/[projectId]/  # Project board & backlog
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
│   │   ├── tickets/          # Ticket components
│   │   └── ui/               # shadcn/ui components
│   ├── hooks/                # React hooks
│   ├── lib/                  # Utilities, auth, database
│   ├── stores/               # Zustand stores
│   └── types/                # TypeScript types
└── public/                   # Static assets
```

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

Create a `.env` file:

```env
DATABASE_URL="file:./punt.db"
AUTH_SECRET="your-production-secret-here"  # Generate with: openssl rand -base64 32
NEXT_PUBLIC_DEBUG=false
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

AGPL-3.0 License - see LICENSE file for details.

---

**PUNT** - Because your tickets deserve better than bloated enterprise software. 🏈
