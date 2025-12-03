# Contributing to PUNT

Thank you for your interest in contributing to PUNT! This document outlines the process for contributing to this project.

## Contributor License Agreement (CLA)

Before your contribution can be accepted, you must sign our [Contributor License Agreement](CLA.md). This is a one-time requirement that allows us to ensure all contributions can be properly licensed.

### Why a CLA?

The CLA grants the project maintainers the necessary rights to:
- Distribute your contributions under the project's license
- Relicense the project if needed in the future
- Protect both you and the project legally

### How to Sign

1. Submit your pull request
2. The CLA-Assistant bot will comment on your PR
3. Reply to the bot's comment with: `I have read the CLA Document and I hereby sign the CLA`
4. The bot will record your signature and the CLA check will pass

You only need to sign the CLA once. After signing, all your future contributions to this project are covered.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your changes
4. Make your changes
5. Run tests: `pnpm test`
6. Run linting: `pnpm lint:fix`
7. Commit your changes
8. Push to your fork
9. Open a pull request

## Development Setup

```bash
# Install dependencies
pnpm install

# Set up the database
pnpm db:generate
pnpm db:push

# Start development server
pnpm dev
```

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Pre-commit hooks automatically check and fix issues on staged files.

```bash
# Check for issues
pnpm lint

# Auto-fix issues
pnpm lint:fix

# Format code
pnpm format
```

## Testing

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include tests for new functionality
- Update documentation if needed
- Ensure all tests pass
- Ensure linting passes
- Write clear commit messages

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.
