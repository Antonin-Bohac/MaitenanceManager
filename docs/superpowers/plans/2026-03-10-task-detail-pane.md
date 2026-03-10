# Task Detail Pane Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slide-in detail panel to the dashboard that shows task info, editable notes, and file upload/viewing for documentation.

**Architecture:** Extend the Documentation model with `task_id` FK and `file_path` field. Add a file upload router (`/api/uploads`). Build a frontend detail-pane.js module that renders a slide-in panel on task row click, with notes editing and file upload via drag-and-drop. Panel CSS uses transform transitions and goes full-width on mobile.

**Tech Stack:** FastAPI (python-multipart for uploads), SQLAlchemy, vanilla JS, CSS transitions, Playwright for e2e tests.

**Spec:** `docs/superpowers/specs/2026-03-10-task-detail-pane-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/models.py` | Add `task_id`, `file_path` to Documentation model; add `documentation` relationship to MaintenanceTask |
| Modify | `app/schemas.py` | Add `task_id`, `file_path` to Documentation schemas |
| Modify | `app/routers/documentation.py` | Add `task_id` query filter |
| Create | `app/routers/uploads.py` | File upload (`POST`) and serving (`GET`) endpoints |
| Modify | `app/main.py` | Register uploads router |
| Modify | `app/database.py` | Export `DATA_DIR` for use by uploads router |
| Modify | `requirements.txt` | Add `python-multipart` |
| Create | `app/static/js/detail-pane.js` | Detail panel logic: open/close, notes, file upload |
| Modify | `app/static/js/api.js` | Add `uploadFile`, `getTaskDocs`, `deleteDoc`, `getTask` methods |
| Modify | `app/static/js/dashboard.js` | Add row click handler to open detail pane |
| Modify | `app/static/index.html` | Add detail panel HTML structure and script tag |
| Modify | `app/static/css/style.css` | Panel slide-in styles, mobile override |
| Create | `tests/test_uploads.py` | Backend tests for upload/serve endpoints |
| Modify | `tests/test_documentation.py` | Test task_id filter |
| Create | `tests/e2e/detail-pane.spec.js` | Playwright e2e tests for detail panel |

---

## Task 1: Backend — Documentation model + upload endpoints

**Files:**
- Modify: `app/models.py:54-63` (Documentation model)
- Modify: `app/schemas.py:80-97` (Documentation schemas)
- Modify: `app/routers/documentation.py:10-16` (list_documentation query)
- Create: `app/routers/uploads.py`
- Modify: `app/main.py` (register router)
- Modify: `requirements.txt` (add python-multipart)
- Modify: `tests/test_documentation.py`
- Create: `tests/test_uploads.py`

### Step 1.1: Add python-multipart dependency

- [ ] Add `python-multipart` to `requirements.txt`

```
python-multipart==0.0.20
```

- [ ] Install it:

```bash
source .venv/bin/activate && pip install python-multipart==0.0.20
```

### Step 1.2: Extend Documentation model

- [ ] In `app/models.py`, add `task_id` and `file_path` to the Documentation class:

```python
class Documentation(Base):
    __tablename__ = "documentation"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    file_path = Column(String(500), nullable=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    task_id = Column(Integer, ForeignKey("maintenance_tasks.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    equipment = relationship("Equipment", back_populates="documentation")
    component = relationship("Component", back_populates="documentation")
    task = relationship("MaintenanceTask", back_populates="documentation")
```

- [ ] Add `documentation` relationship to `MaintenanceTask` model:

```python
# In MaintenanceTask class, after existing relationships:
documentation = relationship("Documentation", back_populates="task", cascade="all, delete-orphan")
```

### Step 1.3: Extend Documentation schemas

- [ ] In `app/schemas.py`, update the three Documentation schemas:

```python
class DocumentationCreate(BaseModel):
    name: str
    url: str = ""
    file_path: str | None = None
    equipment_id: int | None = None
    component_id: int | None = None
    task_id: int | None = None

class DocumentationUpdate(BaseModel):
    name: str | None = None
    url: str | None = None

class DocumentationOut(BaseModel):
    id: int
    name: str
    url: str
    file_path: str | None
    equipment_id: int | None
    component_id: int | None
    task_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}
```

### Step 1.4: Add task_id filter to documentation router

