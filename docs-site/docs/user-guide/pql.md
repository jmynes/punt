---
sidebar_position: 5
---

# PQL (Punt Query Language)

PQL is a JQL-like query language for advanced ticket filtering. It's available in the backlog, sprint planning, and board views.

## Accessing PQL Mode

1. Click the **`</>`** icon inside the search bar to switch to PQL mode
2. Type your query with syntax highlighting and autocomplete
3. Click the **search icon** button to return to standard search
4. Press **Escape** to clear the query

The query input provides:
- **Syntax highlighting**: Fields, operators, keywords, and strings are color-coded
- **Smart autocomplete**: Context-aware suggestions for fields, operators, and values
- **Error tooltips**: Invalid queries show helpful error messages
- **Lenient parsing**: Incomplete queries work while you're typing

## Query Syntax

### Field Comparisons

```
priority = high
assignee = "Jordan"
storyPoints >= 5
type != epic
```

String values with spaces must be quoted.

### Logical Operators

Combine conditions with `AND`, `OR`, and `NOT`:

```
type = bug AND priority = high
priority = critical OR type = epic
NOT status = "Done"
```

**Implicit AND**: Spaces between conditions are treated as AND:

```
type = bug priority = high
# Same as: type = bug AND priority = high
```

### List Operators

Match against multiple values:

```
type IN (bug, task, story)
assignee NOT IN ("Alex", "Jordan")
```

### Emptiness Checks

Find tickets with empty or non-empty fields:

```
assignee IS EMPTY
sprint IS NOT EMPTY
```

### Date Comparisons

**Absolute dates** (ISO format):

```
dueDate < 2024-12-31
created > 2024-01-01
```

**Relative dates**:

```
created > -7d      # Created in the last 7 days
updated > -2w      # Updated in the last 2 weeks
dueDate < -1m      # Due date more than 1 month ago
```

| Unit | Meaning |
|------|---------|
| `d` | Days |
| `w` | Weeks |
| `m` | Months |
| `y` | Years |

### Ordinal Comparisons

Compare fields that have a natural order:

```
priority > medium       # high, highest, or critical
priority <= low         # lowest or low
sprint > "Sprint 1"     # Sprint 2, Sprint 3, etc.
```

### Parentheses

Group conditions for complex logic:

```
(type = bug OR type = task) AND priority = high
NOT (status = "Done" OR status = "Cancelled")
```

## Supported Fields

| Field | Aliases | Type | Operators |
|-------|---------|------|-----------|
| `type` | - | enum | `=`, `!=`, `IN`, `NOT IN` |
| `priority` | - | ordinal | `=`, `!=`, `>`, `<`, `>=`, `<=`, `IN`, `NOT IN` |
| `status` | - | string | `=`, `!=`, `IN`, `NOT IN`, `IS EMPTY` |
| `assignee` | - | string | `=`, `!=`, `IN`, `NOT IN`, `IS EMPTY` |
| `reporter` | - | string | `=`, `!=`, `IN`, `NOT IN`, `IS EMPTY` |
| `sprint` | - | ordinal | `=`, `!=`, `>`, `<`, `>=`, `<=`, `IN`, `NOT IN`, `IS EMPTY` |
| `labels` | `label` | array | `=`, `!=`, `IN`, `NOT IN`, `IS EMPTY` |
| `storyPoints` | `points` | number | `=`, `!=`, `>`, `<`, `>=`, `<=` |
| `dueDate` | - | date | `=`, `!=`, `>`, `<`, `>=`, `<=`, `IS EMPTY` |
| `created` | - | date | `=`, `!=`, `>`, `<`, `>=`, `<=` |
| `updated` | - | date | `=`, `!=`, `>`, `<`, `>=`, `<=` |
| `resolution` | - | enum | `=`, `!=`, `IN`, `NOT IN`, `IS EMPTY` |

## Ordinal Ordering

### Priority

From lowest to highest:
```
lowest < low < medium < high < highest < critical
```

Example: `priority >= high` matches `high`, `highest`, and `critical`.

### Sprint

Sprints are sorted naturally (Sprint 1 < Sprint 2 < Sprint 10):

```
sprint > "Sprint 5"    # Sprint 6, Sprint 7, etc.
sprint <= "Sprint 3"   # Sprint 1, Sprint 2, Sprint 3
```

## Example Queries

**High-priority bugs assigned to me:**
```
type = bug AND priority >= high AND assignee = "Me"
```

**Unassigned tickets in the current sprint:**
```
sprint = "Sprint 5" AND assignee IS EMPTY
```

**Recently created stories without points:**
```
type = story AND created > -7d AND storyPoints IS EMPTY
```

**Overdue tickets:**
```
dueDate < 0d AND status != "Done"
```

**Tickets with specific labels:**
```
labels IN (frontend, urgent)
```

**Complex filter:**
```
(type = bug OR type = task) AND priority >= medium AND sprint IS NOT EMPTY
```

## Tips

- **Case insensitive**: Field names, operators, and keywords are case-insensitive
- **Autocomplete values**: Status, assignee, sprint, and label values are populated from your project data
- **Empty IN list**: `type IN ()` matches all tickets until you add values
- **Help popover**: Click the help icon next to the query input for a syntax reference
