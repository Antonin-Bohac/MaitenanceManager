# Maintenance Manager — Design Spec

## Overview

Single-user web application for managing factory equipment maintenance. Runs in a Docker container, accessed via local browser.

## Tech Stack

- **Backend:** Python (FastAPI)
- **Database:** SQLite
- **Frontend:** HTML/CSS/JS (served by FastAPI, no separate build step)
- **Deployment:** Docker container with volume for persistent SQLite data

## Data Model

### Hierarchy

```
Factory → Section → Equipment → Component
                     ↓              ↓
                Documentation  Documentation
                     ↓              ↓
               Maintenance    Maintenance
```

### Entities

**Factory** — top-level grouping (e.g. "Závod Praha")
- name, description

**Section** — area within a factory (e.g. "Linka 1", "Sklad")
- name, description, factory_id (FK)

**Equipment** — specific machine (e.g. "CNC Fréza #3")
- name, description, section_id (FK)

**Component** — part of equipment (e.g. "Motor", "Ložisko")
- name, description, equipment_id (FK)

**Documentation** — link to external document (manual, schematic)
- name, url, equipment_id (FK, nullable), component_id (FK, nullable)
- Belongs to either equipment or component (or both via separate records)

**MaintenanceTask** — single maintenance event
- title, description, due_date, status (planned/completed/overdue), notes
- equipment_id (FK, nullable), component_id (FK, nullable)

**MaintenancePlan** — recurring maintenance schedule
- title, description, interval_days, last_completed, next_due
- equipment_id (FK, nullable), component_id (FK, nullable)
- System auto-generates MaintenanceTask entries based on interval

## UI Layout

**Sidebar + Detail (tree navigation)**

- Left sidebar: collapsible tree showing Factory → Section → Equipment → Component hierarchy
- Right panel: detail view of selected item
- Top bar: app name, theme toggle (light/dark/auto)

### Detail Panel Content

For each entity type, the detail panel shows:
- **Factory:** name, description, list of sections
- **Section:** name, description, list of equipment
- **Equipment:** name, description, components list, documentation links, maintenance tasks/plans
- **Component:** name, description, documentation links, maintenance tasks/plans

### CRUD Operations

All entities support create, read, update, delete via modal dialogs or inline forms.

## Maintenance Features

### One-time Tasks
- Manual creation with title, description, due date
- Status: planned → completed (or overdue if past due date)
- Attached to equipment or component

### Recurring Plans
- Set interval in days (e.g. every 30 days)
- System calculates next_due from last_completed + interval_days
- Dashboard/overview shows upcoming and overdue maintenance

## Visual Style

- Auto theme: follows system preference (prefers-color-scheme)
- Manual toggle: light / dark / auto
- Industrial, clean design with status color coding:
  - Green: completed / OK
  - Yellow: upcoming soon
  - Red: overdue

## Docker Deployment

```
docker build -t maintenance-manager .
docker run -p 8000:8000 -v mm-data:/app/data maintenance-manager
```

- SQLite database stored in `/app/data/` inside container
- Docker volume `mm-data` ensures persistence across container restarts
- Single Dockerfile with Python slim base image

## API Structure (REST)

```
GET/POST       /api/factories
GET/PUT/DELETE /api/factories/{id}

GET/POST       /api/sections?factory_id=
GET/PUT/DELETE /api/sections/{id}

GET/POST       /api/equipment?section_id=
GET/PUT/DELETE /api/equipment/{id}

GET/POST       /api/components?equipment_id=
GET/PUT/DELETE /api/components/{id}

GET/POST       /api/documentation?equipment_id=&component_id=
GET/PUT/DELETE /api/documentation/{id}

GET/POST       /api/maintenance/tasks?equipment_id=&component_id=
GET/PUT/DELETE /api/maintenance/tasks/{id}

GET/POST       /api/maintenance/plans?equipment_id=&component_id=
GET/PUT/DELETE /api/maintenance/plans/{id}

GET            /api/maintenance/overview  (upcoming + overdue across all)
```

## Out of Scope (v1)

- User authentication / roles
- Email/push notifications
- Import/export
- Reporting / analytics
- Multi-language (UI in Czech by default)
