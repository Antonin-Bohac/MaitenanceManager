# Maintenance Manager Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user factory maintenance management web app running in Docker.

**Architecture:** FastAPI backend serving REST API + static HTML/CSS/JS frontend. SQLite database with SQLAlchemy ORM. All served from a single Docker container with volume-mounted data directory.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy, SQLite, vanilla HTML/CSS/JS, Docker

---

## File Structure

```
MaitenanceManager/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, startup, static mount
│   ├── database.py           # SQLAlchemy engine, session, Base
│   ├── models.py             # All SQLAlchemy ORM models
│   ├── schemas.py            # Pydantic request/response schemas
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── factories.py      # /api/factories CRUD
│   │   ├── sections.py       # /api/sections CRUD
│   │   ├── equipment.py      # /api/equipment CRUD
│   │   ├── components.py     # /api/components CRUD
│   │   ├── documentation.py  # /api/documentation CRUD
│   │   ├── maintenance.py    # /api/maintenance/tasks, plans, overview
│   │   └── tree.py           # /api/tree endpoint
│   └── static/
│       ├── index.html         # Main SPA page
│       ├── css/
│       │   └── style.css      # All styles (light/dark theme)
│       └── js/
│           ├── app.js         # Main app init, router, state
│           ├── api.js         # API client (fetch wrappers)
│           ├── tree.js        # Sidebar tree component
│           ├── detail.js      # Detail panel rendering
│           └── modal.js       # Modal dialogs for CRUD forms
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # Pytest fixtures (test client, test db)
│   ├── test_factories.py
│   ├── test_sections.py
│   ├── test_equipment.py
│   ├── test_components.py
│   ├── test_documentation.py
│   └── test_maintenance.py
├── .gitignore
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## Chunk 1: Project Setup + Database + Models

### Task 1: Project skeleton, dependencies, minimal app

**Files:**
- Create: `.gitignore`
- Create: `requirements.txt`
- Create: `app/__init__.py`
- Create: `app/database.py`
- Create: `app/main.py`
- Create: `app/static/index.html`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`

- [ ] **Step 1: Create .gitignore**

```
__pycache__/
*.pyc
*.pyo
data/
test.db
.pytest_cache/
.superpowers/
```

- [ ] **Step 2: Create requirements.txt**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pydantic==2.10.4
pytest==8.3.4
httpx==0.28.1
```

- [ ] **Step 3: Create app/__init__.py** (empty file)

- [ ] **Step 4: Create app/database.py**

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = os.environ.get("DATA_DIR", "./data")
os.makedirs(DATA_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{DATA_DIR}/maintenance.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Create placeholder app/static/index.html**

```html
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="UTF-8"><title>Maintenance Manager</title></head>
<body><h1>Maintenance Manager</h1></body>
</html>
```

- [ ] **Step 6: Create app/main.py**

```python
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maintenance Manager")

# Routers will be added here (BEFORE static mount)

app.mount("/", StaticFiles(directory=str(Path(__file__).parent / "static"), html=True), name="static")
```

- [ ] **Step 7: Create tests/__init__.py** (empty file)

- [ ] **Step 8: Create tests/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)
```

- [ ] **Step 9: Install dependencies and verify setup**

```bash
pip install -r requirements.txt
pytest tests/ -v
```

Expected: no tests collected, no errors.

- [ ] **Step 10: Commit**

```bash
git add .gitignore requirements.txt app/__init__.py app/database.py app/main.py app/static/index.html tests/__init__.py tests/conftest.py
git commit -m "feat: project skeleton with database, minimal app, and test fixtures"
```

### Task 2: ORM Models

**Files:**
- Create: `app/models.py`

- [ ] **Step 1: Create app/models.py with all 7 models**

```python
from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Factory(Base):
    __tablename__ = "factories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    sections = relationship("Section", back_populates="factory", cascade="all, delete-orphan")


class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    factory = relationship("Factory", back_populates="sections")
    equipment_list = relationship("Equipment", back_populates="section", cascade="all, delete-orphan")


class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    section = relationship("Section", back_populates="equipment_list")
    components = relationship("Component", back_populates="equipment", cascade="all, delete-orphan")
    documentation = relationship("Documentation", back_populates="equipment", cascade="all, delete-orphan")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="equipment", cascade="all, delete-orphan")
    maintenance_plans = relationship("MaintenancePlan", back_populates="equipment", cascade="all, delete-orphan")


class Component(Base):
    __tablename__ = "components"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    equipment = relationship("Equipment", back_populates="components")
    documentation = relationship("Documentation", back_populates="component", cascade="all, delete-orphan")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="component", cascade="all, delete-orphan")
    maintenance_plans = relationship("MaintenancePlan", back_populates="component", cascade="all, delete-orphan")


class Documentation(Base):
    __tablename__ = "documentation"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    equipment = relationship("Equipment", back_populates="documentation")
    component = relationship("Component", back_populates="documentation")


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    due_date = Column(Date, nullable=False)
    status = Column(String(20), default="planned")  # planned, completed, overdue
    notes = Column(Text, default="")
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    plan_id = Column(Integer, ForeignKey("maintenance_plans.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    equipment = relationship("Equipment", back_populates="maintenance_tasks")
    component = relationship("Component", back_populates="maintenance_tasks")
    plan = relationship("MaintenancePlan", back_populates="tasks")


class MaintenancePlan(Base):
    __tablename__ = "maintenance_plans"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    interval_days = Column(Integer, nullable=False)
    last_completed = Column(Date, nullable=True)
    next_due = Column(Date, nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    equipment = relationship("Equipment", back_populates="maintenance_plans")
    component = relationship("Component", back_populates="maintenance_plans")
    tasks = relationship("MaintenanceTask", back_populates="plan")
```

- [ ] **Step 2: Commit**

```bash
git add app/models.py
git commit -m "feat: add all SQLAlchemy ORM models"
```

### Task 3: Pydantic schemas

**Files:**
- Create: `app/schemas.py`

- [ ] **Step 1: Create app/schemas.py**

