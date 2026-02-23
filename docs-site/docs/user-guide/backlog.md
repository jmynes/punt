---
sidebar_position: 4
---

# Backlog

The backlog view provides a table-based interface for managing and prioritizing all tickets in your project. It's ideal for sprint planning and bulk operations.

## Backlog Layout

The backlog displays tickets in a configurable table with:
- Sortable columns
- Multi-filter support
- Bulk selection and actions
- Customizable visible columns

## Table Columns

The backlog supports up to 15 columns that can be shown or hidden:

| Column | Description |
|--------|-------------|
| Key | Ticket identifier (e.g., PUNT-42) |
| Title | Ticket title/summary |
| Type | Bug, Story, Task, Subtask, Epic |
| Priority | Critical, High, Medium, Low |
| Status | Current column/status |
| Assignee | Assigned team member |
| Sprint | Associated sprint |
| Story Points | Effort estimation |
| Due Date | Target completion date |
| Labels | Applied labels |
| Created | Creation timestamp |
| Updated | Last modified timestamp |

### Customizing Columns

1. Click the **Columns** button in the toolbar
2. Toggle columns on/off
3. Drag to reorder columns

## Filtering

The backlog supports filtering by multiple criteria simultaneously:

### Available Filters

- **Type**: Bug, Story, Task, Subtask, Epic
- **Priority**: Critical, High, Medium, Low
- **Status**: Any column/status
- **Assignee**: Team members or unassigned
- **Labels**: One or more labels
- **Sprint**: Specific sprint, backlog, or no sprint
- **Story Points**: Point range
- **Due Date**: Date range or relative (overdue, due this week, etc.)

### Combining Filters

Filters are combined with AND logic:
- Multiple values within a filter use OR (e.g., "Bug OR Story")
- Different filter types use AND (e.g., "Bug AND High Priority")

### PQL (Advanced Query Language)

For complex filtering, switch to PQL mode by clicking the **`</>`** icon in the search bar. PQL supports:

- Field comparisons: `priority = high`, `storyPoints >= 5`
- Logical operators: `AND`, `OR`, `NOT`, parentheses
- List operators: `IN (bug, task)`, `NOT IN ("Alex")`
- Emptiness checks: `IS EMPTY`, `IS NOT EMPTY`
- Date ranges: `created > -7d`, `dueDate < 2024-12-31`
- Ordinal comparisons: `priority > medium`

See the [PQL documentation](/user-guide/pql) for full syntax reference.

## Sorting

Click any column header to sort:
- First click: Ascending order
- Second click: Descending order
- Third click: Remove sorting

Multiple column sorting is supported by holding Shift while clicking.

## Bulk Operations

### Selecting Tickets

| Action | Result |
|--------|--------|
| Click row | Select single ticket |
| Shift + Click | Select range |
| Ctrl/Cmd + Click | Toggle selection |
| Ctrl/Cmd + A | Select all visible |

### Bulk Actions

With tickets selected, you can:
- **Move to Sprint**: Assign selected tickets to a sprint
- **Change Status**: Move to a different column
- **Set Priority**: Update priority for all
- **Assign**: Bulk assign to a user
- **Add Labels**: Apply labels to selection
- **Delete**: Remove selected tickets

## Sprint Planning Integration

The backlog is designed for efficient sprint planning:

1. Filter to show unassigned tickets (no sprint)
2. Sort by priority
3. Select tickets for the upcoming sprint
4. Use bulk action to move to sprint

See the [Sprints](/user-guide/sprints) guide for more on sprint management.
