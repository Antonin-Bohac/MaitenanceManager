# i18n + Enhanced Detail Pane Design Spec

## Overview

Three interconnected enhancements to the Maintenance Manager app:
1. Full English/German internationalization (UI strings + database record translations)
2. Enhanced task detail pane with additional controls
3. Visual tree breadcrumb in the detail pane

## 1. Internationalization (i18n)

### 1.1 UI String Translations

A new `i18n.js` module contains all translatable UI strings in a nested object keyed by language code (`en`, `de`). A global `t('key.path')` function returns the string for the active language.

Language preference stored in `localStorage`. A small EN|DE toggle button in the topbar, next to the theme toggle. Date formatting switches locale between `en-US` and `de-DE`.

**Scope of UI strings to translate:**
- HTML: all button text, labels, placeholders, stat card labels, table headers, nav items, empty states
- JS modals: all modal titles and field labels (tree.js, detail.js, dashboard.js, app.js)
- JS UI strings: status labels, filter options, confirmation messages, error messages
- Detail pane: section headers, badge text, placeholder text

### 1.2 Database Record Translations

A new `translations` table stores translated values for any entity field:

```
translations(
  id            INTEGER PRIMARY KEY,
  entity_type   VARCHAR(50) NOT NULL,   -- "factory", "section", "equipment", "component", "task", "plan"
  entity_id     INTEGER NOT NULL,
  field_name    VARCHAR(50) NOT NULL,   -- "name", "description", "title"
  lang          VARCHAR(10) NOT NULL,   -- "en", "de"
  value         TEXT NOT NULL,
  created_at    DATETIME
)
UNIQUE(entity_type, entity_id, field_name, lang)
```

### 1.3 Translations API

New router `/api/translations`:
- `GET /api/translations?entity_type=factory&entity_id=1&lang=de` — get translations for a single entity
- `GET /api/translations/batch?entity_type=factory&lang=de` — get all translations for an entity type (bulk fetch for tree/dashboard)
- `PUT /api/translations` — upsert a translation `{entity_type, entity_id, field_name, lang, value}`

### 1.4 Frontend Translation Flow

1. On language switch, fetch batch translations for active view's entity types
2. Cache in a `TranslationCache` object in memory
3. Rendering calls `TranslationCache.get(entityType, id, field)` — returns translated value or falls back to base value
4. Create/edit modals show both language fields side by side: "Name (EN)" / "Name (DE)"

### 1.5 What Gets Translated

| Entity | Fields |
|--------|--------|
| Factory | name, description |
| Section | name, description |
| Equipment | name, description |
| Component | name, description |
| Task | title, description |
| Plan | title, description |

**Not translated** (user free text): notes, checklist items, activity log, file names.

## 2. Enhanced Detail Pane

### 2.1 New Database Fields

**MaintenanceTask model additions:**
- `priority` — String(20), default "medium". Values: "low", "medium", "high", "critical"
- `assignee` — String(200), nullable
- `estimated_minutes` — Integer, nullable

**New table `task_checklist_items`:**
```
task_checklist_items(
  id            INTEGER PRIMARY KEY,
  task_id       INTEGER NOT NULL FK -> maintenance_tasks(id) ON DELETE CASCADE,
  text          VARCHAR(500) NOT NULL,
  is_completed  BOOLEAN DEFAULT FALSE,
  created_at    DATETIME
)
```

**New table `task_activity_log`:**
```
task_activity_log(
  id            INTEGER PRIMARY KEY,
  task_id       INTEGER NOT NULL FK -> maintenance_tasks(id) ON DELETE CASCADE,
  action        VARCHAR(50) NOT NULL,
  detail        TEXT,
  created_at    DATETIME
)
```

### 2.2 Detail Pane Layout (top to bottom)

1. **Header:** Title + close button
2. **Tree breadcrumb:** Horizontal icon pills with arrows (see Section 3)
3. **Metadata grid:**
   - Status dropdown (Planned / In Progress / Completed / Overdue)
   - Priority badge (Low / Medium / High / Critical) — clickable to change
   - Assignee — text input with save, or "Unassigned"
   - Due date — displayed, clickable to edit
   - Estimated duration — hours/minutes input
   - Plan info — if linked, shows interval and next occurrence
4. **Description**
5. **Checklist/Subtasks:**
   - Checkbox items with text, X to remove
   - "Add item" input at bottom
   - Progress: "3/5 completed"
6. **Notes** (existing edit/save/cancel)
7. **Documents** (existing upload/list/delete)
8. **Activity Log:**
   - Chronological, newest first
   - Auto-logged: created, status change, priority change, assignee change, note edit, file upload/remove, checklist add/complete
   - Each entry: icon + description + timestamp
   - Compact small text styling
9. **Action buttons:** Delete (with confirmation). Complete button removed (replaced by status dropdown).

### 2.3 Checklist API

New endpoints under `/api/maintenance/tasks/{task_id}/checklist`:
- `GET` — list items
- `POST` — add item `{text}`
- `PUT /{item_id}` — update `{text?, is_completed?}`
- `DELETE /{item_id}` — remove item

### 2.4 Activity Log API

New endpoints under `/api/maintenance/tasks/{task_id}/activity`:
- `GET` — list entries (newest first)

Activity entries are created automatically by the backend when task fields change. No manual creation endpoint.

### 2.5 Activity Log Triggers

The backend records activity on these events:
- Task created
- Status changed (old → new)
- Priority changed (old → new)
- Assignee changed (old → new)
- Notes edited
- File uploaded / removed
- Checklist item added / completed / removed
- Estimated duration changed
- Due date changed

## 3. Visual Tree Breadcrumb

Horizontal breadcrumb below the task title in the detail pane:

- Each level (Factory, Section, Equipment, Component) is a rounded pill with icon and name
- Icons: 🏭 Factory, 📁 Section, ⚙️ Equipment, 🔧 Component
- Arrows (→) connect the pills
- Only levels that exist are shown (chain stops at the deepest linked level)
- If no equipment linked: muted "No equipment linked" text
- Pills are visual only (not clickable)
- On mobile: pills wrap via `flex-wrap`
- Data already available in dashboard task objects (factory_name, section_name, equipment_name, component_name)

## 4. Technical Notes

- SQLite ALTER TABLE for new columns on maintenance_tasks
- SQLite CREATE TABLE for checklist, activity log, translations
- All new tables use ON DELETE CASCADE for task_id FK
- i18n module loads before other JS modules (script order in index.html)
- Language toggle triggers re-render of active view
- Translations batch endpoint minimizes API calls (one per entity type per language switch)
