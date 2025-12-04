# PUNT

**P**roject **U**nified **N**imble **T**racker - A simple, self-hosted Kanban board and ticket tracker. Jira-like without the bloat.

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)

## Features

- 🎯 **Simple Kanban Board** - Drag and drop tickets between columns
- 📱 **Mobile-first Responsive** - Works great on phones, tablets, and desktops
- 🏠 **Self-hosted** - Run on your own server, NAS, or local machine
- 🌙 **Dark Theme** - Easy on the eyes with amber accents
- 🚀 **Fast** - Built with Next.js Turbopack and React 19
- 🔒 **Privacy-focused** - Your data stays on your server

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui + Radix UI |
| Database | SQLite + Prisma |
| State | Zustand + TanStack Query |
| Drag & Drop | dnd-kit |
| Linting | Biome |
| Package Manager | pnpm |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/punt.git
cd punt

# Install dependencies
pnpm install

# Set up the database
pnpm db:push

# Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Database Commands

```bash
# Push schema changes to database
pnpm db:push

# Create a migration
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# Open Prisma Studio (database GUI)
pnpm db:studio
```

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
│   └── schema.prisma        # Database schema
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── projects/[id]/    # Project pages
│   │   └── api/              # API routes
│   ├── components/
│   │   ├── board/            # Kanban board components
│   │   ├── common/           # Shared components
│   │   ├── layout/           # Layout components
│   │   └── ui/               # shadcn/ui components
│   ├── hooks/                # React hooks
│   ├── lib/                  # Utilities and database
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
NEXT_PUBLIC_DEBUG=true  # Enable debug logging (disabled in production)
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

AGPL-3.0 License - see LICENSE file for details.

---

**PUNT** - Because your tickets deserve better than bloated enterprise software. 🏈
