---
sidebar_position: 3
---

# Kanban Board

The Kanban board is the primary view for visualizing and managing your project's workflow. Drag tickets between columns to update their status.

## Board Layout

The board displays tickets organized in columns:
- Default columns: **To Do**, **In Progress**, **Done**
- Columns are ordered left-to-right to represent workflow progression
- Each column shows a count of tickets it contains

## Working with Tickets

### Creating Tickets

1. Click the **+ Add Ticket** button at the bottom of any column
2. Or use the keyboard shortcut `N` to open the new ticket dialog
3. Fill in the ticket details and save

### Moving Tickets

Drag and drop tickets to change their status:
- **Single ticket**: Click and drag to any column
- **Multiple tickets**: Select tickets first, then drag any selected ticket

### Selecting Multiple Tickets

| Action | Result |
|--------|--------|
| Click | Select single ticket |
| Shift + Click | Select range of tickets |
| Ctrl/Cmd + Click | Toggle ticket selection |
| Escape | Clear selection |

### Ticket Actions

Right-click a ticket (or click the menu icon) to access:
- **Edit**: Open the full ticket editor
- **Copy**: Copy ticket to clipboard
- **Delete**: Remove the ticket (with undo support)
- **Change Type**: Quick type update
- **Change Priority**: Quick priority update
- **Assign**: Assign to a team member

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `N` | New ticket |
| `E` | Edit selected ticket |
| `Delete` | Delete selected tickets |
| `Ctrl/Cmd + C` | Copy selected tickets |
| `Ctrl/Cmd + V` | Paste copied tickets |
| `Ctrl/Cmd + Z` | Undo last action |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Arrow Keys` | Navigate between tickets |

## Column Management

### Reordering Columns

Drag column headers to reorder the workflow stages.

### Column Settings

Each column can be configured:
- **Name**: Display name of the column
- **WIP Limit**: Optional work-in-progress limit
- **Color**: Visual indicator color

## Filtering and Searching

Use the filter bar above the board to narrow down visible tickets:
- Filter by **type** (Bug, Story, Task, etc.)
- Filter by **priority** (Critical, High, Medium, Low)
- Filter by **assignee**
- Filter by **labels**
- Search by ticket **title** or **key**

## Real-time Collaboration

The board updates in real-time when:
- Another user moves a ticket
- Tickets are created or deleted
- Ticket details change

Changes from your own browser tab are highlighted differently to distinguish your actions from others.
