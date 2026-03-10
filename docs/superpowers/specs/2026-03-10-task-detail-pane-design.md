# Task Detail Pane — Design Spec

## Overview
Slide-in right panel on the dashboard that shows task details, editable notes, and file upload/viewing for documentation when a task row is clicked.

## Layout
- **Trigger:** Click task row → panel slides in from right (CSS transition)
- **Close:** ✕ button or click outside; clicking another row switches to that task
- **Desktop:** Panel ~380px wide, table narrows but stays visible
- **Mobile (≤768px):** Panel goes full-width over the table with a back button

## Panel Sections
1. **Header:** Task title, equipment/component path, close button
2. **Status badges:** Status (planned/overdue/completed), due date, type (manual/plan)
3. **Description:** Read-only task description
4. **Notes:** Single editable textarea (existing `notes` column on MaintenanceTask), with Save button
5. **Documents:** List of uploaded files (clickable to open in new tab), drag-and-drop upload area
6. **Actions:** Complete and Delete buttons

## Backend Changes
- **New upload endpoint:** `POST /api/uploads` — multipart file upload, saves to `data/uploads/`, returns file metadata
- **New serve endpoint:** `GET /api/uploads/{filename}` — serves uploaded files (for viewing/download)
- **Documentation model:** Add nullable `task_id` FK and `file_path` field to link uploaded files to tasks
- **New endpoint:** `GET /api/documentation?task_id=X` — list docs for a task
- **New endpoint:** `POST /api/documentation` — already exists, extend to accept `task_id` and `file_path`

## Frontend Changes
- **New JS module:** `detail-pane.js` — handles panel open/close, loading task data, notes editing, file upload
- **CSS:** Panel styles, slide animation, mobile full-width override
- **Dashboard integration:** Row click handler opens panel, panel state management
- **API module:** Add upload method, add task document methods

## Notes
- Files stored in `data/uploads/` alongside SQLite DB
- Single notes field (no comment history) using existing `notes` column
- Reuse existing Documentation model with new task_id relationship
