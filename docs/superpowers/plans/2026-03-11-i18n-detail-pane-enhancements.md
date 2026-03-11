# i18n + Enhanced Detail Pane Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add English/German internationalization (UI + database records), enhance the task detail pane with metadata controls/checklist/activity log, and add a visual tree breadcrumb.

**Architecture:** New `translations`, `task_checklist_items`, and `task_activity_log` tables in SQLite. A frontend `i18n.js` module holds all UI strings with a `t()` lookup function. A `TranslationCache` object fetches and caches database record translations. The detail pane gets new sections for metadata editing, checklist management, and activity viewing.

**Tech Stack:** Python/FastAPI/SQLAlchemy (backend), vanilla JS/CSS (frontend), SQLite (database)

---

## Chunk 1: Backend — Models, Migrations, and APIs

### Task 1: Add new database models and migrate existing tables

**Files:**
- Modify: `app/models.py`
- Modify: `app/schemas.py`
- Create: `app/migrate.py`
- Test: `tests/test_models.py`

**Context:** The app uses SQLAlchemy with SQLite stored at `data/maintenance.db`. There are no Alembic migrations — schema changes are done via `Base.metadata.create_all()` in `app/database.py` for new tables, and manual `ALTER TABLE` for existing ones. The previous migration (adding `file_path` and `task_id` to documentation) was done manually. This task follows the same pattern.

- [ ] **Step 1: Add new models to `app/models.py`**

Add these three new model classes after the existing `MaintenancePlan` class:

```python
class Translation(Base):
    __tablename__ = "translations"
    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)
    field_name = Column(String(50), nullable=False)
    lang = Column(String(10), nullable=False)
    value = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "field_name", "lang", name="uq_translation"),
    )


class TaskChecklistItem(Base):
    __tablename__ = "task_checklist_items"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("maintenance_tasks.id", ondelete="CASCADE"), nullable=False)
    text = Column(String(500), nullable=False)
    is_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("MaintenanceTask", back_populates="checklist_items")


class TaskActivityLog(Base):
    __tablename__ = "task_activity_log"
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("maintenance_tasks.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    detail = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    task = relationship("MaintenanceTask", back_populates="activity_log")
```

Also add the import for `UniqueConstraint`:
```python
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey, UniqueConstraint
```

Add new fields to `MaintenanceTask`:
```python
    priority = Column(String(20), default="medium")
    assignee = Column(String(200), nullable=True)
    estimated_minutes = Column(Integer, nullable=True)
```

Add new relationships to `MaintenanceTask`:
```python
    checklist_items = relationship("TaskChecklistItem", back_populates="task", cascade="all, delete-orphan")
    activity_log = relationship("TaskActivityLog", back_populates="task", cascade="all, delete-orphan")
```

- [ ] **Step 2: Add new Pydantic schemas to `app/schemas.py`**

Add these schemas at the end of the file:

```python
# --- Translation ---
class TranslationUpsert(BaseModel):
    entity_type: str
    entity_id: int
    field_name: str
    lang: str
    value: str

class TranslationOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    field_name: str
    lang: str
    value: str
    model_config = {"from_attributes": True}


# --- TaskChecklistItem ---
class ChecklistItemCreate(BaseModel):
    text: str

class ChecklistItemUpdate(BaseModel):
    text: str | None = None
    is_completed: bool | None = None

class ChecklistItemOut(BaseModel):
    id: int
    task_id: int
    text: str
    is_completed: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# --- TaskActivityLog ---
class ActivityLogOut(BaseModel):
    id: int
    task_id: int
    action: str
    detail: str
    created_at: datetime
    model_config = {"from_attributes": True}
```

Update `MaintenanceTaskCreate` to include new optional fields:
```python
class MaintenanceTaskCreate(BaseModel):
    title: str
    description: str = ""
    due_date: date
    priority: str = "medium"
    assignee: str | None = None
    estimated_minutes: int | None = None
    equipment_id: int | None = None
    component_id: int | None = None
```

Update `MaintenanceTaskUpdate` to include new optional fields:
```python
class MaintenanceTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    status: str | None = None
    notes: str | None = None
    priority: str | None = None
    assignee: str | None = None
    estimated_minutes: int | None = None
```

Update `MaintenanceTaskOut` to include new fields:
```python
class MaintenanceTaskOut(BaseModel):
    id: int
    title: str
    description: str
    due_date: date
    status: str
    notes: str
    priority: str
    assignee: str | None
    estimated_minutes: int | None
    equipment_id: int | None
    component_id: int | None
    plan_id: int | None
    created_at: datetime
    completed_at: datetime | None
    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Create migration script `app/migrate.py`**

This script adds columns to existing tables and creates new tables. It is idempotent (safe to run multiple times).

```python
"""Database migration: add i18n, checklist, activity log, and task fields."""
from sqlalchemy import text
from app.database import engine, Base
from app.models import Translation, TaskChecklistItem, TaskActivityLog


def migrate():
    # Create new tables
    Base.metadata.create_all(bind=engine, tables=[
        Translation.__table__,
        TaskChecklistItem.__table__,
        TaskActivityLog.__table__,
    ])

    with engine.connect() as conn:
        # Check existing columns on maintenance_tasks
        result = conn.execute(text("PRAGMA table_info(maintenance_tasks)"))
        existing_cols = {row[1] for row in result}

        if "priority" not in existing_cols:
            conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN priority VARCHAR(20) DEFAULT 'medium'"))
        if "assignee" not in existing_cols:
            conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN assignee VARCHAR(200)"))
        if "estimated_minutes" not in existing_cols:
            conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN estimated_minutes INTEGER"))
        conn.commit()

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
```

- [ ] **Step 4: Run migration**

```bash
cd /home/anton/Projects/MaitenanceManager
source .venv/bin/activate
python -m app.migrate
```

Expected: "Migration complete." with no errors.

- [ ] **Step 5: Write tests for new models**

Create `tests/test_models.py`:

```python
import pytest
from app.database import Base, engine, SessionLocal
from app.models import Translation, TaskChecklistItem, TaskActivityLog, MaintenanceTask


@pytest.fixture(autouse=True)
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


def test_translation_model(db):
    t = Translation(entity_type="factory", entity_id=1, field_name="name", lang="de", value="Fabrik")
    db.add(t)
    db.flush()
    assert t.id is not None
    assert t.entity_type == "factory"
    assert t.lang == "de"


def test_checklist_item_model(db):
    task = db.query(MaintenanceTask).first()
    if not task:
        pytest.skip("No tasks in DB")
    item = TaskChecklistItem(task_id=task.id, text="Check oil level")
    db.add(item)
    db.flush()
    assert item.id is not None
    assert item.is_completed == 0


def test_activity_log_model(db):
    task = db.query(MaintenanceTask).first()
    if not task:
        pytest.skip("No tasks in DB")
    log = TaskActivityLog(task_id=task.id, action="status_changed", detail="planned → completed")
    db.add(log)
    db.flush()
    assert log.id is not None
```

- [ ] **Step 6: Run tests**

```bash
source .venv/bin/activate && pytest tests/test_models.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/models.py app/schemas.py app/migrate.py tests/test_models.py
git commit -m "feat: add Translation, TaskChecklistItem, TaskActivityLog models and task fields"
```

---

### Task 2: Translations API router

**Files:**
- Create: `app/routers/translations.py`
- Modify: `app/main.py` (register router)
- Test: `tests/test_translations.py`

**Context:** The existing routers follow a pattern: `APIRouter(prefix="/api/...", tags=[...])` with CRUD functions. `app/main.py` imports each router and calls `app.include_router(router)`. Check `app/routers/factories.py` and `app/main.py` for the pattern.

- [ ] **Step 1: Create `app/routers/translations.py`**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Translation
from app.schemas import TranslationUpsert, TranslationOut

router = APIRouter(prefix="/api/translations", tags=["translations"])


@router.get("", response_model=list[TranslationOut])
def list_translations(
    entity_type: str = Query(...),
    entity_id: int | None = Query(None),
    lang: str = Query(...),
    db: Session = Depends(get_db),
):
    q = db.query(Translation).filter(
        Translation.entity_type == entity_type,
        Translation.lang == lang,
    )
    if entity_id is not None:
        q = q.filter(Translation.entity_id == entity_id)
    return q.all()


@router.get("/batch", response_model=list[TranslationOut])
def batch_translations(
    entity_type: str = Query(...),
    lang: str = Query(...),
    db: Session = Depends(get_db),
):
    return (
        db.query(Translation)
        .filter(Translation.entity_type == entity_type, Translation.lang == lang)
        .all()
    )


@router.put("", response_model=TranslationOut)
def upsert_translation(data: TranslationUpsert, db: Session = Depends(get_db)):
    existing = (
        db.query(Translation)
        .filter(
            Translation.entity_type == data.entity_type,
            Translation.entity_id == data.entity_id,
            Translation.field_name == data.field_name,
            Translation.lang == data.lang,
        )
        .first()
    )
    if existing:
        existing.value = data.value
        db.commit()
        db.refresh(existing)
        return existing
    else:
        t = Translation(**data.model_dump())
        db.add(t)
        db.commit()
        db.refresh(t)
        return t
```

- [ ] **Step 2: Register router in `app/main.py`**

Add this import alongside the other router imports:
```python
from app.routers import translations
```

Add this line alongside the other `app.include_router(...)` calls:
```python
app.include_router(translations.router)
```

