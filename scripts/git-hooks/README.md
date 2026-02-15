# PUNT Git Hooks Integration

Automatically update PUNT tickets based on your git commits. When you mention a ticket in your commit message (e.g., `PUNT-123`), the hook notifies PUNT and can automatically update ticket status.

## Features

- **Auto-close tickets**: Using keywords like `fixes PUNT-123` or `closes PUNT-123` automatically moves tickets to Done
- **Mark in progress**: Using `wip PUNT-123` or `working on PUNT-123` moves tickets to In Progress
- **Commit tracking**: All ticket references are logged for future reference
- **Commit message validation**: Optionally require ticket references in commit messages

## Quick Start

### 1. Generate an API Key

1. Open PUNT and go to your Profile
2. Navigate to the API Key section
3. Click "Generate API Key" and copy it

### 2. Install the Hooks

```bash
# Clone or download the hooks
curl -o post-commit https://raw.githubusercontent.com/your-org/punt/main/scripts/git-hooks/post-commit
curl -o commit-msg https://raw.githubusercontent.com/your-org/punt/main/scripts/git-hooks/commit-msg

# Or use the installer
./scripts/git-hooks/install.sh --repo /path/to/your-repo --hooks post-commit,commit-msg
```

### 3. Configure Environment

Add to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
export PUNT_API_KEY="your-api-key-here"
export PUNT_BASE_URL="http://localhost:3000"  # Your PUNT server URL
```

Or create a `.env` file in your repository and use a tool like [direnv](https://direnv.net/).

## Hook Details

### post-commit

Runs after each commit and sends commit information to PUNT. Updates tickets based on keywords in the commit message.

**Supported Patterns:**

| Pattern | Action | Example |
|---------|--------|---------|
| `fixes PROJECT-123` | Move to Done | `fix: login bug fixes PUNT-42` |
| `closes PROJECT-123` | Move to Done | `feat: add auth (closes PUNT-15)` |
| `resolves PROJECT-123` | Move to Done | `resolves PUNT-99: null check` |
| `wip PROJECT-123` | Move to In Progress | `wip PUNT-50: starting refactor` |
| `working on PROJECT-123` | Move to In Progress | `working on PUNT-33` |
| `PROJECT-123` | Log reference | `PUNT-100: added validation` |

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PUNT_API_KEY` | Your PUNT API key (required) | - |
| `PUNT_BASE_URL` | PUNT server URL | `http://localhost:3000` |
| `PUNT_HOOK_DEBUG` | Enable debug output | `0` |
| `PUNT_HOOK_QUIET` | Suppress all output | `0` |

### commit-msg

Validates commit messages before the commit is created. Can require or suggest ticket references.

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `PUNT_REQUIRE_TICKET` | `require`, `suggest`, or `ignore` | `suggest` |
| `PUNT_PROJECT_KEYS` | Comma-separated valid project keys | Any |
| `PUNT_HOOK_DEBUG` | Enable debug output | `0` |

## Manual Installation

Copy hooks to your repository's `.git/hooks/` directory:

```bash
# post-commit hook (ticket updates)
cp scripts/git-hooks/post-commit /path/to/your-repo/.git/hooks/
chmod +x /path/to/your-repo/.git/hooks/post-commit

# commit-msg hook (message validation)
cp scripts/git-hooks/commit-msg /path/to/your-repo/.git/hooks/
chmod +x /path/to/your-repo/.git/hooks/commit-msg
```

## Installer Script

Use the provided installer for easier setup:

```bash
# Install to current repository
./scripts/git-hooks/install.sh

# Install to specific repository
./scripts/git-hooks/install.sh --repo /path/to/repo

# Install specific hooks
./scripts/git-hooks/install.sh --hooks post-commit,commit-msg

# Force overwrite existing hooks
./scripts/git-hooks/install.sh --force

# Uninstall hooks
./scripts/git-hooks/install.sh --uninstall
```

## API Reference

The hooks communicate with PUNT via the Git Hook Integration API:

**Endpoint:** `POST /api/integrations/git-hook`

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: <your-api-key>`

**Request Body:**
```json
{
  "commits": [
    {
      "message": "fixes PUNT-123: resolve login bug",
      "sha": "abc123...",
      "author": "Jane Developer",
      "timestamp": "2024-01-15T10:30:00Z",
      "branch": "feature/auth"
    }
  ],
  "projectKeys": ["PUNT"],
  "dryRun": false
}
```

**Response:**
```json
{
  "success": true,
  "dryRun": false,
  "processed": 1,
  "updates": [
    {
      "ticketKey": "PUNT-123",
      "action": "close",
      "success": true,
      "message": "Ticket moved to Done (commit: abc123)",
      "ticketId": "cuid123..."
    }
  ],
  "summary": {
    "closed": 1,
    "inProgress": 0,
    "referenced": 0,
    "failed": 0
  }
}
```

## Troubleshooting

### Hook not running

1. Ensure the hook file is executable: `chmod +x .git/hooks/post-commit`
2. Check the file has no `.sample` extension
3. Verify PUNT_API_KEY is set: `echo $PUNT_API_KEY`

### Connection errors

1. Verify PUNT server is running: `curl $PUNT_BASE_URL/api/integrations/git-hook`
2. Check PUNT_BASE_URL is correct (no trailing slash)
3. Ensure your network can reach the PUNT server

### Authentication errors

1. Verify your API key is valid in PUNT Profile page
2. Check the API key is correctly exported: `echo $PUNT_API_KEY`
3. Regenerate the API key if needed

### Debug mode

Enable debug output to see what's happening:

```bash
export PUNT_HOOK_DEBUG=1
git commit -m "test PUNT-1"
```

### Bypassing hooks

To skip hooks for a single commit:

```bash
git commit --no-verify -m "emergency fix"
```

## Security Considerations

- **API keys**: Keep your API key secret. Never commit it to version control.
- **Permissions**: The hook uses your PUNT permissions. You can only update tickets in projects you're a member of.
- **Network**: The hook sends commit metadata to your PUNT server. Ensure you trust the server.

## CI/CD Integration

You can use the same API in your CI/CD pipelines:

```bash
# Example: GitHub Actions
- name: Update PUNT tickets
  run: |
    curl -X POST "$PUNT_BASE_URL/api/integrations/git-hook" \
      -H "Content-Type: application/json" \
      -H "X-API-Key: $PUNT_API_KEY" \
      -d '{
        "commits": [{
          "message": "${{ github.event.head_commit.message }}",
          "sha": "${{ github.sha }}",
          "author": "${{ github.actor }}",
          "branch": "${{ github.ref_name }}"
        }]
      }'
  env:
    PUNT_BASE_URL: ${{ secrets.PUNT_BASE_URL }}
    PUNT_API_KEY: ${{ secrets.PUNT_API_KEY }}
```

## Contributing

Found a bug or have a feature request? Open an issue or submit a pull request!