```python
from datetime import date, datetime
from pydantic import BaseModel


# --- Factory ---
class FactoryCreate(BaseModel):
    name: str
    description: str = ""

class FactoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class FactoryOut(BaseModel):
    id: int
    name: str
    description: str
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Section ---
class SectionCreate(BaseModel):
    name: str
    description: str = ""
    factory_id: int

class SectionUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class SectionOut(BaseModel):
    id: int
    name: str
    description: str
    factory_id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Equipment ---
class EquipmentCreate(BaseModel):
    name: str
    description: str = ""
    section_id: int

class EquipmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class EquipmentOut(BaseModel):
    id: int
    name: str
    description: str
    section_id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Component ---
class ComponentCreate(BaseModel):
    name: str
    description: str = ""
    equipment_id: int

class ComponentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None

class ComponentOut(BaseModel):
    id: int
    name: str
    description: str
    equipment_id: int
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Documentation ---
class DocumentationCreate(BaseModel):
    name: str
    url: str
    equipment_id: int | None = None
    component_id: int | None = None

class DocumentationUpdate(BaseModel):
    name: str | None = None
    url: str | None = None

class DocumentationOut(BaseModel):
    id: int
    name: str
    url: str
    equipment_id: int | None
    component_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- MaintenanceTask ---
class MaintenanceTaskCreate(BaseModel):
    title: str
    description: str = ""
    due_date: date
    equipment_id: int | None = None
    component_id: int | None = None

class MaintenanceTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    status: str | None = None
    notes: str | None = None

class MaintenanceTaskOut(BaseModel):
    id: int
    title: str
    description: str
    due_date: date
    status: str
    notes: str
    equipment_id: int | None
    component_id: int | None
    plan_id: int | None
    created_at: datetime
    completed_at: datetime | None
    model_config = {"from_attributes": True}


# --- MaintenancePlan ---
class MaintenancePlanCreate(BaseModel):
    title: str
    description: str = ""
    interval_days: int
    next_due: date
    equipment_id: int | None = None
    component_id: int | None = None

class MaintenancePlanUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    interval_days: int | None = None

class MaintenancePlanOut(BaseModel):
    id: int
    title: str
    description: str
    interval_days: int
    last_completed: date | None
    next_due: date
    equipment_id: int | None
    component_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


# --- Tree ---
class TreeComponent(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}

class TreeEquipment(BaseModel):
    id: int
    name: str
    components: list[TreeComponent] = []
    model_config = {"from_attributes": True}

class TreeSection(BaseModel):
    id: int
    name: str
    equipment_list: list[TreeEquipment] = []
    model_config = {"from_attributes": True}

class TreeFactory(BaseModel):
    id: int
    name: str
    sections: list[TreeSection] = []
    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Commit**

```bash
git add app/schemas.py
git commit -m "feat: add Pydantic schemas for all entities"
```

---

## Chunk 2: CRUD API Routers

### Task 4: Factories router + tests

**Files:**
- Create: `app/routers/__init__.py`
- Create: `app/routers/factories.py`
- Create: `tests/test_factories.py`
- Modify: `app/main.py` (add router include)

- [ ] **Step 1: Write tests for factories CRUD**

```python
# tests/test_factories.py
def test_create_factory(client):
    r = client.post("/api/factories", json={"name": "Závod Praha", "description": "Hlavní závod"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Závod Praha"
    assert data["id"] is not None

def test_list_factories(client):
    client.post("/api/factories", json={"name": "Závod A"})
    client.post("/api/factories", json={"name": "Závod B"})
    r = client.get("/api/factories")
    assert r.status_code == 200
    assert len(r.json()) == 2

def test_get_factory(client):
    r = client.post("/api/factories", json={"name": "Test"})
    fid = r.json()["id"]
    r = client.get(f"/api/factories/{fid}")
    assert r.status_code == 200
    assert r.json()["name"] == "Test"

def test_update_factory(client):
    r = client.post("/api/factories", json={"name": "Old"})
    fid = r.json()["id"]
    r = client.put(f"/api/factories/{fid}", json={"name": "New"})
    assert r.status_code == 200
    assert r.json()["name"] == "New"

def test_delete_factory(client):
    r = client.post("/api/factories", json={"name": "ToDelete"})
    fid = r.json()["id"]
    r = client.delete(f"/api/factories/{fid}")
    assert r.status_code == 200
    r = client.get(f"/api/factories/{fid}")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_factories.py -v
```

- [ ] **Step 3: Implement factories router**

```python
# app/routers/factories.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Factory
from app.schemas import FactoryCreate, FactoryUpdate, FactoryOut

router = APIRouter(prefix="/api/factories", tags=["factories"])

@router.get("", response_model=list[FactoryOut])
def list_factories(db: Session = Depends(get_db)):
    return db.query(Factory).all()

@router.post("", response_model=FactoryOut)
def create_factory(data: FactoryCreate, db: Session = Depends(get_db)):
    factory = Factory(**data.model_dump())
    db.add(factory)
    db.commit()
    db.refresh(factory)
    return factory

@router.get("/{factory_id}", response_model=FactoryOut)
def get_factory(factory_id: int, db: Session = Depends(get_db)):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")
    return factory

@router.put("/{factory_id}", response_model=FactoryOut)
def update_factory(factory_id: int, data: FactoryUpdate, db: Session = Depends(get_db)):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(factory, key, val)
    db.commit()
    db.refresh(factory)
    return factory

@router.delete("/{factory_id}")
def delete_factory(factory_id: int, db: Session = Depends(get_db)):
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(404, "Factory not found")
    db.delete(factory)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Create app/routers/__init__.py** (empty file)

- [ ] **Step 5: Add router to app/main.py**

Add BEFORE `app.mount(...)`:
```python
from app.routers import factories
app.include_router(factories.router)
```

- [ ] **Step 6: Run tests — verify they pass**

```bash
pytest tests/test_factories.py -v
```

Expected: 5 passed

- [ ] **Step 7: Commit**

```bash
git add app/routers/ tests/test_factories.py app/main.py
git commit -m "feat: factories CRUD router with tests"
```

### Task 5: Sections router + tests

**Files:**
- Create: `app/routers/sections.py`
- Create: `tests/test_sections.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write tests for sections CRUD**

```python
# tests/test_sections.py
import pytest

@pytest.fixture
def factory_id(client):
    r = client.post("/api/factories", json={"name": "Test Factory"})
    return r.json()["id"]

def test_create_section(client, factory_id):
    r = client.post("/api/sections", json={"name": "Linka 1", "factory_id": factory_id})
    assert r.status_code == 200
    assert r.json()["name"] == "Linka 1"

def test_list_sections_by_factory(client, factory_id):
    client.post("/api/sections", json={"name": "A", "factory_id": factory_id})
    client.post("/api/sections", json={"name": "B", "factory_id": factory_id})
    r = client.get(f"/api/sections?factory_id={factory_id}")
    assert len(r.json()) == 2

def test_update_section(client, factory_id):
    r = client.post("/api/sections", json={"name": "Old", "factory_id": factory_id})
    sid = r.json()["id"]
    r = client.put(f"/api/sections/{sid}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_section(client, factory_id):
    r = client.post("/api/sections", json={"name": "Del", "factory_id": factory_id})
    sid = r.json()["id"]
    client.delete(f"/api/sections/{sid}")
    r = client.get(f"/api/sections/{sid}")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement sections router**

```python
# app/routers/sections.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Section
from app.schemas import SectionCreate, SectionUpdate, SectionOut

router = APIRouter(prefix="/api/sections", tags=["sections"])

@router.get("", response_model=list[SectionOut])
def list_sections(factory_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Section)
    if factory_id:
        q = q.filter(Section.factory_id == factory_id)
    return q.all()

@router.post("", response_model=SectionOut)
def create_section(data: SectionCreate, db: Session = Depends(get_db)):
    section = Section(**data.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    return section

@router.get("/{section_id}", response_model=SectionOut)
def get_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(404, "Section not found")
    return section

@router.put("/{section_id}", response_model=SectionOut)
def update_section(section_id: int, data: SectionUpdate, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(404, "Section not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(section, key, val)
    db.commit()
    db.refresh(section)
    return section

@router.delete("/{section_id}")
def delete_section(section_id: int, db: Session = Depends(get_db)):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(404, "Section not found")
    db.delete(section)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Add to app/main.py** (before static mount)

```python
from app.routers import sections
app.include_router(sections.router)
```

- [ ] **Step 5: Run tests — verify they pass**

- [ ] **Step 6: Commit**

```bash
git add app/routers/sections.py tests/test_sections.py app/main.py
git commit -m "feat: sections CRUD router with tests"
```

### Task 6: Equipment router + tests

**Files:**
- Create: `app/routers/equipment.py`
- Create: `tests/test_equipment.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write tests for equipment CRUD**

```python
# tests/test_equipment.py
import pytest

@pytest.fixture
def section_id(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    return s["id"]

def test_create_equipment(client, section_id):
    r = client.post("/api/equipment", json={"name": "CNC Fréza", "section_id": section_id})
    assert r.status_code == 200
    assert r.json()["name"] == "CNC Fréza"

def test_list_equipment_by_section(client, section_id):
    client.post("/api/equipment", json={"name": "A", "section_id": section_id})
    client.post("/api/equipment", json={"name": "B", "section_id": section_id})
    r = client.get(f"/api/equipment?section_id={section_id}")
    assert len(r.json()) == 2

def test_update_equipment(client, section_id):
    r = client.post("/api/equipment", json={"name": "Old", "section_id": section_id})
    eid = r.json()["id"]
    r = client.put(f"/api/equipment/{eid}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_equipment(client, section_id):
    r = client.post("/api/equipment", json={"name": "Del", "section_id": section_id})
    eid = r.json()["id"]
    client.delete(f"/api/equipment/{eid}")
    r = client.get(f"/api/equipment/{eid}")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement equipment router**

```python
# app/routers/equipment.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Equipment
from app.schemas import EquipmentCreate, EquipmentUpdate, EquipmentOut

router = APIRouter(prefix="/api/equipment", tags=["equipment"])

@router.get("", response_model=list[EquipmentOut])
def list_equipment(section_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Equipment)
    if section_id:
        q = q.filter(Equipment.section_id == section_id)
    return q.all()

@router.post("", response_model=EquipmentOut)
def create_equipment(data: EquipmentCreate, db: Session = Depends(get_db)):
    equipment = Equipment(**data.model_dump())
    db.add(equipment)
    db.commit()
    db.refresh(equipment)
    return equipment

@router.get("/{equipment_id}", response_model=EquipmentOut)
def get_equipment(equipment_id: int, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(404, "Equipment not found")
    return equipment

@router.put("/{equipment_id}", response_model=EquipmentOut)
def update_equipment(equipment_id: int, data: EquipmentUpdate, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(404, "Equipment not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(equipment, key, val)
    db.commit()
    db.refresh(equipment)
    return equipment

@router.delete("/{equipment_id}")
def delete_equipment(equipment_id: int, db: Session = Depends(get_db)):
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(404, "Equipment not found")
    db.delete(equipment)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Add to app/main.py** (before static mount)

```python
from app.routers import equipment
app.include_router(equipment.router)
```

- [ ] **Step 5: Run tests — verify they pass**

- [ ] **Step 6: Commit**

```bash
git add app/routers/equipment.py tests/test_equipment.py app/main.py
git commit -m "feat: equipment CRUD router with tests"
```

### Task 7: Components router + tests

**Files:**
- Create: `app/routers/components.py`
- Create: `tests/test_components.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write tests for components CRUD**

```python
# tests/test_components.py
import pytest

@pytest.fixture
def equipment_id(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    return e["id"]

def test_create_component(client, equipment_id):
    r = client.post("/api/components", json={"name": "Motor", "equipment_id": equipment_id})
    assert r.status_code == 200
    assert r.json()["name"] == "Motor"

def test_list_components_by_equipment(client, equipment_id):
    client.post("/api/components", json={"name": "A", "equipment_id": equipment_id})
    client.post("/api/components", json={"name": "B", "equipment_id": equipment_id})
    r = client.get(f"/api/components?equipment_id={equipment_id}")
    assert len(r.json()) == 2

def test_update_component(client, equipment_id):
    r = client.post("/api/components", json={"name": "Old", "equipment_id": equipment_id})
    cid = r.json()["id"]
    r = client.put(f"/api/components/{cid}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_component(client, equipment_id):
    r = client.post("/api/components", json={"name": "Del", "equipment_id": equipment_id})
    cid = r.json()["id"]
    client.delete(f"/api/components/{cid}")
    r = client.get(f"/api/components/{cid}")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement components router**

```python
# app/routers/components.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Component
from app.schemas import ComponentCreate, ComponentUpdate, ComponentOut

router = APIRouter(prefix="/api/components", tags=["components"])

@router.get("", response_model=list[ComponentOut])
def list_components(equipment_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Component)
    if equipment_id:
        q = q.filter(Component.equipment_id == equipment_id)
    return q.all()

@router.post("", response_model=ComponentOut)
def create_component(data: ComponentCreate, db: Session = Depends(get_db)):
    component = Component(**data.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    return component

@router.get("/{component_id}", response_model=ComponentOut)
def get_component(component_id: int, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(404, "Component not found")
    return component

@router.put("/{component_id}", response_model=ComponentOut)
def update_component(component_id: int, data: ComponentUpdate, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(404, "Component not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(component, key, val)
    db.commit()
    db.refresh(component)
    return component

@router.delete("/{component_id}")
def delete_component(component_id: int, db: Session = Depends(get_db)):
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(404, "Component not found")
    db.delete(component)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Add to app/main.py** (before static mount)

```python
from app.routers import components
app.include_router(components.router)
```

- [ ] **Step 5: Run tests — verify they pass**

- [ ] **Step 6: Commit**

```bash
git add app/routers/components.py tests/test_components.py app/main.py
git commit -m "feat: components CRUD router with tests"
```

### Task 8: Documentation router + tests

**Files:**
- Create: `app/routers/documentation.py`
- Create: `tests/test_documentation.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write tests for documentation CRUD**

```python
# tests/test_documentation.py
import pytest

@pytest.fixture
def ids(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    c = client.post("/api/components", json={"name": "C", "equipment_id": e["id"]}).json()
    return {"equipment_id": e["id"], "component_id": c["id"]}

def test_create_doc_for_equipment(client, ids):
    r = client.post("/api/documentation", json={
        "name": "Manual", "url": "https://example.com/manual.pdf",
        "equipment_id": ids["equipment_id"]
    })
    assert r.status_code == 200
    assert r.json()["equipment_id"] == ids["equipment_id"]

def test_create_doc_for_component(client, ids):
    r = client.post("/api/documentation", json={
        "name": "Schéma", "url": "https://example.com/schema.pdf",
        "component_id": ids["component_id"]
    })
    assert r.status_code == 200
    assert r.json()["component_id"] == ids["component_id"]

def test_list_docs_by_equipment(client, ids):
    client.post("/api/documentation", json={
        "name": "A", "url": "https://a.com", "equipment_id": ids["equipment_id"]
    })
    r = client.get(f"/api/documentation?equipment_id={ids['equipment_id']}")
    assert len(r.json()) == 1

def test_list_docs_by_component(client, ids):
    client.post("/api/documentation", json={
        "name": "A", "url": "https://a.com", "component_id": ids["component_id"]
    })
    r = client.get(f"/api/documentation?component_id={ids['component_id']}")
    assert len(r.json()) == 1

def test_update_doc(client, ids):
    r = client.post("/api/documentation", json={
        "name": "Old", "url": "https://old.com", "equipment_id": ids["equipment_id"]
    })
    did = r.json()["id"]
    r = client.put(f"/api/documentation/{did}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_doc(client, ids):
    r = client.post("/api/documentation", json={
        "name": "Del", "url": "https://del.com", "equipment_id": ids["equipment_id"]
    })
    did = r.json()["id"]
    client.delete(f"/api/documentation/{did}")
    r = client.get(f"/api/documentation/{did}")
    assert r.status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement documentation router**

```python
# app/routers/documentation.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Documentation
from app.schemas import DocumentationCreate, DocumentationUpdate, DocumentationOut

router = APIRouter(prefix="/api/documentation", tags=["documentation"])

@router.get("", response_model=list[DocumentationOut])
def list_documentation(
    equipment_id: int | None = Query(None),
    component_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Documentation)
    if equipment_id:
        q = q.filter(Documentation.equipment_id == equipment_id)
    if component_id:
        q = q.filter(Documentation.component_id == component_id)
    return q.all()

@router.post("", response_model=DocumentationOut)
def create_documentation(data: DocumentationCreate, db: Session = Depends(get_db)):
    doc = Documentation(**data.model_dump())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

@router.get("/{doc_id}", response_model=DocumentationOut)
def get_documentation(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Documentation).filter(Documentation.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Documentation not found")
    return doc

@router.put("/{doc_id}", response_model=DocumentationOut)
def update_documentation(doc_id: int, data: DocumentationUpdate, db: Session = Depends(get_db)):
    doc = db.query(Documentation).filter(Documentation.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Documentation not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(doc, key, val)
    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/{doc_id}")
def delete_documentation(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Documentation).filter(Documentation.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Documentation not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Add to app/main.py** (before static mount)

```python
from app.routers import documentation
app.include_router(documentation.router)
```

- [ ] **Step 5: Run tests — verify they pass**

- [ ] **Step 6: Commit**

```bash
git add app/routers/documentation.py tests/test_documentation.py app/main.py
git commit -m "feat: documentation CRUD router with tests"
```

### Task 9: Maintenance router (tasks + plans + overview) + tests

**Files:**
- Create: `app/routers/maintenance.py`
- Create: `tests/test_maintenance.py`
- Modify: `app/main.py`

- [ ] **Step 1: Write tests for maintenance**

```python
# tests/test_maintenance.py
import pytest
from datetime import date, timedelta

@pytest.fixture
def equipment_id(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    return e["id"]

@pytest.fixture
def component_id(client, equipment_id):
    c = client.post("/api/components", json={"name": "C", "equipment_id": equipment_id}).json()
    return c["id"]

# --- Task CRUD ---
def test_create_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={
        "title": "Výměna oleje", "due_date": "2026-04-01", "equipment_id": equipment_id
    })
    assert r.status_code == 200
    assert r.json()["status"] == "planned"

def test_complete_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={
        "title": "Test", "due_date": "2026-04-01", "equipment_id": equipment_id
    })
    tid = r.json()["id"]
    r = client.put(f"/api/maintenance/tasks/{tid}", json={"status": "completed"})
    assert r.json()["status"] == "completed"
    assert r.json()["completed_at"] is not None

def test_update_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={
        "title": "Old", "due_date": "2026-04-01", "equipment_id": equipment_id
    })
    tid = r.json()["id"]
    r = client.put(f"/api/maintenance/tasks/{tid}", json={"title": "New", "notes": "Updated"})
    assert r.json()["title"] == "New"
    assert r.json()["notes"] == "Updated"

def test_delete_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={
        "title": "Del", "due_date": "2026-04-01", "equipment_id": equipment_id
    })
    tid = r.json()["id"]
    r = client.delete(f"/api/maintenance/tasks/{tid}")
    assert r.status_code == 200
    r = client.get(f"/api/maintenance/tasks/{tid}")
    assert r.status_code == 404

def test_list_tasks_by_component(client, component_id):
    client.post("/api/maintenance/tasks", json={
        "title": "T1", "due_date": "2026-04-01", "component_id": component_id
    })
    r = client.get(f"/api/maintenance/tasks?component_id={component_id}")
    assert len(r.json()) == 1

# --- Plan CRUD ---
def test_create_plan(client, equipment_id):
    r = client.post("/api/maintenance/plans", json={
        "title": "Pravidelná kontrola", "interval_days": 30,
        "next_due": "2026-04-01", "equipment_id": equipment_id
    })
    assert r.status_code == 200
    assert r.json()["interval_days"] == 30

def test_update_plan(client, equipment_id):
    r = client.post("/api/maintenance/plans", json={
        "title": "Old", "interval_days": 30, "next_due": "2026-04-01",
        "equipment_id": equipment_id
    })
    pid = r.json()["id"]
    r = client.put(f"/api/maintenance/plans/{pid}", json={"title": "New", "interval_days": 60})
    assert r.json()["title"] == "New"
    assert r.json()["interval_days"] == 60

def test_delete_plan(client, equipment_id):
    r = client.post("/api/maintenance/plans", json={
        "title": "Del", "interval_days": 30, "next_due": "2026-04-01",
        "equipment_id": equipment_id
    })
    pid = r.json()["id"]
    r = client.delete(f"/api/maintenance/plans/{pid}")
    assert r.status_code == 200
    r = client.get(f"/api/maintenance/plans/{pid}")
    assert r.status_code == 404

def test_list_plans_by_component(client, component_id):
    client.post("/api/maintenance/plans", json={
        "title": "P1", "interval_days": 14, "next_due": "2026-04-01",
        "component_id": component_id
    })
    r = client.get(f"/api/maintenance/plans?component_id={component_id}")
    assert len(r.json()) == 1

# --- Overview ---
def test_overview(client, equipment_id):
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    client.post("/api/maintenance/tasks", json={
        "title": "Upcoming", "due_date": tomorrow, "equipment_id": equipment_id
    })
    client.post("/api/maintenance/tasks", json={
        "title": "Overdue", "due_date": yesterday, "equipment_id": equipment_id
    })
    r = client.get("/api/maintenance/overview")
    assert r.status_code == 200
    data = r.json()
    assert len(data["upcoming"]) >= 1
    assert len(data["overdue"]) >= 1

# --- Auto-generate task from plan on completion ---
def test_complete_plan_task_generates_next(client, equipment_id):
    plan = client.post("/api/maintenance/plans", json={
        "title": "Recurring", "interval_days": 30,
        "next_due": date.today().isoformat(), "equipment_id": equipment_id
    }).json()
    # Complete the plan via PUT (marks current as done, generates next task)
    r = client.put(f"/api/maintenance/plans/{plan['id']}/complete")
    assert r.status_code == 200
    data = r.json()
    assert data["last_completed"] == date.today().isoformat()
    expected_next = (date.today() + timedelta(days=30)).isoformat()
    assert data["next_due"] == expected_next
    # A new task should have been created
    tasks = client.get(f"/api/maintenance/tasks?equipment_id={equipment_id}").json()
    plan_tasks = [t for t in tasks if t["plan_id"] == plan["id"]]
    assert len(plan_tasks) == 1
    assert plan_tasks[0]["due_date"] == expected_next
```

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement maintenance router**

```python
# app/routers/maintenance.py
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import MaintenanceTask, MaintenancePlan
from app.schemas import (
    MaintenanceTaskCreate, MaintenanceTaskUpdate, MaintenanceTaskOut,
    MaintenancePlanCreate, MaintenancePlanUpdate, MaintenancePlanOut,
)

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

# --- Tasks ---
@router.get("/tasks", response_model=list[MaintenanceTaskOut])
def list_tasks(
    equipment_id: int | None = Query(None),
    component_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(MaintenanceTask)
    if equipment_id:
        q = q.filter(MaintenanceTask.equipment_id == equipment_id)
    if component_id:
        q = q.filter(MaintenanceTask.component_id == component_id)
    return q.all()

@router.post("/tasks", response_model=MaintenanceTaskOut)
def create_task(data: MaintenanceTaskCreate, db: Session = Depends(get_db)):
    task = MaintenanceTask(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.get("/tasks/{task_id}", response_model=MaintenanceTaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return task

@router.put("/tasks/{task_id}", response_model=MaintenanceTaskOut)
def update_task(task_id: int, data: MaintenanceTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    update = data.model_dump(exclude_unset=True)
    if update.get("status") == "completed" and task.status != "completed":
        update["completed_at"] = datetime.utcnow()
    for key, val in update.items():
        setattr(task, key, val)
    db.commit()
    db.refresh(task)
    return task

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return {"ok": True}

# --- Plans ---
@router.get("/plans", response_model=list[MaintenancePlanOut])
def list_plans(
    equipment_id: int | None = Query(None),
    component_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(MaintenancePlan)
    if equipment_id:
        q = q.filter(MaintenancePlan.equipment_id == equipment_id)
    if component_id:
        q = q.filter(MaintenancePlan.component_id == component_id)
    return q.all()

@router.post("/plans", response_model=MaintenancePlanOut)
def create_plan(data: MaintenancePlanCreate, db: Session = Depends(get_db)):
    plan = MaintenancePlan(**data.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/plans/{plan_id}", response_model=MaintenancePlanOut)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(MaintenancePlan).filter(MaintenancePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    return plan

@router.put("/plans/{plan_id}", response_model=MaintenancePlanOut)
def update_plan(plan_id: int, data: MaintenancePlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(MaintenancePlan).filter(MaintenancePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(plan, key, val)
    db.commit()
    db.refresh(plan)
    return plan

@router.put("/plans/{plan_id}/complete", response_model=MaintenancePlanOut)
def complete_plan(plan_id: int, db: Session = Depends(get_db)):
    """Mark current plan cycle as completed. Updates last_completed, calculates next_due,
    and auto-generates a new MaintenanceTask for the next due date."""
    plan = db.query(MaintenancePlan).filter(MaintenancePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    today = date.today()
    plan.last_completed = today
    plan.next_due = today + timedelta(days=plan.interval_days)
    # Auto-generate next task
    next_task = MaintenanceTask(
        title=plan.title,
        description=plan.description,
        due_date=plan.next_due,
        status="planned",
        equipment_id=plan.equipment_id,
        component_id=plan.component_id,
        plan_id=plan.id,
    )
    db.add(next_task)
    db.commit()
    db.refresh(plan)
    return plan

@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(MaintenancePlan).filter(MaintenancePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    db.delete(plan)
    db.commit()
    return {"ok": True}

# --- Overview ---
@router.get("/overview")
def maintenance_overview(db: Session = Depends(get_db)):
    today = date.today()
    # Auto-update overdue status
    overdue_tasks = db.query(MaintenanceTask).filter(
        MaintenanceTask.due_date < today,
        MaintenanceTask.status == "planned",
    ).all()
    for task in overdue_tasks:
        task.status = "overdue"
    if overdue_tasks:
        db.commit()

    all_overdue = db.query(MaintenanceTask).filter(
        MaintenanceTask.status == "overdue",
    ).all()
    upcoming = db.query(MaintenanceTask).filter(
        MaintenanceTask.due_date >= today,
        MaintenanceTask.status == "planned",
    ).all()
    return {
        "overdue": [MaintenanceTaskOut.model_validate(t).model_dump() for t in all_overdue],
        "upcoming": [MaintenanceTaskOut.model_validate(t).model_dump() for t in upcoming],
    }
```

- [ ] **Step 4: Add to app/main.py** (before static mount)

```python
from app.routers import maintenance
app.include_router(maintenance.router)
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
pytest tests/test_maintenance.py -v
```

- [ ] **Step 6: Commit**

```bash
git add app/routers/maintenance.py tests/test_maintenance.py app/main.py
git commit -m "feat: maintenance tasks, plans, overview, and auto-generation with tests"
```

### Task 10: Tree endpoint for sidebar

**Files:**
- Create: `app/routers/tree.py`
- Modify: `app/main.py`

- [ ] **Step 1: Add tree endpoint test to tests/test_factories.py**

Append to `tests/test_factories.py`:
```python
def test_tree(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    client.post("/api/components", json={"name": "C", "equipment_id": e["id"]})
    r = client.get("/api/tree")
    assert r.status_code == 200
    tree = r.json()
    assert len(tree) == 1
    assert len(tree[0]["sections"]) == 1
    assert len(tree[0]["sections"][0]["equipment_list"]) == 1
    assert len(tree[0]["sections"][0]["equipment_list"][0]["components"]) == 1
```

- [ ] **Step 2: Run test — verify it fails**

- [ ] **Step 3: Create app/routers/tree.py**

```python
# app/routers/tree.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Factory, Section, Equipment
from app.schemas import TreeFactory

router = APIRouter(tags=["tree"])

@router.get("/api/tree", response_model=list[TreeFactory])
def get_tree(db: Session = Depends(get_db)):
    factories = db.query(Factory).options(
        joinedload(Factory.sections)
        .joinedload(Section.equipment_list)
        .joinedload(Equipment.components)
    ).all()
    return factories
```

- [ ] **Step 4: Add to app/main.py** (before static mount)

```python
from app.routers import tree
app.include_router(tree.router)
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
pytest tests/test_factories.py::test_tree -v
```

- [ ] **Step 6: Commit**

```bash
git add app/routers/tree.py tests/test_factories.py app/main.py
git commit -m "feat: add /api/tree endpoint for sidebar hierarchy"
```

---

## Chunk 3: Frontend

### Task 11: HTML structure + CSS theme

**Files:**
- Modify: `app/static/index.html`
- Create: `app/static/css/style.css`

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maintenance Manager</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <header class="topbar">
        <h1>Maintenance Manager</h1>
        <button id="theme-toggle" title="Přepnout motiv">&#9680;</button>
    </header>
    <div class="layout">
        <aside id="sidebar" class="sidebar">
            <div class="sidebar-header">
                <h2>Navigace</h2>
                <button id="add-factory-btn" class="btn-icon" title="Přidat továrnu">+</button>
            </div>
            <div id="tree"></div>
        </aside>
        <main id="detail" class="detail">
            <div class="empty-state">
                <p>Vyberte položku z navigace nebo přidejte novou továrnu.</p>
            </div>
        </main>
    </div>
    <div id="modal-overlay" class="modal-overlay hidden"></div>
    <script src="/js/api.js"></script>
    <script src="/js/modal.js"></script>
    <script src="/js/tree.js"></script>
    <script src="/js/detail.js"></script>
    <script src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write style.css**

```css
/* === CSS Custom Properties === */
:root {
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    --bg-tertiary: #e8e8e8;
    --text-primary: #1a1a1a;
    --text-secondary: #555555;
    --border-color: #dddddd;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --success: #16a34a;
    --warning: #ca8a04;
    --danger: #dc2626;
    --sidebar-width: 280px;
    --topbar-height: 48px;
    --radius: 6px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
        --bg-primary: #1a1a2e;
        --bg-secondary: #16213e;
        --bg-tertiary: #0f3460;
        --text-primary: #e0e0e0;
        --text-secondary: #a0a0a0;
        --border-color: #2a2a4a;
    }
}

[data-theme="dark"] {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-tertiary: #0f3460;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --border-color: #2a2a4a;
}

/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: var(--font);
    background: var(--bg-primary);
    color: var(--text-primary);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* === Topbar === */
.topbar {
    height: var(--topbar-height);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    flex-shrink: 0;
}
.topbar h1 { font-size: 16px; font-weight: 600; }
#theme-toggle {
    background: none; border: none; color: var(--text-primary);
    font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: var(--radius);
}
#theme-toggle:hover { background: var(--bg-tertiary); }

/* === Layout === */
.layout {
    display: flex;
    flex: 1;
    overflow: hidden;
}

/* === Sidebar === */
.sidebar {
    width: var(--sidebar-width);
    background: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    overflow-y: auto;
    flex-shrink: 0;
}
.sidebar-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
}
.sidebar-header h2 { font-size: 14px; font-weight: 600; }

/* === Tree === */
.tree-node { user-select: none; }
.tree-label {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 8px; cursor: pointer; border-radius: var(--radius);
    font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tree-label:hover { background: var(--bg-tertiary); }
.tree-label.selected { background: var(--accent); color: #fff; }
.tree-toggle {
    width: 16px; text-align: center; font-size: 10px;
    color: var(--text-secondary); flex-shrink: 0; cursor: pointer;
}
.tree-children { padding-left: 16px; }
.tree-children.collapsed { display: none; }
.tree-actions {
    margin-left: auto; display: flex; gap: 2px; opacity: 0;
}
.tree-label:hover .tree-actions { opacity: 1; }
.tree-actions button {
    background: none; border: none; color: var(--text-secondary);
    cursor: pointer; font-size: 12px; padding: 2px 4px; border-radius: 3px;
}
.tree-actions button:hover { background: var(--bg-primary); color: var(--text-primary); }

/* === Detail Panel === */
.detail {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
}
.empty-state {
    display: flex; align-items: center; justify-content: center;
    height: 100%; color: var(--text-secondary);
}
.detail-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px;
}
.detail-header h2 { font-size: 20px; }
.detail-actions { display: flex; gap: 8px; }
.detail-section {
    margin-bottom: 24px;
}
.detail-section h3 {
    font-size: 14px; font-weight: 600; margin-bottom: 12px;
    color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;
}
.detail-description {
    color: var(--text-secondary); margin-bottom: 16px; font-size: 14px;
}

/* === Cards / List Items === */
.item-list { display: flex; flex-direction: column; gap: 8px; }
.item-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius);
    padding: 12px 16px;
    display: flex; align-items: center; justify-content: space-between;
    cursor: pointer;
    transition: border-color 0.15s;
}
.item-card:hover { border-color: var(--accent); }
.item-card .item-name { font-weight: 500; font-size: 14px; }
.item-card .item-meta { font-size: 12px; color: var(--text-secondary); }

/* === Status badges === */
.status { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
.status-planned { background: var(--bg-tertiary); color: var(--text-secondary); }
.status-completed { background: #dcfce7; color: var(--success); }
.status-overdue { background: #fef2f2; color: var(--danger); }
[data-theme="dark"] .status-completed { background: #052e16; }
[data-theme="dark"] .status-overdue { background: #450a0a; }
@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .status-completed { background: #052e16; }
    :root:not([data-theme="light"]) .status-overdue { background: #450a0a; }
}

/* === Buttons === */
.btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--radius); border: 1px solid var(--border-color);
    background: var(--bg-secondary); color: var(--text-primary);
    font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover { background: var(--accent-hover); }
.btn-danger { color: var(--danger); }
.btn-danger:hover { background: #fef2f2; border-color: var(--danger); }
.btn-icon {
    background: none; border: 1px solid var(--border-color); color: var(--text-primary);
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    border-radius: var(--radius); cursor: pointer; font-size: 16px;
}
.btn-icon:hover { background: var(--bg-tertiary); }
.btn-sm { padding: 4px 10px; font-size: 12px; }

/* === Modal === */
.modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
}
.modal-overlay.hidden { display: none; }
.modal {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 24px;
    min-width: 400px; max-width: 500px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.modal h3 { margin-bottom: 16px; font-size: 16px; }
.modal-field { margin-bottom: 12px; }
.modal-field label {
    display: block; font-size: 12px; font-weight: 600;
    margin-bottom: 4px; color: var(--text-secondary);
}
.modal-field input, .modal-field textarea, .modal-field select {
    width: 100%; padding: 8px 12px; border: 1px solid var(--border-color);
    border-radius: var(--radius); background: var(--bg-secondary);
    color: var(--text-primary); font-size: 14px; font-family: var(--font);
}
.modal-field textarea { min-height: 80px; resize: vertical; }
.modal-buttons {
    display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;
}

/* === Doc links === */
.doc-link {
    display: inline-flex; align-items: center; gap: 4px;
    color: var(--accent); text-decoration: none; font-size: 13px;
    padding: 4px 8px; border-radius: var(--radius);
}
.doc-link:hover { background: var(--bg-tertiary); }
```

- [ ] **Step 3: Commit**

```bash
mkdir -p app/static/css app/static/js
git add app/static/index.html app/static/css/style.css
git commit -m "feat: HTML structure and CSS with light/dark theme"
```

### Task 12: API client (JS)

**Files:**
- Create: `app/static/js/api.js`

- [ ] **Step 1: Write api.js**

```javascript
const API = {
    async request(method, url, data) {
        const opts = { method, headers: {} };
        if (data) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data);
        }
        const r = await fetch(url, opts);
        if (!r.ok) {
            const text = await r.text();
            throw new Error(`${r.status}: ${text}`);
        }
        return r.json();
    },
    get: (url) => API.request('GET', url),
    post: (url, data) => API.request('POST', url, data),
    put: (url, data) => API.request('PUT', url, data),
    del: (url) => API.request('DELETE', url),

    // Tree
    getTree: () => API.get('/api/tree'),

    // Factories
    createFactory: (data) => API.post('/api/factories', data),
    updateFactory: (id, data) => API.put(`/api/factories/${id}`, data),
    deleteFactory: (id) => API.del(`/api/factories/${id}`),
    getFactory: (id) => API.get(`/api/factories/${id}`),

    // Sections
    createSection: (data) => API.post('/api/sections', data),
    updateSection: (id, data) => API.put(`/api/sections/${id}`, data),
    deleteSection: (id) => API.del(`/api/sections/${id}`),
    getSection: (id) => API.get(`/api/sections/${id}`),

    // Equipment
    createEquipment: (data) => API.post('/api/equipment', data),
    updateEquipment: (id, data) => API.put(`/api/equipment/${id}`, data),
    deleteEquipment: (id) => API.del(`/api/equipment/${id}`),
    getEquipment: (id) => API.get(`/api/equipment/${id}`),

    // Components
    createComponent: (data) => API.post('/api/components', data),
    updateComponent: (id, data) => API.put(`/api/components/${id}`, data),
    deleteComponent: (id) => API.del(`/api/components/${id}`),
    getComponent: (id) => API.get(`/api/components/${id}`),

    // Documentation
    getDocs: (params) => API.get(`/api/documentation?${new URLSearchParams(params)}`),
    createDoc: (data) => API.post('/api/documentation', data),
    updateDoc: (id, data) => API.put(`/api/documentation/${id}`, data),
    deleteDoc: (id) => API.del(`/api/documentation/${id}`),

    // Maintenance Tasks
    getTasks: (params) => API.get(`/api/maintenance/tasks?${new URLSearchParams(params)}`),
    createTask: (data) => API.post('/api/maintenance/tasks', data),
    updateTask: (id, data) => API.put(`/api/maintenance/tasks/${id}`, data),
    deleteTask: (id) => API.del(`/api/maintenance/tasks/${id}`),

    // Maintenance Plans
    getPlans: (params) => API.get(`/api/maintenance/plans?${new URLSearchParams(params)}`),
    createPlan: (data) => API.post('/api/maintenance/plans', data),
    updatePlan: (id, data) => API.put(`/api/maintenance/plans/${id}`, data),
    deletePlan: (id) => API.del(`/api/maintenance/plans/${id}`),
    completePlan: (id) => API.put(`/api/maintenance/plans/${id}/complete`),

    // Overview
    getOverview: () => API.get('/api/maintenance/overview'),
};
```

- [ ] **Step 2: Commit**

```bash
git add app/static/js/api.js
git commit -m "feat: JS API client with all endpoints"
```

### Task 13: Modal component (JS)

**Files:**
- Create: `app/static/js/modal.js`

- [ ] **Step 1: Write modal.js**

```javascript
const Modal = {
    overlay: null,

    init() {
        this.overlay = document.getElementById('modal-overlay');
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
    },

    show(title, fields, onSubmit) {
        let html = `<div class="modal"><h3>${title}</h3><form id="modal-form">`;
        fields.forEach(f => {
            html += `<div class="modal-field">`;
            html += `<label for="field-${f.name}">${f.label}</label>`;
            if (f.type === 'textarea') {
                html += `<textarea id="field-${f.name}" name="${f.name}" ${f.required ? 'required' : ''}>${f.value || ''}</textarea>`;
            } else if (f.type === 'select') {
                html += `<select id="field-${f.name}" name="${f.name}" ${f.required ? 'required' : ''}>`;
                (f.options || []).forEach(o => {
                    const sel = o.value === f.value ? 'selected' : '';
                    html += `<option value="${o.value}" ${sel}>${o.label}</option>`;
                });
                html += `</select>`;
            } else {
                html += `<input id="field-${f.name}" name="${f.name}" type="${f.type || 'text'}" value="${f.value || ''}" ${f.required ? 'required' : ''}>`;
            }
            html += `</div>`;
        });
        html += `<div class="modal-buttons">`;
        html += `<button type="button" class="btn" onclick="Modal.hide()">Zrušit</button>`;
        html += `<button type="submit" class="btn btn-primary">Uložit</button>`;
        html += `</div></form></div>`;

        this.overlay.innerHTML = html;
        this.overlay.classList.remove('hidden');

        document.getElementById('modal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {};
            formData.forEach((val, key) => {
                // Try to parse as number for *_id fields
                if (key.endsWith('_id') && val) {
                    data[key] = parseInt(val, 10);
                } else if (key === 'interval_days' && val) {
                    data[key] = parseInt(val, 10);
                } else {
                    data[key] = val;
                }
            });
            try {
                await onSubmit(data);
                this.hide();
            } catch (err) {
                alert('Chyba: ' + err.message);
            }
        });

        // Focus first input
        const first = this.overlay.querySelector('input, textarea, select');
        if (first) first.focus();
    },

    confirm(message, onConfirm) {
        let html = `<div class="modal">`;
        html += `<h3>Potvrzení</h3>`;
        html += `<p style="margin-bottom:16px; color: var(--text-secondary)">${message}</p>`;
        html += `<div class="modal-buttons">`;
        html += `<button class="btn" onclick="Modal.hide()">Zrušit</button>`;
        html += `<button class="btn btn-danger" id="modal-confirm-btn">Smazat</button>`;
        html += `</div></div>`;

        this.overlay.innerHTML = html;
        this.overlay.classList.remove('hidden');

        document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
            try {
                await onConfirm();
                this.hide();
            } catch (err) {
                alert('Chyba: ' + err.message);
            }
        });
    },

    hide() {
        this.overlay.classList.add('hidden');
        this.overlay.innerHTML = '';
    }
};
```

- [ ] **Step 2: Commit**

```bash
git add app/static/js/modal.js
git commit -m "feat: generic modal component for CRUD forms"
```

### Task 14: Tree sidebar component (JS)

**Files:**
- Create: `app/static/js/tree.js`

- [ ] **Step 1: Write tree.js**

```javascript
const Tree = {
    container: null,
    selectedEl: null,

    init() {
        this.container = document.getElementById('tree');
    },

    async refresh() {
        const data = await API.getTree();
        this.container.innerHTML = '';
        data.forEach(factory => {
            this.container.appendChild(this.renderFactory(factory));
        });
    },

    renderFactory(f) {
        return this.renderNode({
            type: 'factory', id: f.id, name: f.name,
            children: f.sections.map(s => this.renderSection(s, f.id)),
            onAdd: () => this.addSection(f.id),
            onEdit: () => this.editFactory(f),
            onDelete: () => this.deleteFactory(f),
        });
    },

    renderSection(s, factoryId) {
        return this.renderNode({
            type: 'section', id: s.id, name: s.name,
            children: s.equipment_list.map(e => this.renderEquipment(e, s.id)),
            onAdd: () => this.addEquipment(s.id),
            onEdit: () => this.editSection(s),
            onDelete: () => this.deleteSection(s),
        });
    },

    renderEquipment(e, sectionId) {
        return this.renderNode({
            type: 'equipment', id: e.id, name: e.name,
            children: e.components.map(c => this.renderComponent(c, e.id)),
            onAdd: () => this.addComponent(e.id),
            onEdit: () => this.editEquipment(e),
            onDelete: () => this.deleteEquipment(e),
        });
    },

    renderComponent(c, equipmentId) {
        return this.renderNode({
            type: 'component', id: c.id, name: c.name,
            children: [],
            onEdit: () => this.editComponent(c),
            onDelete: () => this.deleteComponent(c),
        });
    },

    renderNode({ type, id, name, children, onAdd, onEdit, onDelete }) {
        const node = document.createElement('div');
        node.className = 'tree-node';

        const label = document.createElement('div');
        label.className = 'tree-label';
        label.dataset.type = type;
        label.dataset.id = id;

        const hasChildren = children && children.length > 0;
        const icons = { factory: '\u{1F3ED}', section: '\u{1F4C1}', equipment: '\u{2699}\uFE0F', component: '\u{1F529}' };

        // Toggle
        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = hasChildren ? '\u25BC' : (onAdd ? '\u25B6' : ' ');

        label.appendChild(toggle);

        // Icon + name
        const text = document.createElement('span');
        text.textContent = `${icons[type] || ''} ${name}`;
        text.style.overflow = 'hidden';
        text.style.textOverflow = 'ellipsis';
        label.appendChild(text);

        // Actions
        const actions = document.createElement('span');
        actions.className = 'tree-actions';
        if (onAdd) {
            const addBtn = document.createElement('button');
            addBtn.textContent = '+';
            addBtn.title = 'Přidat';
            addBtn.addEventListener('click', (e) => { e.stopPropagation(); onAdd(); });
            actions.appendChild(addBtn);
        }
        if (onEdit) {
            const editBtn = document.createElement('button');
            editBtn.textContent = '\u270E';
            editBtn.title = 'Upravit';
            editBtn.addEventListener('click', (e) => { e.stopPropagation(); onEdit(); });
            actions.appendChild(editBtn);
        }
        if (onDelete) {
            const delBtn = document.createElement('button');
            delBtn.textContent = '\u2715';
            delBtn.title = 'Smazat';
            delBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
            actions.appendChild(delBtn);
        }
        label.appendChild(actions);

        // Click to select
        label.addEventListener('click', () => {
            if (this.selectedEl) this.selectedEl.classList.remove('selected');
            label.classList.add('selected');
            this.selectedEl = label;
            Detail.show(type, id);
        });

        node.appendChild(label);

        // Children container
        if (children && children.length > 0) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            children.forEach(c => childContainer.appendChild(c));
            node.appendChild(childContainer);

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                childContainer.classList.toggle('collapsed');
                toggle.textContent = childContainer.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
            });
        } else if (onAdd) {
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children collapsed';
            node.appendChild(childContainer);
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                childContainer.classList.toggle('collapsed');
                toggle.textContent = childContainer.classList.contains('collapsed') ? '\u25B6' : '\u25BC';
            });
        }

        return node;
    },

    // --- CRUD helpers ---
    addSection(factoryId) {
        Modal.show('Nová sekce', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => {
            data.factory_id = factoryId;
            await API.createSection(data);
            this.refresh();
        });
    },
    addEquipment(sectionId) {
        Modal.show('Nové zařízení', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => {
            data.section_id = sectionId;
            await API.createEquipment(data);
            this.refresh();
        });
    },
    addComponent(equipmentId) {
        Modal.show('Nová komponenta', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => {
            data.equipment_id = equipmentId;
            await API.createComponent(data);
            this.refresh();
        });
    },
    editFactory(f) {
        Modal.show('Upravit továrnu', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: f.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: f.description || '' },
        ], async (data) => {
            await API.updateFactory(f.id, data);
            this.refresh();
        });
    },
    editSection(s) {
        Modal.show('Upravit sekci', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: s.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: s.description || '' },
        ], async (data) => {
            await API.updateSection(s.id, data);
            this.refresh();
        });
    },
    editEquipment(e) {
        Modal.show('Upravit zařízení', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: e.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: e.description || '' },
        ], async (data) => {
            await API.updateEquipment(e.id, data);
            this.refresh();
        });
    },
    editComponent(c) {
        Modal.show('Upravit komponentu', [
            { name: 'name', label: 'Název', type: 'text', required: true, value: c.name },
            { name: 'description', label: 'Popis', type: 'textarea', value: c.description || '' },
        ], async (data) => {
            await API.updateComponent(c.id, data);
            this.refresh();
        });
    },
    deleteFactory(f) {
        Modal.confirm(`Opravdu smazat továrnu "${f.name}" a vše v ní?`, async () => {
            await API.deleteFactory(f.id);
            this.refresh();
            Detail.clear();
        });
    },
    deleteSection(s) {
        Modal.confirm(`Opravdu smazat sekci "${s.name}" a vše v ní?`, async () => {
            await API.deleteSection(s.id);
            this.refresh();
            Detail.clear();
        });
    },
    deleteEquipment(e) {
        Modal.confirm(`Opravdu smazat zařízení "${e.name}" a vše v něm?`, async () => {
            await API.deleteEquipment(e.id);
            this.refresh();
            Detail.clear();
        });
    },
    deleteComponent(c) {
        Modal.confirm(`Opravdu smazat komponentu "${c.name}"?`, async () => {
            await API.deleteComponent(c.id);
            this.refresh();
            Detail.clear();
        });
    },
};
```

- [ ] **Step 2: Commit**

```bash
git add app/static/js/tree.js
git commit -m "feat: sidebar tree navigation component"
```

### Task 15: Detail panel (JS)

**Files:**
- Create: `app/static/js/detail.js`

- [ ] **Step 1: Write detail.js**

```javascript
const Detail = {
    el: null,

    init() {
        this.el = document.getElementById('detail');
    },

    clear() {
        this.el.innerHTML = '<div class="empty-state"><p>Vyberte položku z navigace.</p></div>';
    },

    async show(type, id) {
        const fetchers = {
            factory: () => API.getFactory(id),
            section: () => API.getSection(id),
            equipment: () => API.getEquipment(id),
            component: () => API.getComponent(id),
        };
        const item = await fetchers[type]();
        const renderers = {
            factory: () => this.renderFactory(item),
            section: () => this.renderSection(item),
            equipment: () => this.renderEquipment(item),
            component: () => this.renderComponent(item),
        };
        this.el.innerHTML = renderers[type]();
        this.bindEvents(type, item);
    },

    renderFactory(f) {
        return `
            <div class="detail-header">
                <h2>\u{1F3ED} ${this.esc(f.name)}</h2>
            </div>
            ${f.description ? `<p class="detail-description">${this.esc(f.description)}</p>` : ''}
            <div class="detail-section">
                <h3>Informace</h3>
                <p style="font-size:13px; color:var(--text-secondary)">Typ: Továrna</p>
            </div>`;
    },

    renderSection(s) {
        return `
            <div class="detail-header">
                <h2>\u{1F4C1} ${this.esc(s.name)}</h2>
            </div>
            ${s.description ? `<p class="detail-description">${this.esc(s.description)}</p>` : ''}
            <div class="detail-section">
                <h3>Informace</h3>
                <p style="font-size:13px; color:var(--text-secondary)">Typ: Sekce</p>
            </div>`;
    },

    async renderEquipmentAsync(e) {
        const [docs, tasks, plans] = await Promise.all([
            API.getDocs({ equipment_id: e.id }),
            API.getTasks({ equipment_id: e.id }),
            API.getPlans({ equipment_id: e.id }),
        ]);
        return this.renderEquipmentDetail(e, docs, tasks, plans);
    },

    async renderComponentAsync(c) {
        const [docs, tasks, plans] = await Promise.all([
            API.getDocs({ component_id: c.id }),
            API.getTasks({ component_id: c.id }),
            API.getPlans({ component_id: c.id }),
        ]);
        return this.renderComponentDetail(c, docs, tasks, plans);
    },

    renderEquipment(e) {
        // Initial render, then async load details
        setTimeout(() => this.loadEquipmentDetails(e), 0);
        return `
            <div class="detail-header">
                <h2>\u2699\uFE0F ${this.esc(e.name)}</h2>
            </div>
            ${e.description ? `<p class="detail-description">${this.esc(e.description)}</p>` : ''}
            <div id="detail-extra">Načítám...</div>`;
    },

    renderComponent(c) {
        setTimeout(() => this.loadComponentDetails(c), 0);
        return `
            <div class="detail-header">
                <h2>\u{1F529} ${this.esc(c.name)}</h2>
            </div>
            ${c.description ? `<p class="detail-description">${this.esc(c.description)}</p>` : ''}
            <div id="detail-extra">Načítám...</div>`;
    },

    async loadEquipmentDetails(e) {
        const [docs, tasks, plans] = await Promise.all([
            API.getDocs({ equipment_id: e.id }),
            API.getTasks({ equipment_id: e.id }),
            API.getPlans({ equipment_id: e.id }),
        ]);
        const el = document.getElementById('detail-extra');
        if (!el) return;
        el.innerHTML = this.renderDetailsBlock(docs, tasks, plans, 'equipment_id', e.id);
        this.bindDetailEvents('equipment_id', e.id);
    },

    async loadComponentDetails(c) {
        const [docs, tasks, plans] = await Promise.all([
            API.getDocs({ component_id: c.id }),
            API.getTasks({ component_id: c.id }),
            API.getPlans({ component_id: c.id }),
        ]);
        const el = document.getElementById('detail-extra');
        if (!el) return;
        el.innerHTML = this.renderDetailsBlock(docs, tasks, plans, 'component_id', c.id);
        this.bindDetailEvents('component_id', c.id);
    },

    renderDetailsBlock(docs, tasks, plans, ownerKey, ownerId) {
        return `
            <div class="detail-section">
                <h3>Dokumentace <button class="btn btn-sm" data-action="add-doc">+ Přidat</button></h3>
                <div class="item-list">
                    ${docs.length === 0 ? '<p style="font-size:13px;color:var(--text-secondary)">Žádná dokumentace</p>' : ''}
                    ${docs.map(d => `
                        <div class="item-card">
                            <a href="${this.esc(d.url)}" target="_blank" class="doc-link">\u{1F4C4} ${this.esc(d.name)}</a>
                            <button class="btn btn-sm btn-danger" data-action="del-doc" data-id="${d.id}">\u2715</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detail-section">
                <h3>Údržba - úkoly <button class="btn btn-sm" data-action="add-task">+ Přidat</button></h3>
                <div class="item-list">
                    ${tasks.length === 0 ? '<p style="font-size:13px;color:var(--text-secondary)">Žádné úkoly</p>' : ''}
                    ${tasks.map(t => `
                        <div class="item-card">
                            <div>
                                <div class="item-name">${this.esc(t.title)}</div>
                                <div class="item-meta">${t.due_date} <span class="status status-${t.status}">${t.status}</span></div>
                            </div>
                            <div style="display:flex;gap:4px;">
                                ${t.status === 'planned' || t.status === 'overdue' ? `<button class="btn btn-sm" data-action="complete-task" data-id="${t.id}">\u2713</button>` : ''}
                                <button class="btn btn-sm btn-danger" data-action="del-task" data-id="${t.id}">\u2715</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detail-section">
                <h3>Údržba - plány <button class="btn btn-sm" data-action="add-plan">+ Přidat</button></h3>
                <div class="item-list">
                    ${plans.length === 0 ? '<p style="font-size:13px;color:var(--text-secondary)">Žádné plány</p>' : ''}
                    ${plans.map(p => `
                        <div class="item-card">
                            <div>
                                <div class="item-name">${this.esc(p.title)}</div>
                                <div class="item-meta">Každých ${p.interval_days} dní | Další: ${p.next_due}</div>
                            </div>
                            <div style="display:flex;gap:4px;">
                                <button class="btn btn-sm" data-action="complete-plan" data-id="${p.id}">\u2713 Hotovo</button>
                                <button class="btn btn-sm btn-danger" data-action="del-plan" data-id="${p.id}">\u2715</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    },

    bindEvents(type, item) {
        // Nothing needed for factory/section static views
    },

    bindDetailEvents(ownerKey, ownerId) {
        const extra = document.getElementById('detail-extra');
        if (!extra) return;

        extra.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const id = btn.dataset.id ? parseInt(btn.dataset.id) : null;

                if (action === 'add-doc') {
                    Modal.show('Přidat dokumentaci', [
                        { name: 'name', label: 'Název', type: 'text', required: true },
                        { name: 'url', label: 'URL', type: 'url', required: true },
                    ], async (data) => {
                        data[ownerKey] = ownerId;
                        await API.createDoc(data);
                        this.reloadDetails(ownerKey, ownerId);
                    });
                } else if (action === 'del-doc') {
                    await API.deleteDoc(id);
                    this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'add-task') {
                    Modal.show('Nový úkol údržby', [
                        { name: 'title', label: 'Název', type: 'text', required: true },
                        { name: 'description', label: 'Popis', type: 'textarea' },
                        { name: 'due_date', label: 'Termín', type: 'date', required: true },
                    ], async (data) => {
                        data[ownerKey] = ownerId;
                        await API.createTask(data);
                        this.reloadDetails(ownerKey, ownerId);
                    });
                } else if (action === 'complete-task') {
                    await API.updateTask(id, { status: 'completed' });
                    this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'del-task') {
                    await API.deleteTask(id);
                    this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'add-plan') {
                    Modal.show('Nový plán údržby', [
                        { name: 'title', label: 'Název', type: 'text', required: true },
                        { name: 'description', label: 'Popis', type: 'textarea' },
                        { name: 'interval_days', label: 'Interval (dny)', type: 'number', required: true },
                        { name: 'next_due', label: 'První termín', type: 'date', required: true },
                    ], async (data) => {
                        data[ownerKey] = ownerId;
                        await API.createPlan(data);
                        this.reloadDetails(ownerKey, ownerId);
                    });
                } else if (action === 'complete-plan') {
                    await API.completePlan(id);
                    this.reloadDetails(ownerKey, ownerId);
                } else if (action === 'del-plan') {
                    await API.deletePlan(id);
                    this.reloadDetails(ownerKey, ownerId);
                }
            });
        });
    },

    reloadDetails(ownerKey, ownerId) {
        if (ownerKey === 'equipment_id') {
            this.loadEquipmentDetails({ id: ownerId });
        } else {
            this.loadComponentDetails({ id: ownerId });
        }
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};
```

- [ ] **Step 2: Commit**

```bash
git add app/static/js/detail.js
git commit -m "feat: detail panel rendering for all entity types"
```

### Task 16: App initialization (JS)

**Files:**
- Create: `app/static/js/app.js`

- [ ] **Step 1: Write app.js**

```javascript
document.addEventListener('DOMContentLoaded', () => {
    // Init components
    Modal.init();
    Tree.init();
    Detail.init();

    // Theme handling
    const themeToggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('theme') || 'auto';
    applyTheme(saved);

    themeToggle.addEventListener('click', () => {
        const current = localStorage.getItem('theme') || 'auto';
        const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
        applyTheme(next);
        localStorage.setItem('theme', next);
    });

    function applyTheme(theme) {
        if (theme === 'auto') {
            delete document.documentElement.dataset.theme;
        } else {
            document.documentElement.dataset.theme = theme;
        }
        const icons = { auto: '\u25D0', light: '\u2600', dark: '\u263E' };
        themeToggle.textContent = icons[theme] || '\u25D0';
    }

    // Add factory button
    document.getElementById('add-factory-btn').addEventListener('click', () => {
        Modal.show('Nová továrna', [
            { name: 'name', label: 'Název', type: 'text', required: true },
            { name: 'description', label: 'Popis', type: 'textarea' },
        ], async (data) => {
            await API.createFactory(data);
            Tree.refresh();
        });
    });

    // Initial tree load
    Tree.refresh();
});
```

- [ ] **Step 2: Commit**

```bash
git add app/static/js/app.js
git commit -m "feat: app initialization with theme toggle and tree load"
```

---

## Chunk 4: Docker + Final Integration

### Task 17: Dockerfile and README

**Files:**
- Create: `Dockerfile`
- Create: `README.md`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV DATA_DIR=/app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create README.md**

```markdown
# Maintenance Manager

Webová aplikace pro správu údržby továrního zařízení.

## Spuštění (Docker)

```bash
docker build -t maintenance-manager .
docker run -p 8000:8000 -v mm-data:/app/data maintenance-manager
```

Otevřete http://localhost:8000 v prohlížeči.

## Vývoj (bez Dockeru)

```bash
pip install -r requirements.txt
DATA_DIR=./data uvicorn app.main:app --reload
```

## Testy

```bash
pytest tests/ -v
```
```

- [ ] **Step 3: Build and test Docker image**

```bash
docker build -t maintenance-manager .
docker run -d -p 8000:8000 -v mm-data:/app/data --name mm-test maintenance-manager
sleep 2
curl -s http://localhost:8000/api/factories
docker stop mm-test && docker rm mm-test
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile README.md
git commit -m "feat: Dockerfile and README for container deployment"
```

### Task 18: Run all tests, verify everything works

- [ ] **Step 1: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 2: Docker smoke test**

```bash
docker build -t maintenance-manager .
docker run -d -p 8000:8000 -v mm-data:/app/data --name mm-smoke maintenance-manager
```

Open http://localhost:8000 and verify:
- Tree sidebar loads
- Can create factory -> section -> equipment -> component
- Can add documentation links
- Can create maintenance tasks and plans
- Can complete plan (auto-generates next task)
- Theme toggle works (auto/light/dark)

```bash
docker stop mm-smoke && docker rm mm-smoke
```

- [ ] **Step 3: Final commit if any fixes needed**
