---
sidebar_position: 5
---

# Sprints

Sprints are time-boxed iterations for organizing work in PUNT. The sprint planning view helps you manage your team's workflow across multiple sprints.

## Sprint Lifecycle

Each sprint goes through three states:

```
Planning → Active → Completed
```

| State | Description |
|-------|-------------|
| **Planning** | Sprint is being prepared, tickets can be added/removed freely |
| **Active** | Sprint is in progress, only one sprint can be active at a time |
| **Completed** | Sprint has ended, metrics are recorded |

## Creating a Sprint

1. Navigate to the **Sprints** view
2. Click **+ New Sprint**
3. Enter sprint details:
   - **Name**: Auto-increments (Sprint 1, Sprint 2, etc.)
   - **Goal**: Optional sprint objective
   - **Duration**: Length in weeks (uses project default if not specified)
   - **Start Date**: When the sprint begins
4. Click **Create Sprint**

## Starting a Sprint

To start a sprint:

1. Ensure no other sprint is currently active
2. Click **Start Sprint** on a planning sprint
3. Confirm the start date and duration
4. The sprint becomes active

:::info
Only one sprint can be active at a time. Complete or cancel the current active sprint before starting a new one.
:::

## Adding Tickets to a Sprint

### From the Sprint View
- Drag tickets from the backlog into a sprint
- Use the **+ Add Ticket** button within a sprint

### From the Backlog
- Select tickets in the backlog
- Use bulk action **Move to Sprint**
- Choose the target sprint

### From the Board
- Open ticket details
- Select a sprint from the Sprint dropdown

## Sprint Progress

During an active sprint, track progress with:

- **Ticket count**: Completed vs. remaining tickets
- **Story points**: Points completed vs. total
- **Burndown**: Visual progress indicator

## Completing a Sprint

When a sprint ends:

1. Click **Complete Sprint**
2. Review sprint metrics
3. Handle incomplete tickets:

| Option | Description |
|--------|-------------|
| **Move to Next Sprint** | Carry over to the next planning sprint |
| **Return to Backlog** | Remove from any sprint |
| **Keep in Sprint** | Mark sprint complete but leave tickets |

### Carryover Tracking

Tickets carried over are marked with:
- **Carryover badge**: Indicates the ticket was not completed in a previous sprint
- **Carryover count**: Number of times the ticket has been carried over
- **Original sprint**: Reference to where the ticket was first planned

## Extending a Sprint

Active sprints can be extended:

1. Click **Extend Sprint**
2. Select the new end date
3. Confirm the extension

## Sprint Settings

Configure default sprint behavior in Project Settings:

### Default Sprint Duration
Set the default length for new sprints (1-4 weeks).

### Auto Carryover
When enabled, incomplete tickets automatically move to the next sprint on completion.

### Done Columns
Specify which board columns indicate completed work. Tickets in these columns are counted as "done" for sprint metrics.

## Sprint Metrics

After completion, sprints record:

| Metric | Description |
|--------|-------------|
| Completed Tickets | Number of tickets finished |
| Incomplete Tickets | Number of tickets not finished |
| Completed Story Points | Story points delivered |
| Incomplete Story Points | Story points not delivered |
| Velocity | Average points per sprint (calculated across sprints) |