- [ ] In `app/routers/documentation.py`, add `task_id` query param to `list_documentation`:

```python
@router.get("", response_model=list[DocumentationOut])
def list_documentation(equipment_id: int | None = Query(None), component_id: int | None = Query(None), task_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Documentation)
    if equipment_id:
        q = q.filter(Documentation.equipment_id == equipment_id)
    if component_id:
        q = q.filter(Documentation.component_id == component_id)
    if task_id:
        q = q.filter(Documentation.task_id == task_id)
    return q.all()
```

### Step 1.5: Create uploads router

- [ ] Create `app/routers/uploads.py`:

```python
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from app.database import DATA_DIR

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(DATA_DIR) / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".txt", ".csv"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {ext} not allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large (max 20MB)")

    safe_name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / safe_name
    dest.write_bytes(content)

    return {
        "filename": safe_name,
        "original_name": file.filename,
        "size": len(content),
        "url": f"/api/uploads/{safe_name}",
    }


@router.get("/{filename}")
async def serve_file(filename: str):
    # Prevent path traversal
    safe = Path(filename).name
    file_path = UPLOAD_DIR / safe
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(404, "File not found")
    return FileResponse(file_path, filename=safe)
```

### Step 1.6: Register uploads router in main.py

- [ ] In `app/main.py`, add import and include:

```python
from app.routers import factories, sections, equipment, components, documentation, maintenance, tree, uploads
# ...
app.include_router(uploads.router)
```

### Step 1.7: Write and run backend tests

- [ ] Add task_id test to `tests/test_documentation.py`:

```python
def test_list_docs_by_task(client, ids):
    task = client.post("/api/maintenance/tasks", json={"title": "T", "due_date": "2026-04-01", "equipment_id": ids["equipment_id"]}).json()
    client.post("/api/documentation", json={"name": "TaskDoc", "url": "/api/uploads/test.pdf", "task_id": task["id"]})
    r = client.get(f"/api/documentation?task_id={task['id']}")
    assert len(r.json()) == 1
    assert r.json()[0]["task_id"] == task["id"]
```

- [ ] Create `tests/test_uploads.py`:

```python
import io
from unittest.mock import patch
from pathlib import Path


def test_upload_file(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.post("/api/uploads", files={"file": ("test.pdf", b"fake pdf content", "application/pdf")})
        assert r.status_code == 200
        data = r.json()
        assert data["original_name"] == "test.pdf"
        assert data["filename"].endswith(".pdf")
        assert data["url"].startswith("/api/uploads/")
        # File should exist on disk
        assert (tmp_path / data["filename"]).exists()


def test_upload_rejected_extension(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.post("/api/uploads", files={"file": ("evil.exe", b"bad stuff", "application/octet-stream")})
        assert r.status_code == 400


def test_serve_uploaded_file(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        # Upload first
        r = client.post("/api/uploads", files={"file": ("doc.pdf", b"pdf bytes", "application/pdf")})
        filename = r.json()["filename"]
        # Serve
        r = client.get(f"/api/uploads/{filename}")
        assert r.status_code == 200
        assert r.content == b"pdf bytes"


def test_serve_missing_file(client):
    r = client.get("/api/uploads/nonexistent.pdf")
    assert r.status_code == 404


def test_path_traversal_blocked(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.get("/api/uploads/../../etc/passwd")
        assert r.status_code == 404
```

- [ ] Run all backend tests:

```bash
source .venv/bin/activate && pytest tests/ -v
```

Expected: All pass.

- [ ] Commit:

```bash
git add -A && git commit -m "feat: add file upload endpoint and task_id to Documentation model"
```

---

## Task 2: Frontend — Detail pane HTML + CSS

**Files:**
- Modify: `app/static/index.html` (panel markup + script tag)
- Modify: `app/static/css/style.css` (panel styles)

### Step 2.1: Add detail panel HTML to index.html

- [ ] In `app/static/index.html`, add the detail panel markup just before the closing `</div>` of `view-dashboard` (before line `</div>` that closes `id="view-dashboard"`):