- [ ] **Step 3: Write tests — create `tests/test_translations.py`**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_upsert_and_get_translation():
    # Create
    r = client.put("/api/translations", json={
        "entity_type": "factory", "entity_id": 999, "field_name": "name",
        "lang": "de", "value": "Testfabrik"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["value"] == "Testfabrik"
    tid = data["id"]

    # Update (upsert same key)
    r = client.put("/api/translations", json={
        "entity_type": "factory", "entity_id": 999, "field_name": "name",
        "lang": "de", "value": "Testfabrik Aktualisiert"
    })
    assert r.status_code == 200
    assert r.json()["id"] == tid
    assert r.json()["value"] == "Testfabrik Aktualisiert"

    # Get
    r = client.get("/api/translations", params={
        "entity_type": "factory", "entity_id": 999, "lang": "de"
    })
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert items[0]["value"] == "Testfabrik Aktualisiert"

    # Cleanup
    from app.database import SessionLocal
    from app.models import Translation
    db = SessionLocal()
    db.query(Translation).filter(Translation.entity_id == 999).delete()
    db.commit()
    db.close()


def test_batch_translations():
    # Create two translations
    for eid in [997, 998]:
        client.put("/api/translations", json={
            "entity_type": "factory", "entity_id": eid, "field_name": "name",
            "lang": "de", "value": f"Fabrik {eid}"
        })

    r = client.get("/api/translations/batch", params={
        "entity_type": "factory", "lang": "de"
    })
    assert r.status_code == 200
    items = r.json()
    ids = {i["entity_id"] for i in items}
    assert 997 in ids
    assert 998 in ids

    # Cleanup
    from app.database import SessionLocal
    from app.models import Translation
    db = SessionLocal()
    db.query(Translation).filter(Translation.entity_id.in_([997, 998])).delete()
    db.commit()
    db.close()
```

- [ ] **Step 4: Run tests**

```bash
source .venv/bin/activate && pytest tests/test_translations.py -v
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/translations.py app/main.py tests/test_translations.py
git commit -m "feat: add translations API router with upsert and batch endpoints"
```

---

### Task 3: Checklist API router

**Files:**
- Create: `app/routers/checklist.py`
- Modify: `app/main.py` (register router)
- Test: `tests/test_checklist.py`

**Context:** Checklist endpoints are nested under tasks: `/api/maintenance/tasks/{task_id}/checklist`. This follows the existing pattern in `app/routers/maintenance.py`. When checklist items are added/toggled/removed, the backend should also log to the activity log.

- [ ] **Step 1: Create `app/routers/checklist.py`**

```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TaskChecklistItem, TaskActivityLog, MaintenanceTask
from app.schemas import ChecklistItemCreate, ChecklistItemUpdate, ChecklistItemOut

router = APIRouter(prefix="/api/maintenance/tasks/{task_id}/checklist", tags=["checklist"])


def _get_task(task_id: int, db: Session):
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return task


def _log(db: Session, task_id: int, action: str, detail: str = ""):
    db.add(TaskActivityLog(task_id=task_id, action=action, detail=detail))


@router.get("", response_model=list[ChecklistItemOut])
def list_checklist(task_id: int, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    return db.query(TaskChecklistItem).filter(TaskChecklistItem.task_id == task_id).order_by(TaskChecklistItem.created_at).all()


@router.post("", response_model=ChecklistItemOut)
def add_checklist_item(task_id: int, data: ChecklistItemCreate, db: Session = Depends(get_db)):
    _get_task(task_id, db)
    item = TaskChecklistItem(task_id=task_id, text=data.text)
    db.add(item)
    _log(db, task_id, "checklist_added", data.text)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=ChecklistItemOut)
def update_checklist_item(task_id: int, item_id: int, data: ChecklistItemUpdate, db: Session = Depends(get_db)):
    item = db.query(TaskChecklistItem).filter(
        TaskChecklistItem.id == item_id, TaskChecklistItem.task_id == task_id
    ).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")

    if data.is_completed is not None:
        old_val = bool(item.is_completed)
        item.is_completed = int(data.is_completed)
        if data.is_completed and not old_val:
            _log(db, task_id, "checklist_completed", item.text)
    if data.text is not None:
        item.text = data.text

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}")
def delete_checklist_item(task_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.query(TaskChecklistItem).filter(
        TaskChecklistItem.id == item_id, TaskChecklistItem.task_id == task_id
    ).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")
    _log(db, task_id, "checklist_removed", item.text)
    db.delete(item)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 2: Register router in `app/main.py`**

Add import:
```python
from app.routers import checklist
```

Add:
```python
app.include_router(checklist.router)
```

- [ ] **Step 3: Write tests — create `tests/test_checklist.py`**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def task_id():
    """Create a temporary task for testing."""
    r = client.post("/api/maintenance/tasks", json={
        "title": "Checklist Test Task", "due_date": "2026-12-01"
    })
    tid = r.json()["id"]
    yield tid
    client.delete(f"/api/maintenance/tasks/{tid}")


def test_add_and_list_checklist(task_id):
    r = client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Check oil"})
    assert r.status_code == 200
    item = r.json()
    assert item["text"] == "Check oil"
    assert item["is_completed"] is False

    r = client.get(f"/api/maintenance/tasks/{task_id}/checklist")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_toggle_checklist_item(task_id):
    r = client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Replace filter"})
    item_id = r.json()["id"]

    r = client.put(f"/api/maintenance/tasks/{task_id}/checklist/{item_id}", json={"is_completed": True})
    assert r.status_code == 200
    assert r.json()["is_completed"] is True


def test_delete_checklist_item(task_id):
    r = client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Temp item"})
    item_id = r.json()["id"]

    r = client.delete(f"/api/maintenance/tasks/{task_id}/checklist/{item_id}")
    assert r.status_code == 200

    r = client.get(f"/api/maintenance/tasks/{task_id}/checklist")
    assert len(r.json()) == 0


def test_checklist_creates_activity_log(task_id):
    client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Logged item"})

    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "checklist_added" for e in entries)
```

- [ ] **Step 4: Run tests**

```bash
source .venv/bin/activate && pytest tests/test_checklist.py -v
```

Expected: All 4 tests PASS (note: `test_checklist_creates_activity_log` depends on Task 4's activity endpoint — if running before Task 4, it will fail on the activity GET. You may implement Tasks 3 and 4 together).

- [ ] **Step 5: Commit**

```bash
git add app/routers/checklist.py app/main.py tests/test_checklist.py
git commit -m "feat: add checklist CRUD API with activity logging"
```

---

### Task 4: Activity log API and auto-logging in task updates

**Files:**
- Create: `app/routers/activity.py`
- Modify: `app/routers/maintenance.py` (add activity logging to create/update task)
- Modify: `app/main.py` (register router)
- Test: `tests/test_activity.py`

**Context:** Activity log entries are created automatically when task fields change. The `update_task` endpoint in `app/routers/maintenance.py:37-49` needs to detect field changes and log them. The `create_task` endpoint at line 22-28 should log "task_created". Check the existing update logic — it uses `data.model_dump(exclude_unset=True)` to get only changed fields.

- [ ] **Step 1: Create `app/routers/activity.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import TaskActivityLog, MaintenanceTask
from app.schemas import ActivityLogOut

router = APIRouter(prefix="/api/maintenance/tasks/{task_id}/activity", tags=["activity"])


@router.get("", response_model=list[ActivityLogOut])
def list_activity(task_id: int, db: Session = Depends(get_db)):
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return (
        db.query(TaskActivityLog)
        .filter(TaskActivityLog.task_id == task_id)
        .order_by(TaskActivityLog.created_at.desc())
        .all()
    )
```

- [ ] **Step 2: Add activity logging to `app/routers/maintenance.py`**

Add import at the top:
```python
from app.models import MaintenanceTask, MaintenancePlan, Equipment, Component, Section, Factory, TaskActivityLog
```

Modify `create_task` (line 22-28) to log creation:
```python
@router.post("/tasks", response_model=MaintenanceTaskOut)
def create_task(data: MaintenanceTaskCreate, db: Session = Depends(get_db)):
    task = MaintenanceTask(**data.model_dump())
    db.add(task)
    db.flush()
    db.add(TaskActivityLog(task_id=task.id, action="task_created", detail=task.title))
    db.commit()
    db.refresh(task)
    return task
```

Modify `update_task` (line 37-49) to detect and log changes:
```python
@router.put("/tasks/{task_id}", response_model=MaintenanceTaskOut)
def update_task(task_id: int, data: MaintenanceTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    update = data.model_dump(exclude_unset=True)

    # Track changes for activity log
    tracked_fields = ["status", "priority", "assignee", "notes", "estimated_minutes", "due_date"]
    for field in tracked_fields:
        if field in update:
            old_val = getattr(task, field)
            new_val = update[field]
            if old_val != new_val:
                if field == "notes":
                    db.add(TaskActivityLog(task_id=task_id, action="notes_edited", detail=""))
                elif field == "due_date":
                    db.add(TaskActivityLog(task_id=task_id, action="due_date_changed", detail=f"{old_val} → {new_val}"))
                else:
                    db.add(TaskActivityLog(task_id=task_id, action=f"{field}_changed", detail=f"{old_val} → {new_val}"))

    if update.get("status") == "completed" and task.status != "completed":
        update["completed_at"] = datetime.utcnow()
    for key, val in update.items():
        setattr(task, key, val)
    db.commit()
    db.refresh(task)
    return task
```

- [ ] **Step 3: Register router in `app/main.py`**

Add import:
```python
from app.routers import activity
```

Add:
```python
app.include_router(activity.router)
```

- [ ] **Step 4: Write tests — create `tests/test_activity.py`**

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def task_id():
    r = client.post("/api/maintenance/tasks", json={
        "title": "Activity Test Task", "due_date": "2026-12-01"
    })
    tid = r.json()["id"]
    yield tid
    client.delete(f"/api/maintenance/tasks/{tid}")


def test_task_created_logged(task_id):
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    assert r.status_code == 200
    entries = r.json()
    assert any(e["action"] == "task_created" for e in entries)


def test_status_change_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"status": "completed"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "status_changed" for e in entries)


def test_priority_change_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"priority": "high"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "priority_changed" for e in entries)


def test_assignee_change_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"assignee": "John"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "assignee_changed" for e in entries)


def test_notes_edit_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"notes": "Updated notes"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "notes_edited" for e in entries)
```

- [ ] **Step 5: Run tests**

```bash
source .venv/bin/activate && pytest tests/test_activity.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/routers/activity.py app/routers/maintenance.py app/main.py tests/test_activity.py
git commit -m "feat: add activity log API with automatic change tracking"
```

---

### Task 5: Update dashboard API to include new task fields

**Files:**
- Modify: `app/routers/maintenance.py` (dashboard_data function, lines 137-210)

**Context:** The dashboard endpoint builds task rows manually as dicts. It needs to include the new `priority`, `assignee`, and `estimated_minutes` fields so the frontend detail pane can display them.

- [ ] **Step 1: Update the `rows.append(...)` block in `dashboard_data`**

In `app/routers/maintenance.py`, find the `rows.append({...})` block (around line 175-190) and add these three fields:

```python
            "priority": t.priority or "medium",
            "assignee": t.assignee or "",
            "estimated_minutes": t.estimated_minutes,
```

Add them after the `"completed_at"` line.

- [ ] **Step 2: Verify manually**

```bash
source .venv/bin/activate && curl -s http://localhost:8000/api/maintenance/dashboard | python3 -m json.tool | head -30
```

Expected: Task objects now include `priority`, `assignee`, `estimated_minutes` fields.

- [ ] **Step 3: Commit**

```bash
git add app/routers/maintenance.py
git commit -m "feat: include priority, assignee, estimated_minutes in dashboard API"
```

---

## Chunk 2: Frontend — i18n Module and UI Translations

### Task 6: Create the i18n JavaScript module

**Files:**
- Create: `app/static/js/i18n.js`

**Context:** This module is loaded first (before all other JS). It provides a `t('key.path')` function that all other modules call to get translated strings. Language is stored in `localStorage` as `'lang'`. The module also provides `getDateLocale()` for date formatting.

- [ ] **Step 1: Create `app/static/js/i18n.js`**

```javascript
const I18n = {
    currentLang: localStorage.getItem('lang') || 'en',

    strings: {
        en: {
            // Nav
            nav_dashboard: 'Dashboard',
            nav_equipment: 'Equipment',
            nav_tasks: 'Tasks',
            nav_plans: 'Plans',

            // Dashboard
            dashboard_title: 'Dashboard',
            stat_total: 'Total Tasks',
            stat_overdue: 'Overdue',
            stat_planned: 'Planned',
            stat_completed: 'Completed',
            stat_equipment: 'Equipment',
            stat_plans: 'Maint. Plans',
            filter_all_tasks: 'All tasks',
            filter_all_statuses: 'All statuses',
            filter_overdue: 'Overdue',
            filter_planned: 'Planned',
            filter_completed: 'Completed',
            search_placeholder: 'Search tasks...',
            no_tasks: 'No tasks to display',
            records_of: 'of',
            records_label: 'records',

            // Table headers
            th_title: 'Title',
            th_plant: 'Plant',
            th_section: 'Section',
            th_equipment: 'Equipment',
            th_component: 'Component',
            th_type: 'Type',
            th_due_date: 'Due Date',
            th_status: 'Status',
            th_actions: 'Actions',
            th_interval: 'Interval (days)',
            th_last_completed: 'Last Completed',
            th_next_due: 'Next Due',

            // Status labels
            status_overdue: 'Overdue',
            status_planned: 'Planned',
            status_completed: 'Done',
            status_in_progress: 'In Progress',

            // Type labels
            type_plan: 'Plan',
            type_manual: 'Manual',

            // Buttons
            btn_new_task: 'New Task',
            btn_new_plan: 'New Plan',
            btn_new_plant: 'New Plant',
            btn_save: 'Save',
            btn_cancel: 'Cancel',
            btn_delete: 'Delete',
            btn_edit: 'Edit',
            btn_complete: 'Complete',
            btn_add: 'Add',
            btn_close: 'Close',

            // Detail pane
            detail_description: 'Description',
            detail_notes: 'Notes',
            detail_documents: 'Documents',
            detail_checklist: 'Checklist',
            detail_activity: 'Activity',
            detail_no_description: 'No description',
            detail_no_notes: 'No notes yet',
            detail_no_docs: 'No documents',
            detail_no_equipment: 'No equipment linked',
            detail_upload: 'Drop files or click to upload',
            detail_priority: 'Priority',
            detail_assignee: 'Assignee',
            detail_unassigned: 'Unassigned',
            detail_due_date: 'Due Date',
            detail_estimated: 'Est. Duration',
            detail_plan_info: 'Plan Info',
            detail_add_item: 'Add item...',
            detail_completed_of: 'completed',
            detail_never: 'Never',

            // Priority
            priority_low: 'Low',
            priority_medium: 'Medium',
            priority_high: 'High',
            priority_critical: 'Critical',

            // Activity actions
            activity_task_created: 'Task created',
            activity_status_changed: 'Status changed',
            activity_priority_changed: 'Priority changed',
            activity_assignee_changed: 'Assignee changed',
            activity_notes_edited: 'Notes edited',
            activity_due_date_changed: 'Due date changed',
            activity_estimated_minutes_changed: 'Duration changed',
            activity_checklist_added: 'Checklist item added',
            activity_checklist_completed: 'Checklist item completed',
            activity_checklist_removed: 'Checklist item removed',
            activity_file_uploaded: 'File uploaded',
            activity_file_removed: 'File removed',

            // Modals
            modal_new_section: 'New Section',
            modal_new_equipment: 'New Equipment',
            modal_new_component: 'New Component',
            modal_edit_plant: 'Edit Plant',
            modal_edit_section: 'Edit Section',
            modal_edit_equipment: 'Edit Equipment',
            modal_edit_component: 'Edit Component',
            modal_new_task: 'New Maintenance Task',
            modal_new_plan: 'New Maintenance Plan',
            modal_add_doc: 'Add Documentation',
            modal_confirmation: 'Confirmation',
            modal_none: '-- None --',

            // Field labels
            field_name: 'Name',
            field_name_en: 'Name (EN)',
            field_name_de: 'Name (DE)',
            field_description: 'Description',
            field_description_en: 'Description (EN)',
            field_description_de: 'Description (DE)',
            field_title: 'Title',
            field_title_en: 'Title (EN)',
            field_title_de: 'Title (DE)',
            field_url: 'URL',
            field_due_date: 'Due Date',
            field_equipment: 'Equipment',
            field_interval: 'Interval (days)',
            field_first_due: 'First Due Date',

            // Confirm messages
            confirm_delete_plant: 'Delete plant "{name}" and everything in it?',
            confirm_delete_section: 'Delete section "{name}" and everything in it?',
            confirm_delete_equipment: 'Delete equipment "{name}" and everything in it?',
            confirm_delete_component: 'Delete component "{name}"?',
            confirm_delete_task: 'Delete this task?',

            // Equipment view
            equipment_title: 'Equipment Tree',
            equipment_empty: 'Select an item from the tree or add a new plant.',
            plans_title: 'Maintenance Plans',
            tasks_title: 'All Maintenance Tasks',

            // Detail view
            detail_type_plant: 'Type: Plant',
            detail_type_section: 'Type: Section',
            detail_no_documentation: 'No documentation',
            detail_no_tasks: 'No tasks',
            detail_no_plans: 'No plans',
            detail_documentation: 'Documentation',
            detail_maintenance_tasks: 'Maintenance Tasks',
            detail_maintenance_plans: 'Maintenance Plans',
            detail_every_days: 'Every {days} days | Next: {date}',

            // Theme
            theme_light: 'Light theme',
            theme_dark: 'Dark theme',

            // Misc
            error_prefix: 'Error: ',
            loading: 'Loading...',
            version: 'v1.0',
        },

        de: {
            // Nav
            nav_dashboard: 'Dashboard',
            nav_equipment: 'Ausrüstung',
            nav_tasks: 'Aufgaben',
            nav_plans: 'Pläne',

            // Dashboard
            dashboard_title: 'Dashboard',
            stat_total: 'Aufgaben gesamt',
            stat_overdue: 'Überfällig',
            stat_planned: 'Geplant',
            stat_completed: 'Erledigt',
            stat_equipment: 'Ausrüstung',
            stat_plans: 'Wartungspläne',
            filter_all_tasks: 'Alle Aufgaben',
            filter_all_statuses: 'Alle Status',
            filter_overdue: 'Überfällig',
            filter_planned: 'Geplant',
            filter_completed: 'Erledigt',
            search_placeholder: 'Aufgaben suchen...',
            no_tasks: 'Keine Aufgaben vorhanden',
            records_of: 'von',
            records_label: 'Einträge',

            // Table headers
            th_title: 'Titel',
            th_plant: 'Werk',
            th_section: 'Abteilung',
            th_equipment: 'Ausrüstung',
            th_component: 'Komponente',
            th_type: 'Typ',
            th_due_date: 'Fälligkeitsdatum',
            th_status: 'Status',
            th_actions: 'Aktionen',
            th_interval: 'Intervall (Tage)',
            th_last_completed: 'Zuletzt erledigt',
            th_next_due: 'Nächste Fälligkeit',

            // Status labels
            status_overdue: 'Überfällig',
            status_planned: 'Geplant',
            status_completed: 'Erledigt',
            status_in_progress: 'In Bearbeitung',

            // Type labels
            type_plan: 'Plan',
            type_manual: 'Manuell',

            // Buttons
            btn_new_task: 'Neue Aufgabe',
            btn_new_plan: 'Neuer Plan',
            btn_new_plant: 'Neues Werk',
            btn_save: 'Speichern',
            btn_cancel: 'Abbrechen',
            btn_delete: 'Löschen',
            btn_edit: 'Bearbeiten',
            btn_complete: 'Erledigen',
            btn_add: 'Hinzufügen',
            btn_close: 'Schließen',

            // Detail pane
            detail_description: 'Beschreibung',
            detail_notes: 'Notizen',
            detail_documents: 'Dokumente',
            detail_checklist: 'Checkliste',
            detail_activity: 'Aktivität',
            detail_no_description: 'Keine Beschreibung',
            detail_no_notes: 'Noch keine Notizen',
            detail_no_docs: 'Keine Dokumente',
            detail_no_equipment: 'Keine Ausrüstung verknüpft',
            detail_upload: 'Dateien ablegen oder klicken zum Hochladen',
            detail_priority: 'Priorität',
            detail_assignee: 'Zuständig',
            detail_unassigned: 'Nicht zugewiesen',
            detail_due_date: 'Fälligkeitsdatum',
            detail_estimated: 'Geschätzte Dauer',
            detail_plan_info: 'Planinfo',
            detail_add_item: 'Element hinzufügen...',
            detail_completed_of: 'erledigt',
            detail_never: 'Nie',

            // Priority
            priority_low: 'Niedrig',
            priority_medium: 'Mittel',
            priority_high: 'Hoch',
            priority_critical: 'Kritisch',

            // Activity actions
            activity_task_created: 'Aufgabe erstellt',
            activity_status_changed: 'Status geändert',
            activity_priority_changed: 'Priorität geändert',
            activity_assignee_changed: 'Zuständiger geändert',
            activity_notes_edited: 'Notizen bearbeitet',
            activity_due_date_changed: 'Fälligkeitsdatum geändert',
            activity_estimated_minutes_changed: 'Dauer geändert',
            activity_checklist_added: 'Checklistenpunkt hinzugefügt',
            activity_checklist_completed: 'Checklistenpunkt erledigt',
            activity_checklist_removed: 'Checklistenpunkt entfernt',
            activity_file_uploaded: 'Datei hochgeladen',
            activity_file_removed: 'Datei entfernt',

            // Modals
            modal_new_section: 'Neue Abteilung',
            modal_new_equipment: 'Neue Ausrüstung',
            modal_new_component: 'Neue Komponente',
            modal_edit_plant: 'Werk bearbeiten',
            modal_edit_section: 'Abteilung bearbeiten',
            modal_edit_equipment: 'Ausrüstung bearbeiten',
            modal_edit_component: 'Komponente bearbeiten',
            modal_new_task: 'Neue Wartungsaufgabe',
            modal_new_plan: 'Neuer Wartungsplan',
            modal_add_doc: 'Dokumentation hinzufügen',
            modal_confirmation: 'Bestätigung',
            modal_none: '-- Keine --',

            // Field labels
            field_name: 'Name',
            field_name_en: 'Name (EN)',
            field_name_de: 'Name (DE)',
            field_description: 'Beschreibung',
            field_description_en: 'Beschreibung (EN)',
            field_description_de: 'Beschreibung (DE)',
            field_title: 'Titel',
            field_title_en: 'Titel (EN)',
            field_title_de: 'Titel (DE)',
            field_url: 'URL',
            field_due_date: 'Fälligkeitsdatum',
            field_equipment: 'Ausrüstung',
            field_interval: 'Intervall (Tage)',
            field_first_due: 'Erstes Fälligkeitsdatum',

            // Confirm messages
            confirm_delete_plant: 'Werk "{name}" und alles darin löschen?',
            confirm_delete_section: 'Abteilung "{name}" und alles darin löschen?',
            confirm_delete_equipment: 'Ausrüstung "{name}" und alles darin löschen?',
            confirm_delete_component: 'Komponente "{name}" löschen?',
            confirm_delete_task: 'Diese Aufgabe löschen?',

            // Equipment view
            equipment_title: 'Ausrüstungsbaum',
            equipment_empty: 'Wählen Sie ein Element aus dem Baum oder fügen Sie ein neues Werk hinzu.',
            plans_title: 'Wartungspläne',
            tasks_title: 'Alle Wartungsaufgaben',

            // Detail view
            detail_type_plant: 'Typ: Werk',
            detail_type_section: 'Typ: Abteilung',
            detail_no_documentation: 'Keine Dokumentation',
            detail_no_tasks: 'Keine Aufgaben',
            detail_no_plans: 'Keine Pläne',
            detail_documentation: 'Dokumentation',
            detail_maintenance_tasks: 'Wartungsaufgaben',
            detail_maintenance_plans: 'Wartungspläne',
            detail_every_days: 'Alle {days} Tage | Nächste: {date}',

            // Theme
            theme_light: 'Helles Thema',
            theme_dark: 'Dunkles Thema',

            // Misc
            error_prefix: 'Fehler: ',
            loading: 'Laden...',
            version: 'v1.0',
        },
    },

    t(key, params) {
        const val = this.strings[this.currentLang]?.[key] || this.strings['en']?.[key] || key;
        if (!params) return val;
        return val.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
    },

    setLang(lang) {
        this.currentLang = lang;
        localStorage.setItem('lang', lang);
    },

    getDateLocale() {
        return this.currentLang === 'de' ? 'de-DE' : 'en-US';
    },
};

function t(key, params) {
    return I18n.t(key, params);
}
```

- [ ] **Step 2: Add script tag to `app/static/index.html`**

Add the i18n script as the FIRST script (before api.js):
```html
    <script src="/js/i18n.js"></script>
    <script src="/js/api.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add app/static/js/i18n.js app/static/index.html
git commit -m "feat: add i18n module with English and German translations"
```

---

### Task 7: Create the TranslationCache module

**Files:**
- Create: `app/static/js/translation-cache.js`
- Modify: `app/static/index.html` (add script tag)

**Context:** This module caches database record translations in memory. When the user switches language, the active view calls `TranslationCache.load('factory', 'de')` to fetch all factory translations in German. Then `TranslationCache.get('factory', 1, 'name')` returns the translated name or falls back to the original.

- [ ] **Step 1: Create `app/static/js/translation-cache.js`**

```javascript
const TranslationCache = {
    cache: {},

    async load(entityType, lang) {
        if (lang === 'en') {
            this.cache[entityType] = {};
            return;
        }
        try {
            const items = await API.get(`/api/translations/batch?entity_type=${entityType}&lang=${lang}`);
            const map = {};
            items.forEach(item => {
                const key = `${item.entity_id}_${item.field_name}`;
                map[key] = item.value;
            });
            this.cache[entityType] = map;
        } catch (e) {
            console.error('TranslationCache load error:', e);
            this.cache[entityType] = {};
        }
    },

    get(entityType, entityId, fieldName, fallback) {
        if (I18n.currentLang === 'en') return fallback;
        const key = `${entityId}_${fieldName}`;
        return this.cache[entityType]?.[key] || fallback;
    },

    async loadAll(lang) {
        await Promise.all([
            this.load('factory', lang),
            this.load('section', lang),
            this.load('equipment', lang),
            this.load('component', lang),
            this.load('task', lang),
            this.load('plan', lang),
        ]);
    },

    clear() {
        this.cache = {};
    },
};
```

- [ ] **Step 2: Add script tag to `app/static/index.html`**

Add after i18n.js and api.js:
```html
    <script src="/js/i18n.js"></script>
    <script src="/js/api.js"></script>
    <script src="/js/translation-cache.js"></script>
```

- [ ] **Step 3: Commit**

```bash
git add app/static/js/translation-cache.js app/static/index.html
git commit -m "feat: add TranslationCache module for database record translations"
```

---

### Task 8: Add language toggle and apply i18n to HTML and all JS modules

**Files:**
- Modify: `app/static/index.html` (add language toggle, add `data-i18n` attributes to static text)
- Modify: `app/static/js/app.js` (language toggle handler, re-render on switch)
- Modify: `app/static/js/dashboard.js` (use `t()` for all strings)
- Modify: `app/static/js/detail-pane.js` (use `t()` for all strings)
- Modify: `app/static/js/tree.js` (use `t()` for all strings)
- Modify: `app/static/js/detail.js` (use `t()` for all strings)
- Modify: `app/static/js/modal.js` (use `t()` for button labels)

**Context:** This is the largest task — it touches every JS file to replace hardcoded strings with `t()` calls, and updates the HTML to use `data-i18n` attributes for static text that gets translated on language switch.

The approach:
1. Add a language toggle button in the topbar (next to theme toggle)
2. Add `data-i18n` attributes to all static HTML text elements
3. Create an `applyStaticTranslations()` function in `app.js` that updates all `[data-i18n]` elements
4. Replace every hardcoded string in JS files with `t('key')` calls
5. On language switch: update localStorage, call `applyStaticTranslations()`, reload TranslationCache, and re-render the active view

This task is large but mostly mechanical — it's string replacement across files. The implementer should work through one file at a time.

- [ ] **Step 1: Add language toggle to topbar in `app/static/index.html`**

In the `.topbar-right` div, add the language toggle before the theme toggle button:

```html
        <div class="topbar-right">
            <button id="lang-toggle" class="topbar-btn lang-toggle" title="Language">
                <span id="lang-label">EN</span>
            </button>
            <button id="theme-toggle" class="topbar-btn" title="Toggle theme">
```

- [ ] **Step 2: Add `data-i18n` attributes to all static text in HTML**

Replace static text elements with `data-i18n` attributes. For example:

Nav items — add `data-i18n` to the `<span>` inside each nav button:
```html
<button class="nav-item active" data-view="dashboard" title="Dashboard">
    ...svg...
    <span data-i18n="nav_dashboard">Dashboard</span>
</button>
```

Do the same for all static text:
- Nav: `nav_dashboard`, `nav_equipment`, `nav_tasks`, `nav_plans`
- View headers: `dashboard_title`, `equipment_title`, `tasks_title`, `plans_title`
- Stat labels: `stat_total`, `stat_overdue`, `stat_planned`, `stat_completed`, `stat_equipment`, `stat_plans`
- Button text: `btn_new_task`, `btn_new_plant`, `btn_new_plan`
- Filter options: `filter_all_tasks`, `filter_overdue`, `filter_planned`, `filter_completed`, `filter_all_statuses`
- Search placeholders: use `data-i18n-placeholder="search_placeholder"`
- Table headers: `th_title`, `th_plant`, `th_section`, `th_equipment`, `th_component`, `th_type`, `th_due_date`, `th_status`, `th_actions`, `th_interval`, `th_last_completed`, `th_next_due`
- Detail panel labels: `detail_description`, `detail_notes`, `detail_documents`
- Detail panel buttons: `btn_edit`, `btn_save`, `btn_cancel`
- Upload area: `detail_upload`
- Empty states: `no_tasks`, `equipment_empty`

- [ ] **Step 3: Add language toggle CSS to `app/static/css/style.css`**

Add after the `.topbar-btn` styles:

```css
.lang-toggle {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    min-width: 36px;
}
```

- [ ] **Step 4: Update `app/static/js/app.js`**

Add the `applyStaticTranslations` function and language toggle handler. Add after the theme toggle setup:

```javascript
    // Language toggle
    const langToggle = document.getElementById('lang-toggle');
    const langLabel = document.getElementById('lang-label');
    langLabel.textContent = I18n.currentLang.toUpperCase();

    langToggle.addEventListener('click', async () => {
        const next = I18n.currentLang === 'en' ? 'de' : 'en';
        I18n.setLang(next);
        langLabel.textContent = next.toUpperCase();
        applyStaticTranslations();
        await TranslationCache.loadAll(next);
        switchView(getCurrentView());
    });

    function applyStaticTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.dataset.i18nPlaceholder);
        });
    }

    function getCurrentView() {
        const active = document.querySelector('.nav-item.active');
        return active ? active.dataset.view : 'dashboard';
    }
```

Update `applyTheme` to use `t()`:
```javascript
    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        themeToggle.title = theme === 'dark' ? t('theme_light') : t('theme_dark');
    }
```

Update the date formatting to use `I18n.getDateLocale()`:
```javascript
    dateEl.textContent = now.toLocaleDateString(I18n.getDateLocale(), {
        weekday: 'long', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
```

Update the "New Plant" modal:
```javascript
    document.getElementById('add-factory-btn').addEventListener('click', () => {
        Modal.show(t('btn_new_plant'), [
            { name: 'name', label: t('field_name'), type: 'text', required: true },
            { name: 'description', label: t('field_description'), type: 'textarea' },
        ], async (data) => {
            await API.createFactory(data);
            Tree.refresh();
        });
    });
```

Load translation cache on startup:
```javascript
    // Initial load
    TranslationCache.loadAll(I18n.currentLang).then(() => {
        applyStaticTranslations();
        switchView('dashboard');
    });
```

- [ ] **Step 5: Update `app/static/js/modal.js`**

Replace hardcoded button labels:

Line 31 — Cancel button:
```javascript
html += `<button type="button" class="btn" onclick="Modal.hide()">${t('btn_cancel')}</button>`;
```

Line 32 — Save button:
```javascript
html += `<button type="submit" class="btn btn-primary">${t('btn_save')}</button>`;
```

Line 65 — Confirmation title:
```javascript
html += `<h3>${t('modal_confirmation')}</h3>`;
```

Line 68 — Cancel button:
```javascript
html += `<button class="btn" onclick="Modal.hide()">${t('btn_cancel')}</button>`;
```

Line 69 — Delete button:
```javascript
html += `<button class="btn btn-danger" id="modal-confirm-btn">${t('btn_delete')}</button>`;
```

Line 80 — Error prefix:
```javascript
alert(t('error_prefix') + err.message);
```

- [ ] **Step 6: Update `app/static/js/dashboard.js`**

Replace all hardcoded strings with `t()` calls:

In `renderTable` (line 88-89) — type labels:
```javascript
const typeLabel = t.plan_id
    ? `<span class="task-type-badge type-plan">${I18n.t('type_plan')}</span>`
    : `<span class="task-type-badge type-manual">${I18n.t('type_manual')}</span>`;
```

In `renderTable` (line 92) — status labels:
```javascript
const statusLabels = {
    overdue: I18n.t('status_overdue'),
    planned: I18n.t('status_planned'),
    completed: I18n.t('status_completed'),
};
```

In `applyFilters` (line 43-44) — record count:
```javascript
document.getElementById('result-count').textContent =
    this.filteredTasks.length + ' ' + t('records_of') + ' ' + this.data.tasks.length + ' ' + t('records_label');
```

In `applyFilters2` (line 73-74) — same pattern for result-count-2.

In `formatDate` (line 260-261) — use locale:
```javascript
return d.toLocaleDateString(I18n.getDateLocale(), { month: 'short', day: '2-digit', year: 'numeric' });
```

In `showNewTaskModal` (line 210, 219-224):
```javascript
const equipOptions = [{ value: '', label: t('modal_none') }];
```
```javascript
Modal.show(t('modal_new_task'), [
    { name: 'title', label: t('field_title'), type: 'text', required: true },
    { name: 'description', label: t('field_description'), type: 'textarea' },
    { name: 'due_date', label: t('field_due_date'), type: 'date', required: true },
    { name: 'equipment_id', label: t('field_equipment'), type: 'select', options: equipOptions },
], ...
```

Same pattern for `showNewPlanModal`.

- [ ] **Step 7: Update `app/static/js/tree.js`**

Replace all modal titles and field labels:

```javascript
addSection(factoryId) {
    Modal.show(t('modal_new_section'), [
        { name: 'name', label: t('field_name'), type: 'text', required: true },
        { name: 'description', label: t('field_description'), type: 'textarea' },
    ], ...
```

Same pattern for `addEquipment`, `addComponent`, `editFactory`, `editSection`, `editEquipment`, `editComponent`.

Delete confirmations:
```javascript
deleteFactory(f) {
    Modal.confirm(t('confirm_delete_plant', { name: f.name }), async () => { ... });
},
```

Same for `deleteSection`, `deleteEquipment`, `deleteComponent`.

- [ ] **Step 8: Update `app/static/js/detail.js`**

Replace all hardcoded strings with `t()` calls. Key replacements:

```javascript
'Select an item from the tree.' → t('equipment_empty')
'Add Documentation' → t('modal_add_doc')
'New Maintenance Task' → t('modal_new_task')
'New Maintenance Plan' → t('modal_new_plan')
'No documentation' → t('detail_no_documentation')
'No tasks' → t('detail_no_tasks')
'No plans' → t('detail_no_plans')
'Documentation' → t('detail_documentation')
'Maintenance Tasks' → t('detail_maintenance_tasks')
'Maintenance Plans' → t('detail_maintenance_plans')
'Type: Plant' → t('detail_type_plant')
'Type: Section' → t('detail_type_section')
```

- [ ] **Step 9: Run the app and verify translations work**

```bash
source .venv/bin/activate && python -m uvicorn app.main:app --reload
```

Open browser, toggle language, verify UI switches between EN and DE.

- [ ] **Step 10: Commit**

```bash
git add app/static/index.html app/static/css/style.css app/static/js/app.js app/static/js/modal.js app/static/js/dashboard.js app/static/js/tree.js app/static/js/detail.js
git commit -m "feat: apply i18n to all UI strings with EN/DE language toggle"
```

---

## Chunk 3: Frontend — Enhanced Detail Pane

### Task 9: Rewrite detail pane HTML and CSS

**Files:**
- Modify: `app/static/index.html` (replace task detail panel content)
- Modify: `app/static/css/style.css` (add new detail pane styles)

**Context:** The existing detail pane HTML is at lines 179-223 of `index.html`, inside `#view-dashboard`. It currently has: header (title/path/close), badges, description, notes, documents, and action buttons (complete/delete). We need to replace this with the new layout that adds: tree breadcrumb, metadata grid, checklist, and activity log.

- [ ] **Step 1: Replace the task detail panel HTML in `index.html`**

Replace everything inside `<div id="task-detail-panel" class="task-detail-panel">` (lines 179-223) with:

```html
                <div id="task-detail-panel" class="task-detail-panel">
                    <div class="detail-panel-header">
                        <div>
                            <h3 id="detail-title" class="detail-panel-title"></h3>
                        </div>
                        <button id="detail-close" class="btn-icon" title="Close">✕</button>
                    </div>

                    <!-- Tree breadcrumb -->
                    <div id="detail-breadcrumb" class="detail-breadcrumb"></div>

                    <!-- Metadata grid -->
                    <div class="detail-meta-grid" id="detail-meta-grid">
                        <div class="detail-meta-item">
                            <span class="detail-meta-label" data-i18n="th_status">Status</span>
                            <select id="detail-status-select" class="detail-meta-select">
                                <option value="planned" data-i18n="status_planned">Planned</option>
                                <option value="in_progress" data-i18n="status_in_progress">In Progress</option>
                                <option value="completed" data-i18n="status_completed">Completed</option>
                                <option value="overdue" data-i18n="status_overdue">Overdue</option>
                            </select>
                        </div>
                        <div class="detail-meta-item">
                            <span class="detail-meta-label" data-i18n="detail_priority">Priority</span>
                            <select id="detail-priority-select" class="detail-meta-select">
                                <option value="low" data-i18n="priority_low">Low</option>
                                <option value="medium" data-i18n="priority_medium">Medium</option>
                                <option value="high" data-i18n="priority_high">High</option>
                                <option value="critical" data-i18n="priority_critical">Critical</option>
                            </select>
                        </div>
                        <div class="detail-meta-item">
                            <span class="detail-meta-label" data-i18n="detail_assignee">Assignee</span>
                            <div class="detail-meta-editable">
                                <span id="detail-assignee-display" class="detail-meta-value"></span>
                                <input id="detail-assignee-input" class="detail-meta-input hidden" type="text">
                            </div>
                        </div>
                        <div class="detail-meta-item">
                            <span class="detail-meta-label" data-i18n="detail_due_date">Due Date</span>
                            <div class="detail-meta-editable">
                                <span id="detail-due-display" class="detail-meta-value"></span>
                                <input id="detail-due-input" class="detail-meta-input hidden" type="date">
                            </div>
                        </div>
                        <div class="detail-meta-item">
                            <span class="detail-meta-label" data-i18n="detail_estimated">Est. Duration</span>
                            <div class="detail-meta-editable">
                                <span id="detail-duration-display" class="detail-meta-value"></span>
                                <input id="detail-duration-input" class="detail-meta-input hidden" type="number" min="0" placeholder="min">
                            </div>
                        </div>
                        <div class="detail-meta-item" id="detail-plan-info-container" class="hidden">
                            <span class="detail-meta-label" data-i18n="detail_plan_info">Plan Info</span>
                            <span id="detail-plan-info" class="detail-meta-value"></span>
                        </div>
                    </div>

                    <div class="detail-panel-section">
                        <div class="detail-panel-label" data-i18n="detail_description">Description</div>
                        <div id="detail-description" class="detail-panel-text"></div>
                    </div>

                    <!-- Checklist -->
                    <div class="detail-panel-section">
                        <div class="detail-panel-label-row">
                            <span class="detail-panel-label" data-i18n="detail_checklist">Checklist</span>
                            <span id="detail-checklist-progress" class="detail-checklist-progress"></span>
                        </div>
                        <div id="detail-checklist-list" class="detail-checklist-list"></div>
                        <div class="detail-checklist-add">
                            <input id="detail-checklist-input" type="text" class="detail-checklist-input" data-i18n-placeholder="detail_add_item" placeholder="Add item...">
                            <button id="detail-checklist-add-btn" class="btn-icon" title="Add">+</button>
                        </div>
                    </div>

                    <!-- Notes -->
                    <div class="detail-panel-section">
                        <div class="detail-panel-label-row">
                            <span class="detail-panel-label" data-i18n="detail_notes">Notes</span>
                            <button id="detail-notes-edit" class="detail-panel-link" data-i18n="btn_edit">Edit</button>
                        </div>
                        <div id="detail-notes-display" class="detail-panel-text"></div>
                        <div id="detail-notes-editor" class="detail-notes-editor hidden">
                            <textarea id="detail-notes-textarea" class="detail-notes-textarea" rows="4"></textarea>
                            <div class="detail-notes-actions">
                                <button id="detail-notes-save" class="btn btn-primary btn-sm" data-i18n="btn_save">Save</button>
                                <button id="detail-notes-cancel" class="btn btn-sm" data-i18n="btn_cancel">Cancel</button>
                            </div>
                        </div>
                    </div>

                    <!-- Documents -->
                    <div class="detail-panel-section">
                        <div class="detail-panel-label" data-i18n="detail_documents">Documents</div>
                        <div id="detail-docs-list" class="detail-docs-list"></div>
                        <div id="detail-upload-area" class="detail-upload-area">
                            <input type="file" id="detail-file-input" hidden>
                            <div class="detail-upload-label">📎 <span data-i18n="detail_upload">Drop files or click to upload</span></div>
                        </div>
                    </div>

                    <!-- Activity Log -->
                    <div class="detail-panel-section">
                        <div class="detail-panel-label" data-i18n="detail_activity">Activity</div>
                        <div id="detail-activity-list" class="detail-activity-list"></div>
                    </div>

                    <div class="detail-panel-actions">
                        <button id="detail-delete-btn" class="btn btn-danger btn-sm" data-i18n="btn_delete">Delete</button>
                    </div>
                </div>
```

- [ ] **Step 2: Add new CSS for enhanced detail pane**

Add to `app/static/css/style.css`:

```css
/* Tree breadcrumb */
.detail-breadcrumb {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    padding: 8px 0;
    margin-bottom: 8px;
}
.detail-breadcrumb-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    background: rgba(59,130,246,0.1);
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
}
.detail-breadcrumb-pill.active {
    background: rgba(59,130,246,0.2);
    color: var(--accent);
    font-weight: 600;
    border: 1px solid rgba(59,130,246,0.3);
}
.detail-breadcrumb-arrow {
    color: var(--text-muted);
    font-size: 10px;
}

/* Metadata grid */
.detail-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 14px;
    padding: 10px;
    background: var(--bg-body);
    border-radius: 8px;
    border: 1px solid var(--border-light);
}
.detail-meta-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.detail-meta-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    font-weight: 600;
}
.detail-meta-value {
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 2px 0;
}
.detail-meta-value:hover {
    color: var(--accent);
}
.detail-meta-select {
    font-size: 11px;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
    color: var(--text-primary);
    cursor: pointer;
}
.detail-meta-input {
    font-size: 11px;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-focus);
    background: var(--bg-card);
    color: var(--text-primary);
    width: 100%;
}
.detail-meta-editable {
    min-height: 22px;
}

/* Priority colors */
.detail-meta-select.priority-low { color: var(--text-secondary); }
.detail-meta-select.priority-medium { color: var(--warning); }
.detail-meta-select.priority-high { color: #f97316; }
.detail-meta-select.priority-critical { color: var(--danger); }

/* Checklist */
.detail-checklist-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.detail-checklist-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
    color: var(--text-secondary);
}
.detail-checklist-item.completed {
    text-decoration: line-through;
    color: var(--text-muted);
}
.detail-checklist-item input[type="checkbox"] {
    accent-color: var(--accent);
    cursor: pointer;
}
.detail-checklist-item .checklist-remove {
    margin-left: auto;
    cursor: pointer;
    color: var(--text-muted);
    font-size: 11px;
    opacity: 0;
    transition: opacity 0.15s;
}
.detail-checklist-item:hover .checklist-remove {
    opacity: 1;
}
.detail-checklist-progress {
    font-size: 10px;
    color: var(--text-muted);
}
.detail-checklist-add {
    display: flex;
    gap: 4px;
    margin-top: 6px;
}
.detail-checklist-input {
    flex: 1;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
    color: var(--text-primary);
}

/* Activity log */
.detail-activity-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
}
.detail-activity-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;
    font-size: 11px;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-light);
}
.detail-activity-item:last-child {
    border-bottom: none;
}
.detail-activity-icon {
    font-size: 12px;
    flex-shrink: 0;
    margin-top: 1px;
}
.detail-activity-text {
    flex: 1;
    color: var(--text-secondary);
}
.detail-activity-detail {
    font-size: 10px;
    color: var(--text-muted);
    font-style: italic;
}
.detail-activity-time {
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    flex-shrink: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/static/index.html app/static/css/style.css
git commit -m "feat: enhanced detail pane HTML with metadata, checklist, activity log, breadcrumb"
```

---

### Task 10: Rewrite detail-pane.js with all new features

**Files:**
- Modify: `app/static/js/detail-pane.js` (complete rewrite)
- Modify: `app/static/js/api.js` (add checklist and activity API methods)

**Context:** The current `detail-pane.js` is 193 lines. It needs to be rewritten to support: tree breadcrumb rendering, metadata grid with inline editing (status, priority, assignee, due date, duration), checklist CRUD, activity log display, and i18n integration. All API calls should use the existing `API` object pattern.

- [ ] **Step 1: Add new API methods to `app/static/js/api.js`**

Add these methods after the existing ones:

```javascript
    getChecklist: (taskId) => API.get(`/api/maintenance/tasks/${taskId}/checklist`),
    addChecklistItem: (taskId, data) => API.post(`/api/maintenance/tasks/${taskId}/checklist`, data),
    updateChecklistItem: (taskId, itemId, data) => API.put(`/api/maintenance/tasks/${taskId}/checklist/${itemId}`, data),
    deleteChecklistItem: (taskId, itemId) => API.del(`/api/maintenance/tasks/${taskId}/checklist/${itemId}`),
    getActivity: (taskId) => API.get(`/api/maintenance/tasks/${taskId}/activity`),
    upsertTranslation: (data) => API.put('/api/translations', data),
```

- [ ] **Step 2: Rewrite `app/static/js/detail-pane.js`**

Complete replacement:

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
        document.getElementById('detail-delete-btn').addEventListener('click', () => this.deleteTask());

        // Status and priority dropdowns
        document.getElementById('detail-status-select').addEventListener('change', (e) => this.updateField('status', e.target.value));
        document.getElementById('detail-priority-select').addEventListener('change', (e) => {
            this.updateField('priority', e.target.value);
            this.updatePriorityColor();
        });

        // Inline editable fields
        this.setupInlineEdit('detail-assignee', 'assignee');
        this.setupInlineEdit('detail-due', 'due_date');
        this.setupInlineEdit('detail-duration', 'estimated_minutes', v => v ? parseInt(v) : null);

        // Checklist
        document.getElementById('detail-checklist-add-btn').addEventListener('click', () => this.addChecklistItem());
        document.getElementById('detail-checklist-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addChecklistItem();
        });

        // File upload
        const uploadArea = document.getElementById('detail-upload-area');
        const fileInput = document.getElementById('detail-file-input');
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.uploadFiles(e.target.files);
            fileInput.value = '';
        });
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length) this.uploadFiles(e.dataTransfer.files);
        });
    },

    setupInlineEdit(prefix, field, transform) {
        const display = document.getElementById(`${prefix}-display`);
        const input = document.getElementById(`${prefix}-input`);

        display.addEventListener('click', () => {
            display.classList.add('hidden');
            input.classList.remove('hidden');
            if (field === 'due_date') {
                input.value = this.currentTask?.due_date || '';
            } else if (field === 'estimated_minutes') {
                input.value = this.currentTask?.estimated_minutes || '';
            } else {
                input.value = this.currentTask?.[field] || '';
            }
            input.focus();
        });

        const save = () => {
            input.classList.add('hidden');
            display.classList.remove('hidden');
            const val = transform ? transform(input.value) : input.value;
            this.updateField(field, val);
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    },

    async updateField(field, value) {
        if (!this.currentTask) return;
        const data = {};
        data[field] = value;
        await API.updateTask(this.currentTask.id, data);
        this.currentTask[field] = value;

        // Update display
        if (field === 'status') this.currentTask.status = value;
        if (field === 'assignee') {
            document.getElementById('detail-assignee-display').textContent = value || t('detail_unassigned');
        }
        if (field === 'due_date') {
            this.currentTask.due_date = value;
            document.getElementById('detail-due-display').textContent = value ? Dashboard.formatDate(value) : '-';
        }
        if (field === 'estimated_minutes') {
            this.currentTask.estimated_minutes = value;
            document.getElementById('detail-duration-display').textContent = this.formatDuration(value);
        }

        // Refresh activity log
        this.loadActivity();
    },

    async open(taskId, dashboardData) {
        this.dashboardData = dashboardData;
        const taskRow = dashboardData?.tasks?.find(t => t.id === taskId);
        if (!taskRow) return;

        try {
            const fullTask = await API.getTask(taskId);
            this.currentTask = { ...taskRow, ...fullTask };
        } catch {
            this.currentTask = { ...taskRow, notes: '', priority: 'medium', assignee: '', estimated_minutes: null };
        }

        this.render();
        this.loadChecklist();
        this.loadDocs();
        this.loadActivity();
        this.panel.classList.add('open');
        document.getElementById('view-dashboard').classList.add('view-dashboard-with-panel');
    },

    close() {
        this.panel.classList.remove('open');
        document.getElementById('view-dashboard').classList.remove('view-dashboard-with-panel');
        this.currentTask = null;
    },

    render() {
        const tk = this.currentTask;
        if (!tk) return;

        document.getElementById('detail-title').textContent = tk.title;

        // Tree breadcrumb
        this.renderBreadcrumb(tk);

        // Metadata
        document.getElementById('detail-status-select').value = tk.status;
        const prioSelect = document.getElementById('detail-priority-select');
        prioSelect.value = tk.priority || 'medium';
        this.updatePriorityColor();

        document.getElementById('detail-assignee-display').textContent = tk.assignee || t('detail_unassigned');
        document.getElementById('detail-due-display').textContent = tk.due_date ? Dashboard.formatDate(tk.due_date) : '-';
        document.getElementById('detail-duration-display').textContent = this.formatDuration(tk.estimated_minutes);

        // Plan info
        const planContainer = document.getElementById('detail-plan-info-container');
        if (tk.plan_id) {
            planContainer.classList.remove('hidden');
            document.getElementById('detail-plan-info').textContent = t('type_plan') + ' #' + tk.plan_id;
        } else {
            planContainer.classList.add('hidden');
        }

        // Description
        document.getElementById('detail-description').textContent = tk.description || t('detail_no_description');

        // Notes
        this.hideNotesEditor();
        document.getElementById('detail-notes-display').textContent = tk.notes || t('detail_no_notes');
    },

    renderBreadcrumb(tk) {
        const container = document.getElementById('detail-breadcrumb');
        const levels = [
            { icon: '🏭', name: tk.factory_name },
            { icon: '📁', name: tk.section_name },
            { icon: '⚙️', name: tk.equipment_name },
            { icon: '🔧', name: tk.component_name },
        ].filter(l => l.name);

        if (levels.length === 0) {
            container.innerHTML = `<span class="detail-breadcrumb-pill" style="color:var(--text-muted)">${t('detail_no_equipment')}</span>`;
            return;
        }

        container.innerHTML = levels.map((l, i) => {
            const isLast = i === levels.length - 1;
            const pill = `<span class="detail-breadcrumb-pill ${isLast ? 'active' : ''}">${l.icon} ${this.esc(l.name)}</span>`;
            const arrow = isLast ? '' : '<span class="detail-breadcrumb-arrow">→</span>';
            return pill + arrow;
        }).join('');
    },

    updatePriorityColor() {
        const select = document.getElementById('detail-priority-select');
        select.className = 'detail-meta-select priority-' + select.value;
    },

    formatDuration(minutes) {
        if (!minutes) return '-';
        if (minutes < 60) return minutes + ' min';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    },

    // --- Notes ---
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
        document.getElementById('detail-notes-display').textContent = notes || t('detail_no_notes');
        this.hideNotesEditor();
        this.loadActivity();
    },

    // --- Checklist ---
    async loadChecklist() {
        if (!this.currentTask) return;
        const items = await API.getChecklist(this.currentTask.id);
        const list = document.getElementById('detail-checklist-list');
        const completed = items.filter(i => i.is_completed).length;
        const progress = document.getElementById('detail-checklist-progress');
        progress.textContent = items.length > 0 ? `${completed}/${items.length} ${t('detail_completed_of')}` : '';

        if (items.length === 0) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = items.map(item => `
            <div class="detail-checklist-item ${item.is_completed ? 'completed' : ''}" data-item-id="${item.id}">
                <input type="checkbox" ${item.is_completed ? 'checked' : ''}>
                <span class="checklist-text">${this.esc(item.text)}</span>
                <span class="checklist-remove" title="Remove">✕</span>
            </div>
        `).join('');

        list.querySelectorAll('.detail-checklist-item').forEach(el => {
            const itemId = parseInt(el.dataset.itemId);
            el.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                this.toggleChecklistItem(itemId, e.target.checked);
            });
            el.querySelector('.checklist-remove').addEventListener('click', () => {
                this.removeChecklistItem(itemId);
            });
        });
    },

    async addChecklistItem() {
        if (!this.currentTask) return;
        const input = document.getElementById('detail-checklist-input');
        const text = input.value.trim();
        if (!text) return;
        await API.addChecklistItem(this.currentTask.id, { text });
        input.value = '';
        this.loadChecklist();
        this.loadActivity();
    },

    async toggleChecklistItem(itemId, isCompleted) {
        if (!this.currentTask) return;
        await API.updateChecklistItem(this.currentTask.id, itemId, { is_completed: isCompleted });
        this.loadChecklist();
        this.loadActivity();
    },

    async removeChecklistItem(itemId) {
        if (!this.currentTask) return;
        await API.deleteChecklistItem(this.currentTask.id, itemId);
        this.loadChecklist();
        this.loadActivity();
    },

    // --- Documents ---
    async loadDocs() {
        if (!this.currentTask) return;
        const docs = await API.getTaskDocs(this.currentTask.id);
        const list = document.getElementById('detail-docs-list');

        if (docs.length === 0) {
            list.innerHTML = `<div style="font-size:11px;color:var(--text-muted);">${t('detail_no_docs')}</div>`;
            return;
        }

        list.innerHTML = docs.map(d => {
            const fileUrl = d.file_path ? `/api/uploads/${d.file_path}` : d.url;
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

        list.querySelectorAll('.detail-doc-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.detail-doc-delete')) return;
                window.open(item.dataset.url, '_blank');
            });
        });

        list.querySelectorAll('.detail-doc-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await API.deleteDoc(parseInt(btn.dataset.docId));
                this.loadDocs();
                this.loadActivity();
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
        this.loadActivity();
    },

    // --- Activity Log ---
    async loadActivity() {
        if (!this.currentTask) return;
        const entries = await API.getActivity(this.currentTask.id);
        const list = document.getElementById('detail-activity-list');

        if (entries.length === 0) {
            list.innerHTML = '';
            return;
        }

        const actionIcons = {
            task_created: '📋',
            status_changed: '🔄',
            priority_changed: '⚡',
            assignee_changed: '👤',
            notes_edited: '📝',
            due_date_changed: '📅',
            estimated_minutes_changed: '⏱️',
            checklist_added: '➕',
            checklist_completed: '✅',
            checklist_removed: '➖',
            file_uploaded: '📎',
            file_removed: '🗑️',
        };

        list.innerHTML = entries.map(e => {
            const icon = actionIcons[e.action] || '•';
            const label = t('activity_' + e.action) || e.action;
            const time = this.formatTime(e.created_at);
            const detail = e.detail ? `<div class="detail-activity-detail">${this.esc(e.detail)}</div>` : '';
            return `
                <div class="detail-activity-item">
                    <span class="detail-activity-icon">${icon}</span>
                    <div>
                        <div class="detail-activity-text">${label}</div>
                        ${detail}
                    </div>
                    <span class="detail-activity-time">${time}</span>
                </div>
            `;
        }).join('');
    },

    formatTime(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return d.toLocaleDateString(I18n.getDateLocale(), { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString(I18n.getDateLocale(), { hour: '2-digit', minute: '2-digit' });
    },

    // --- Delete ---
    async deleteTask() {
        if (!this.currentTask) return;
        Modal.confirm(t('confirm_delete_task'), async () => {
            await API.deleteTask(this.currentTask.id);
            this.close();
            Dashboard.load();
        });
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
```

- [ ] **Step 3: Run the app and verify the enhanced detail pane**

```bash
source .venv/bin/activate && python -m uvicorn app.main:app --reload
```

Open browser, click a task row in the dashboard. Verify:
- Tree breadcrumb shows with icon pills
- Metadata grid shows status, priority, assignee, due date, duration
- Status/priority dropdowns work
- Inline editing works for assignee, due date, duration
- Checklist add/toggle/remove works
- Notes edit/save/cancel works
- Documents upload/view/delete works
- Activity log shows entries
- Delete button works with confirmation

- [ ] **Step 4: Commit**

```bash
git add app/static/js/detail-pane.js app/static/js/api.js
git commit -m "feat: rewrite detail pane with metadata, checklist, activity log, breadcrumb"
```

---

### Task 11: Update e2e tests for enhanced detail pane

**Files:**
- Modify: `tests/e2e/detail-pane.spec.js`

**Context:** The existing e2e tests reference UI elements that have changed (e.g., `#detail-complete-btn` no longer exists, `#detail-path` replaced by `#detail-breadcrumb`, `#detail-badges` removed). Update the tests to match the new HTML structure.

- [ ] **Step 1: Update `tests/e2e/detail-pane.spec.js`**

Replace the file content with updated tests that match the new HTML:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Task detail pane', () => {

  let taskTitle;

  test.beforeEach(async ({ page }) => {
    taskTitle = `TestTask-${Date.now()}`;
    const f = await (await page.request.post('/api/factories', { data: { name: 'PaneFactory' } })).json();
    const s = await (await page.request.post('/api/sections', { data: { name: 'PaneSection', factory_id: f.id } })).json();
    const e = await (await page.request.post('/api/equipment', { data: { name: 'PaneEquip', section_id: s.id } })).json();
    await page.request.post('/api/maintenance/tasks', {
      data: { title: taskTitle, description: 'Pane test description', due_date: '2026-06-01', equipment_id: e.id }
    });
    await page.goto('/');
    await page.waitForSelector('#task-tbody tr');
  });

  async function openTestTask(page) {
    const row = page.locator(`#task-tbody tr`, { hasText: taskTitle });
    await row.click();
    await expect(page.locator('#task-detail-panel')).toHaveClass(/open/);
  }

  test('clicking a task row opens the detail panel', async ({ page }) => {
    await openTestTask(page);
    await expect(page.locator('#detail-title')).toContainText(taskTitle);
  });

  test('close button closes the panel', async ({ page }) => {
    await openTestTask(page);
    await page.click('#detail-close');
    await expect(page.locator('#task-detail-panel')).not.toHaveClass(/open/);
  });

  test('panel shows task metadata', async ({ page }) => {
    await openTestTask(page);
    await expect(page.locator('#detail-title')).toContainText(taskTitle);
    await expect(page.locator('#detail-description')).toContainText('Pane test description');
    await expect(page.locator('#detail-breadcrumb')).toContainText('PaneFactory');
    await expect(page.locator('#detail-status-select')).toBeVisible();
    await expect(page.locator('#detail-priority-select')).toBeVisible();
  });

  test('notes can be edited and saved', async ({ page }) => {
    await openTestTask(page);
    await page.click('#detail-notes-edit');
    await expect(page.locator('#detail-notes-editor')).toBeVisible();
    await page.fill('#detail-notes-textarea', 'Test note content');
    await page.click('#detail-notes-save');
    await expect(page.locator('#detail-notes-display')).toContainText('Test note content');
    await expect(page.locator('#detail-notes-editor')).not.toBeVisible();
  });

  test('notes cancel discards changes', async ({ page }) => {
    await openTestTask(page);
    await page.click('#detail-notes-edit');
    await page.fill('#detail-notes-textarea', 'Unsaved content');
    await page.click('#detail-notes-cancel');
    await expect(page.locator('#detail-notes-editor')).not.toBeVisible();
    await expect(page.locator('#detail-notes-display')).not.toContainText('Unsaved content');
  });

  test('file upload area is visible', async ({ page }) => {
    await openTestTask(page);
    await expect(page.locator('#detail-upload-area')).toBeVisible();
  });

  test('checklist can add items', async ({ page }) => {
    await openTestTask(page);
    await page.fill('#detail-checklist-input', 'Check oil level');
    await page.click('#detail-checklist-add-btn');
    await expect(page.locator('#detail-checklist-list')).toContainText('Check oil level');
  });

  test('status can be changed via dropdown', async ({ page }) => {
    await openTestTask(page);
    await page.selectOption('#detail-status-select', 'completed');
    // Verify the select has the new value
    await expect(page.locator('#detail-status-select')).toHaveValue('completed');
  });

  test('action buttons in row do not open panel', async ({ page }) => {
    const row = page.locator(`#task-tbody tr`, { hasText: taskTitle });
    const actionBtn = row.locator('[data-action]').first();
    if (await actionBtn.count() > 0) {
      await actionBtn.click();
      await expect(page.locator('#task-detail-panel')).not.toHaveClass(/open/);
    }
  });
});
```

- [ ] **Step 2: Run e2e tests**

```bash
npx playwright test tests/e2e/detail-pane.spec.js --project=desktop
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/detail-pane.spec.js
git commit -m "test: update e2e tests for enhanced detail pane"
```

---

### Task 12: Add translation fields to create/edit modals

**Files:**
- Modify: `app/static/js/tree.js` (add EN/DE name fields to modals)
- Modify: `app/static/js/dashboard.js` (add EN/DE title fields to task/plan modals)
- Modify: `app/static/js/app.js` (add EN/DE name fields to factory modal)

**Context:** When creating or editing entities, the modal should show dual-language fields. The base field (name/title) is saved via the normal API. The translation for the other language is saved via `API.upsertTranslation()`. The modal `onSubmit` callback needs to handle both.

The pattern for each modal:
1. Show `Name (EN)` and `Name (DE)` fields (or `Title (EN)` / `Title (DE)` for tasks/plans)
2. On submit: save the base record with the value of the current language's field as `name`/`title`
3. Save the other language's value as a translation via `API.upsertTranslation()`

- [ ] **Step 1: Update tree.js modals**

For each add/edit modal in tree.js, replace the single Name/Description fields with dual-language fields. Example for `addSection`:

```javascript
addSection(factoryId) {
    Modal.show(t('modal_new_section'), [
        { name: 'name_en', label: t('field_name_en'), type: 'text', required: true },
        { name: 'name_de', label: t('field_name_de'), type: 'text' },
        { name: 'description', label: t('field_description'), type: 'textarea' },
    ], async (data) => {
        const payload = { name: data.name_en || data.name_de, description: data.description, factory_id: factoryId };
        const created = await API.createSection(payload);
        if (data.name_en) await API.upsertTranslation({ entity_type: 'section', entity_id: created.id, field_name: 'name', lang: 'en', value: data.name_en });
        if (data.name_de) await API.upsertTranslation({ entity_type: 'section', entity_id: created.id, field_name: 'name', lang: 'de', value: data.name_de });
        this.refresh();
    });
},
```

Apply the same pattern to: `addEquipment`, `addComponent`, `editFactory`, `editSection`, `editEquipment`, `editComponent`, and the `deleteFactory/Section/Equipment/Component` confirmations (these stay the same, just use `t()` for messages).

- [ ] **Step 2: Update dashboard.js modals**

Apply the same dual-language pattern to `showNewTaskModal` and `showNewPlanModal`:

```javascript
showNewTaskModal() {
    API.getTree().then(tree => {
        const equipOptions = [{ value: '', label: t('modal_none') }];
        tree.forEach(f => {
            f.sections.forEach(s => {
                s.equipment_list.forEach(eq => {
                    equipOptions.push({ value: String(eq.id), label: `${f.name} > ${s.name} > ${eq.name}` });
                });
            });
        });

        Modal.show(t('modal_new_task'), [
            { name: 'title_en', label: t('field_title_en'), type: 'text', required: true },
            { name: 'title_de', label: t('field_title_de'), type: 'text' },
            { name: 'description', label: t('field_description'), type: 'textarea' },
            { name: 'due_date', label: t('field_due_date'), type: 'date', required: true },
            { name: 'equipment_id', label: t('field_equipment'), type: 'select', options: equipOptions },
        ], async (data) => {
            const payload = {
                title: data.title_en || data.title_de,
                description: data.description,
                due_date: data.due_date,
            };
            if (data.equipment_id) payload.equipment_id = parseInt(data.equipment_id);
            const created = await API.createTask(payload);
            if (data.title_en) await API.upsertTranslation({ entity_type: 'task', entity_id: created.id, field_name: 'title', lang: 'en', value: data.title_en });
            if (data.title_de) await API.upsertTranslation({ entity_type: 'task', entity_id: created.id, field_name: 'title', lang: 'de', value: data.title_de });
            this.load();
        });
    });
},
```

Same pattern for `showNewPlanModal`.

- [ ] **Step 3: Update app.js factory modal**

Same pattern for the "New Plant" modal.

- [ ] **Step 4: Update dashboard.js `renderTable` to use TranslationCache**

In the `renderTable` method, translate task titles and equipment names:

```javascript
const translatedTitle = TranslationCache.get('task', t.id, 'title', t.title);
const translatedFactory = TranslationCache.get('factory', null, 'name', t.factory_name); // factory_id not available in row
```

Note: Since the dashboard task rows don't include entity IDs for factory/section/equipment, we fall back to untranslated names for those. The title can be translated since we have `t.id`.

Actually, a simpler approach: just translate the task title in `renderTable` since we have the task ID. The factory/section/equipment names in the table can stay as-is (they come from the dashboard API which returns base values).

- [ ] **Step 5: Commit**

```bash
git add app/static/js/tree.js app/static/js/dashboard.js app/static/js/app.js
git commit -m "feat: add dual-language fields to create/edit modals with translation save"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Models + migration + schemas | None |
| 2 | Translations API | Task 1 |
| 3 | Checklist API | Task 1 |
| 4 | Activity log API + auto-logging | Task 1 |
| 5 | Dashboard API updates | Task 1 |
| 6 | i18n.js module | None |
| 7 | TranslationCache module | Task 2, Task 6 |
| 8 | Language toggle + apply i18n to all files | Task 6, Task 7 |
| 9 | Detail pane HTML + CSS | None |
| 10 | Detail pane JS rewrite | Tasks 3, 4, 5, 6, 9 |
| 11 | E2E test updates | Task 10 |
| 12 | Translation fields in modals | Tasks 2, 6, 7 |
