---
sidebar_position: 2
---

# Projects

Projects are the top-level containers for organizing your work in PUNT. Each project has its own board, backlog, and sprints.

## Creating a Project

1. Click the **+ New Project** button in the sidebar
2. Enter a project name
3. Choose a unique project key (e.g., "PUNT", "WEB", "API")
4. Select a color for visual identification
5. Add an optional description

### Project Keys

Project keys are used to generate ticket identifiers:
- Must be unique across all projects
- Typically 2-5 uppercase letters
- Example: Project key "PUNT" creates tickets like PUNT-1, PUNT-2, etc.

## Project Roles

PUNT supports three membership roles:

| Role | Permissions |
|------|-------------|
| **Owner** | Full control, can delete project, manage all members |
| **Admin** | Can update project settings, manage members (except owner) |
| **Member** | Can view and edit tickets, sprints, and labels |

### Managing Members

Project admins and owners can:
- Invite new members via email
- Change member roles
- Remove members from the project

## Project Settings

Access project settings by clicking the gear icon in the project header:

### General Settings
- **Name**: Display name of the project
- **Key**: Cannot be changed after creation
- **Description**: Project description shown in the sidebar
- **Color**: Theme color for the project

### Sprint Settings
- **Default Duration**: Default length for new sprints (1-4 weeks)
- **Auto Carryover**: Automatically move incomplete tickets to the next sprint
- **Done Columns**: Select which columns indicate completed work

## Switching Projects

Use the sidebar to navigate between your projects:
- Click a project name to open it
- Use keyboard shortcuts for quick navigation
- Recently accessed projects appear at the top

## Deleting a Project

:::danger
Project deletion is permanent and removes all associated data including tickets, sprints, and history.
:::

Only project owners can delete a project:
1. Open Project Settings
2. Scroll to the Danger Zone
3. Click "Delete Project"
4. Confirm by typing the project name