```html
<!-- Task detail slide-in panel -->
<div id="task-detail-panel" class="task-detail-panel">
    <div class="detail-panel-header">
        <div>
            <h3 id="detail-title" class="detail-panel-title"></h3>
            <div id="detail-path" class="detail-panel-path"></div>
        </div>
        <button id="detail-close" class="btn-icon" title="Close">✕</button>
    </div>

    <div class="detail-panel-badges" id="detail-badges"></div>

    <div class="detail-panel-section">
        <div class="detail-panel-label">Description</div>
        <div id="detail-description" class="detail-panel-text"></div>
    </div>

    <div class="detail-panel-section">
        <div class="detail-panel-label-row">
            <span class="detail-panel-label">Notes</span>
            <button id="detail-notes-edit" class="detail-panel-link">Edit</button>
        </div>
        <div id="detail-notes-display" class="detail-panel-text"></div>
        <div id="detail-notes-editor" class="detail-notes-editor hidden">
            <textarea id="detail-notes-textarea" class="detail-notes-textarea" rows="4"></textarea>
            <div class="detail-notes-actions">
                <button id="detail-notes-save" class="btn btn-primary btn-sm">Save</button>
                <button id="detail-notes-cancel" class="btn btn-sm">Cancel</button>
            </div>
        </div>
    </div>

    <div class="detail-panel-section">
        <div class="detail-panel-label">Documents</div>
        <div id="detail-docs-list" class="detail-docs-list"></div>
        <div id="detail-upload-area" class="detail-upload-area">
            <input type="file" id="detail-file-input" hidden>
            <div class="detail-upload-label">📎 Drop files or click to upload</div>
        </div>
    </div>

    <div class="detail-panel-actions">
        <button id="detail-complete-btn" class="btn btn-success">✓ Complete</button>
        <button id="detail-delete-btn" class="btn btn-danger btn-sm">Delete</button>
    </div>
</div>
```

- [ ] Add the script tag for detail-pane.js in index.html (before app.js):

```html
<script src="/js/detail-pane.js"></script>
```

### Step 2.2: Add panel CSS styles

- [ ] In `app/static/css/style.css`, add before the responsive section (before `/* Mobile menu button */`):

```css
/* === TASK DETAIL PANEL === */
.task-detail-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 380px;
    background: var(--bg-card);
    border-left: 2px solid var(--accent);
    transform: translateX(100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
    z-index: 10;
    display: flex;
    flex-direction: column;
    padding: 16px;
}

.task-detail-panel.open {
    transform: translateX(0);
}

.view-dashboard-with-panel .table-wrapper {
    margin-right: 380px;
}

.detail-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 14px;
}

.detail-panel-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-bright);
    margin: 0;
}

.detail-panel-path {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 3px;
}

.detail-panel-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 14px;
}

.detail-badge {
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
}

.detail-badge-overdue { background: var(--danger-bg); color: var(--danger); }
.detail-badge-planned { background: var(--warning-bg); color: var(--warning); }
.detail-badge-completed { background: var(--success-bg); color: var(--success); }
.detail-badge-due { background: var(--accent-subtle); color: var(--accent); }
.detail-badge-type { background: rgba(168, 85, 247, 0.12); color: #a855f7; }

.detail-panel-section {
    margin-bottom: 14px;
}

.detail-panel-label {
    font-size: 10px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-weight: 600;
    margin-bottom: 6px;
}

.detail-panel-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.detail-panel-link {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 11px;
    cursor: pointer;
    font-family: var(--font);
    padding: 0;
}
.detail-panel-link:hover { text-decoration: underline; }

.detail-panel-text {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
}

.detail-notes-editor { margin-top: 6px; }

.detail-notes-textarea {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-input);
    color: var(--text-primary);
    font-size: 12px;
    font-family: var(--font);
    resize: vertical;
    min-height: 80px;
}
.detail-notes-textarea:focus {
    outline: none;
    border-color: var(--accent);
}

.detail-notes-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
}

.detail-docs-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
}

.detail-doc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-table-row);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 10px;
    cursor: pointer;
    transition: all 0.15s;
}
.detail-doc-item:hover {
    border-color: var(--accent);
    background: var(--bg-table-row-hover);
}

.detail-doc-icon { font-size: 14px; }
.detail-doc-info { flex: 1; min-width: 0; }
.detail-doc-name {
    font-size: 11px;
    color: var(--accent);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.detail-doc-meta {
    font-size: 9px;
    color: var(--text-muted);
    margin-top: 1px;
}
.detail-doc-open { font-size: 10px; color: var(--text-muted); }
.detail-doc-delete {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
}
.detail-doc-delete:hover { color: var(--danger); }

.detail-upload-area {
    background: var(--accent-subtle);
    border: 1px dashed var(--border-focus);
    border-radius: var(--radius);
    padding: 14px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
}
.detail-upload-area:hover {
    background: rgba(59, 130, 246, 0.15);
}
.detail-upload-area.drag-over {
    background: rgba(59, 130, 246, 0.2);
    border-color: var(--accent);
}
.detail-upload-label {
    font-size: 11px;
    color: var(--accent);
}

.detail-panel-actions {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    margin-top: auto;
}

.detail-panel-actions .btn-success { flex: 1; justify-content: center; }
```

