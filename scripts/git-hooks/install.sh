#!/bin/bash
#
# PUNT Git Hooks Installer
#
# This script installs PUNT's git hooks into your repository.
#
# Usage:
#   ./install.sh [options]
#
# Options:
#   --repo DIR       Target repository directory (default: current directory)
#   --hooks HOOKS    Comma-separated list of hooks to install (default: post-commit)
#                    Available: post-commit, commit-msg
#   --force          Overwrite existing hooks without asking
#   --uninstall      Remove PUNT hooks
#   --help           Show this help message
#
# Example:
#   ./install.sh --repo /path/to/my-repo --hooks post-commit,commit-msg
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory (where the hook files are)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
TARGET_REPO="$(pwd)"
HOOKS_TO_INSTALL="post-commit"
FORCE=false
UNINSTALL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)
            TARGET_REPO="$2"
            shift 2
            ;;
        --hooks)
            HOOKS_TO_INSTALL="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        --help)
            head -30 "$0" | grep '^#' | cut -c3-
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Verify target is a git repository
if [ ! -d "$TARGET_REPO/.git" ]; then
    echo -e "${RED}Error: $TARGET_REPO is not a git repository${NC}"
    exit 1
fi

HOOKS_DIR="$TARGET_REPO/.git/hooks"

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Convert comma-separated hooks to array
IFS=',' read -ra HOOKS <<< "$HOOKS_TO_INSTALL"

echo ""
echo "PUNT Git Hooks Installer"
echo "========================"
echo ""

# Uninstall mode
if [ "$UNINSTALL" = true ]; then
    echo "Uninstalling PUNT hooks from: $TARGET_REPO"
    echo ""

    for hook in "${HOOKS[@]}"; do
        hook=$(echo "$hook" | tr -d ' ')
        hook_path="$HOOKS_DIR/$hook"

        if [ -f "$hook_path" ]; then
            # Check if it's a PUNT hook
            if grep -q "PUNT Git Hook" "$hook_path" 2>/dev/null; then
                rm "$hook_path"
                echo -e "  ${GREEN}[REMOVED]${NC} $hook"
            else
                echo -e "  ${YELLOW}[SKIPPED]${NC} $hook (not a PUNT hook)"
            fi
        else
            echo -e "  ${YELLOW}[SKIPPED]${NC} $hook (not installed)"
        fi
    done

    echo ""
    echo -e "${GREEN}Done!${NC}"
    exit 0
fi

# Install mode
echo "Installing PUNT hooks to: $TARGET_REPO"
echo ""

for hook in "${HOOKS[@]}"; do
    hook=$(echo "$hook" | tr -d ' ')
    source_path="$SCRIPT_DIR/$hook"
    target_path="$HOOKS_DIR/$hook"

    # Check if source exists
    if [ ! -f "$source_path" ]; then
        echo -e "  ${RED}[ERROR]${NC} $hook - source not found"
        continue
    fi

    # Check if target exists
    if [ -f "$target_path" ]; then
        if [ "$FORCE" = true ]; then
            # Backup existing hook
            backup_path="$target_path.backup.$(date +%Y%m%d%H%M%S)"
            cp "$target_path" "$backup_path"
            echo -e "  ${YELLOW}[BACKUP]${NC} $hook -> $(basename "$backup_path")"
        else
            # Check if it's already a PUNT hook
            if grep -q "PUNT Git Hook" "$target_path" 2>/dev/null; then
                echo -e "  ${YELLOW}[SKIPPED]${NC} $hook (already installed, use --force to update)"
                continue
            else
                echo -e "  ${RED}[ERROR]${NC} $hook already exists (use --force to overwrite)"
                continue
            fi
        fi
    fi

    # Copy hook
    cp "$source_path" "$target_path"
    chmod +x "$target_path"
    echo -e "  ${GREEN}[INSTALLED]${NC} $hook"
done

echo ""
echo "Configuration"
echo "-------------"
echo ""
echo "Set these environment variables:"
echo ""
echo "  PUNT_API_KEY      Your PUNT API key (required for post-commit)"
echo "  PUNT_BASE_URL     PUNT server URL (default: http://localhost:3000)"
echo ""
echo "Optional:"
echo ""
echo "  PUNT_REQUIRE_TICKET  'require', 'suggest' (default), or 'ignore'"
echo "  PUNT_PROJECT_KEYS    Comma-separated valid project keys"
echo "  PUNT_HOOK_DEBUG      Set to '1' for debug output"
echo "  PUNT_HOOK_QUIET      Set to '1' to suppress all output"
echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
