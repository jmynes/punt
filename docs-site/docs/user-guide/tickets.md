---
sidebar_position: 6
---

# Tickets

Tickets are the core work items in PUNT. They represent tasks, bugs, stories, and other work to be tracked.

## Ticket Types

| Type | Icon | Description |
|------|------|-------------|
| **Story** | Book | User-facing feature or requirement |
| **Task** | Checkbox | Technical or operational work |
| **Bug** | Bug | Defect or issue to fix |
| **Subtask** | Subtask | Child task of another ticket |
| **Epic** | Lightning | Large feature containing multiple stories |

## Creating a Ticket

### Quick Create
1. Click **+ Add Ticket** at the bottom of any board column
2. Enter a title
3. Press Enter to create

### Full Create
1. Press `N` or click **New Ticket** in the toolbar
2. Fill in all desired fields
3. Click **Create**

## Ticket Fields

### Basic Information

| Field | Description |
|-------|-------------|
| **Title** | Brief summary of the work (required) |
| **Description** | Detailed explanation, supports Markdown |
| **Type** | Category of work (Story, Bug, Task, etc.) |
| **Priority** | Urgency level (Critical, High, Medium, Low) |

### Assignment and Tracking

| Field | Description |
|-------|-------------|
| **Assignee** | Team member responsible |
| **Sprint** | Associated sprint for planning |
| **Story Points** | Effort estimation (Fibonacci: 1, 2, 3, 5, 8, 13, 21) |
| **Estimate** | Time estimate (e.g., "2h", "1d") |

### Dates

| Field | Description |
|-------|-------------|
| **Start Date** | When work should begin |
| **Due Date** | Target completion date |

### Version Tracking

| Field | Description |
|-------|-------------|
| **Environment** | Where the issue occurs (Production, Staging, etc.) |
| **Affected Version** | Version where bug was found |
| **Fix Version** | Version where fix will be released |

### Labels

Labels provide flexible categorization:
- Create custom labels per project
- Assign colors for visual identification
- Apply multiple labels per ticket

## Ticket Relationships

### Parent-Child

Create subtasks by setting a parent ticket:
1. Open the ticket editor
2. Select a parent from the **Parent Ticket** dropdown
3. The ticket becomes a subtask

### Ticket Links

Link related tickets with:
- **Blocks / Is Blocked By**: Dependency relationships
- **Relates To**: General relationship
- **Duplicates / Is Duplicated By**: Duplicate tracking
- **Clones / Is Cloned By**: Copy relationships

## Attachments

Add files to tickets:
- Images (JPEG, PNG, GIF, WebP)
- Videos (MP4, WebM, OGG, QuickTime)
- Documents (PDF, Word, Excel, TXT, CSV)
- Maximum 20 attachments per ticket

:::note
SVG files are not allowed for security reasons.
:::

## Watching Tickets

Watch tickets to receive notifications:
- Click the **Watch** button on a ticket
- View your watched tickets from the user menu
- Watchers are notified of changes

## Editing Tickets

### Inline Editing
Click directly on certain fields in the board view to edit:
- Title
- Assignee
- Priority
- Type

### Full Editor
Open the complete ticket editor:
- Double-click the ticket card
- Press `E` with a ticket selected
- Click the ticket key (e.g., PUNT-42)

## Deleting Tickets

Delete tickets via:
- Right-click menu → Delete
- Select ticket and press `Delete`
- Open editor → Delete button

:::tip
Deleted tickets can be undone immediately using `Ctrl/Cmd + Z` or the undo toast button.
:::

## Ticket History

PUNT tracks changes to tickets:
- Field changes are recorded
- View history in the ticket detail panel
- See who made changes and when