- [ ] Add mobile override inside the `@media (max-width: 768px)` block:

```css
    /* Detail panel: full-width on mobile */
    .task-detail-panel {
        width: 100%;
        border-left: none;
        border-top: 2px solid var(--accent);
    }
    .view-dashboard-with-panel .table-wrapper {
        margin-right: 0;
        display: none;
    }
    .view-dashboard-with-panel .stats-grid,
    .view-dashboard-with-panel .filter-bar {
        display: none;
    }
```

- [ ] Make `#view-dashboard` position relative (needed for absolute-positioned panel). Add to CSS:

```css
#view-dashboard {
    position: relative;
}
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: add task detail panel HTML and CSS"
```

---

## Task 3: Frontend — Detail pane JS + API integration

**Files:**
- Create: `app/static/js/detail-pane.js`
- Modify: `app/static/js/api.js`
- Modify: `app/static/js/dashboard.js`

### Step 3.1: Add API methods

- [ ] In `app/static/js/api.js`, add these methods before the closing `};`:

```javascript
    getTask: (id) => API.get(`/api/maintenance/tasks/${id}`),
    getTaskDocs: (taskId) => API.get(`/api/documentation?task_id=${taskId}`),
    async uploadFile(file) {
        const form = new FormData();
        form.append('file', file);
        const r = await fetch('/api/uploads', { method: 'POST', body: form });
        if (!r.ok) {
            const text = await r.text();
            throw new Error(`${r.status}: ${text}`);
        }
        return r.json();
    },
```

### Step 3.2: Create detail-pane.js

- [ ] Create `app/static/js/detail-pane.js`:

```javascript
const DetailPane = {
    panel: null,
    currentTask: null,
    dashboardData: null,

    init() {
        this.panel = document.getElementById('task-detail-panel');

        document.getElementById('detail-close').addEventListener('click', () => this.close());
        document.getElementById('detail-notes-edit').addEventListener('click', () => this.showNotesEditor());
        document.getElementById('detail-notes-save').addEventListener('click', () => this.saveNotes());
        document.getElementById('detail-notes-cancel').addEventListener('click', () => this.hideNotesEditor());
        document.getElementById('detail-complete-btn').addEventListener('click', () => this.completeTask());
        document.getElementById('detail-delete-btn').addEventListener('click', () => this.deleteTask());

        // File upload
        const uploadArea = document.getElementById('detail-upload-area');
        const fileInput = document.getElementById('detail-file-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.uploadFiles(e.target.files);
            fileInput.value = '';
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length) this.uploadFiles(e.dataTransfer.files);
        });
    },

    async open(taskId, dashboardData) {
        this.dashboardData = dashboardData;
        const taskRow = dashboardData?.tasks?.find(t => t.id === taskId);
        if (!taskRow) return;

        // Fetch full task for notes
        try {
            const fullTask = await API.getTask(taskId);
            this.currentTask = { ...taskRow, notes: fullTask.notes || '' };
        } catch {
            this.currentTask = { ...taskRow, notes: '' };
        }

        this.render();
        this.loadDocs();
        this.panel.classList.add('open');
        document.getElementById('view-dashboard').classList.add('view-dashboard-with-panel');
    },

    close() {
        this.panel.classList.remove('open');
        document.getElementById('view-dashboard').classList.remove('view-dashboard-with-panel');
        this.currentTask = null;
    },

    render() {
        const t = this.currentTask;
        if (!t) return;

        document.getElementById('detail-title').textContent = t.title;

        const pathParts = [t.factory_name, t.section_name, t.equipment_name, t.component_name].filter(Boolean);
        document.getElementById('detail-path').textContent = pathParts.join(' → ') || 'No equipment linked';

        // Badges
        const statusLabels = { overdue: 'Overdue', planned: 'Planned', completed: 'Completed' };
        const badges = document.getElementById('detail-badges');
        badges.innerHTML = `
            <span class="detail-badge detail-badge-${t.status}">${statusLabels[t.status] || t.status}</span>
            <span class="detail-badge detail-badge-due">Due: ${t.due_date ? Dashboard.formatDate(t.due_date) : '-'}</span>
            <span class="detail-badge detail-badge-type">${t.plan_id ? 'Plan' : 'Manual'}</span>
        `;

        // Description
        const desc = document.getElementById('detail-description');
        desc.textContent = t.description || 'No description';

        // Notes
        this.hideNotesEditor();
        const notesDisplay = document.getElementById('detail-notes-display');
        notesDisplay.textContent = t.notes || 'No notes yet';

        // Complete button visibility
        const completeBtn = document.getElementById('detail-complete-btn');
        completeBtn.style.display = t.status === 'completed' ? 'none' : '';
    },

    showNotesEditor() {
        document.getElementById('detail-notes-display').classList.add('hidden');
        document.getElementById('detail-notes-edit').classList.add('hidden');
        const editor = document.getElementById('detail-notes-editor');
        editor.classList.remove('hidden');
        const textarea = document.getElementById('detail-notes-textarea');
        textarea.value = this.currentTask?.notes || '';
        textarea.focus();
    },

    hideNotesEditor() {
        document.getElementById('detail-notes-display').classList.remove('hidden');
        document.getElementById('detail-notes-edit').classList.remove('hidden');
        document.getElementById('detail-notes-editor').classList.add('hidden');
    },

    async saveNotes() {
        if (!this.currentTask) return;
        const notes = document.getElementById('detail-notes-textarea').value;
        await API.updateTask(this.currentTask.id, { notes });
        this.currentTask.notes = notes;
        document.getElementById('detail-notes-display').textContent = notes || 'No notes yet';
        this.hideNotesEditor();
    },

    async loadDocs() {
        if (!this.currentTask) return;
        const docs = await API.getTaskDocs(this.currentTask.id);
        const list = document.getElementById('detail-docs-list');

        if (docs.length === 0) {
            list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);">No documents</div>';
            return;
        }

        list.innerHTML = docs.map(d => {
            const fileUrl = d.file_path ? `/api/uploads/${d.file_path}` : d.url;
            const size = '';
            return `
                <div class="detail-doc-item" data-url="${this.esc(fileUrl)}">
                    <span class="detail-doc-icon">📄</span>
                    <div class="detail-doc-info">
                        <div class="detail-doc-name">${this.esc(d.name)}</div>
                    </div>
                    <span class="detail-doc-open">↗</span>
                    <button class="detail-doc-delete" data-doc-id="${d.id}" title="Remove">✕</button>
                </div>
            `;
        }).join('');

        // Click to open file
        list.querySelectorAll('.detail-doc-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.detail-doc-delete')) return;
                window.open(item.dataset.url, '_blank');
            });
        });

        // Delete doc
        list.querySelectorAll('.detail-doc-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await API.deleteDoc(parseInt(btn.dataset.docId));
                this.loadDocs();
            });
        });
    },

    async uploadFiles(files) {
        if (!this.currentTask) return;
        for (const file of files) {
            try {
                const uploaded = await API.uploadFile(file);
                await API.createDoc({
                    name: file.name,
                    url: uploaded.url,
                    file_path: uploaded.filename,
                    task_id: this.currentTask.id,
                });
            } catch (e) {
                console.error('Upload failed:', e);
            }
        }
        this.loadDocs();
    },

    async completeTask() {
        if (!this.currentTask) return;
        await API.updateTask(this.currentTask.id, { status: 'completed' });
        this.close();
        Dashboard.load();
    },

    async deleteTask() {
        if (!this.currentTask) return;
        await API.deleteTask(this.currentTask.id);
        this.close();
        Dashboard.load();
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
```

### Step 3.3: Add row click handler to dashboard.js

- [ ] In `app/static/js/dashboard.js`, in the `renderTable` method, after the `tbody.querySelectorAll('[data-action]').forEach(...)` block, add row click listeners:

```javascript
        // Row click opens detail panel
        tbody.querySelectorAll('tr').forEach(row => {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                if (e.target.closest('[data-action]')) return;
                const taskId = row.querySelector('[data-id]')?.dataset.id;
                if (taskId) {
                    DetailPane.open(parseInt(taskId), Dashboard.data);
                }
            });
        });
```

### Step 3.4: Initialize DetailPane in app.js

- [ ] In `app/static/js/app.js`, add `DetailPane.init();` after `Detail.init();`:

```javascript
    DetailPane.init();
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: add detail pane JS with notes editing and file upload"
```

---

## Task 4: Playwright e2e tests for detail pane

**Files:**
- Create: `tests/e2e/detail-pane.spec.js`

### Step 4.1: Write detail pane e2e tests

- [ ] Create `tests/e2e/detail-pane.spec.js`:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Task detail pane', () => {

  // Create test data via API before tests
  test.beforeEach(async ({ page }) => {
    // Create a factory > section > equipment > task
    const f = await (await page.request.post('/api/factories', { data: { name: 'TestFactory' } })).json();
    const s = await (await page.request.post('/api/sections', { data: { name: 'TestSection', factory_id: f.id } })).json();
    const e = await (await page.request.post('/api/equipment', { data: { name: 'TestEquip', section_id: s.id } })).json();
    await page.request.post('/api/maintenance/tasks', {
      data: { title: 'Test Task 1', description: 'Test description', due_date: '2026-04-01', equipment_id: e.id }
    });
    await page.goto('/');
    await page.waitForSelector('.stats-grid');
  });

  test('clicking a task row opens the detail panel', async ({ page }) => {
    const row = page.locator('#task-tbody tr').first();
    await row.click();

    const panel = page.locator('#task-detail-panel');
    await expect(panel).toHaveClass(/open/);
    await expect(page.locator('#detail-title')).not.toBeEmpty();
  });

  test('close button closes the panel', async ({ page }) => {
    await page.locator('#task-tbody tr').first().click();
    await expect(page.locator('#task-detail-panel')).toHaveClass(/open/);

    await page.click('#detail-close');
    await expect(page.locator('#task-detail-panel')).not.toHaveClass(/open/);
  });

  test('notes can be edited and saved', async ({ page }) => {
    await page.locator('#task-tbody tr').first().click();
    await expect(page.locator('#task-detail-panel')).toHaveClass(/open/);

    await page.click('#detail-notes-edit');
    await expect(page.locator('#detail-notes-editor')).toBeVisible();

    await page.fill('#detail-notes-textarea', 'Test note content');
    await page.click('#detail-notes-save');

    await expect(page.locator('#detail-notes-display')).toContainText('Test note content');
    await expect(page.locator('#detail-notes-editor')).not.toBeVisible();
  });

  test('file upload area is visible', async ({ page }) => {
    await page.locator('#task-tbody tr').first().click();
    await expect(page.locator('#detail-upload-area')).toBeVisible();
  });

  test('complete button marks task as done', async ({ page }) => {
    await page.locator('#task-tbody tr').first().click();
    await page.click('#detail-complete-btn');

    // Panel should close
    await expect(page.locator('#task-detail-panel')).not.toHaveClass(/open/);
  });

  test('panel shows task metadata', async ({ page }) => {
    await page.locator('#task-tbody tr').first().click();

    await expect(page.locator('#detail-title')).toContainText('Test Task 1');
    await expect(page.locator('#detail-description')).toContainText('Test description');
    await expect(page.locator('#detail-path')).toContainText('TestFactory');
    await expect(page.locator('#detail-badges')).toContainText('Planned');
  });
});
```

- [ ] Run Playwright tests:

```bash
npx playwright test tests/e2e/detail-pane.spec.js --reporter=list
```

Expected: All pass.

- [ ] Commit:

```bash
git add -A && git commit -m "test: add Playwright e2e tests for task detail pane"
```

---

## Task 5: Final verification

- [ ] Run all backend tests: `pytest tests/ -v`
- [ ] Run all Playwright tests: `npx playwright test --reporter=list`
- [ ] Manual smoke test: open http://localhost:8000, click a task, verify panel slides in, edit notes, upload a file, click to open it
- [ ] Final commit if any fixes needed
