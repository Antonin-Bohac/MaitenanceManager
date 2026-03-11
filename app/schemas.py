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


# --- MaintenanceTask ---
class MaintenanceTaskCreate(BaseModel):
    title: str
    description: str = ""
    due_date: date
    priority: str = "medium"
    assignee: str | None = None
    estimated_minutes: int | None = None
    equipment_id: int | None = None
    component_id: int | None = None

class MaintenanceTaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: date | None = None
    status: str | None = None
    notes: str | None = None
    priority: str | None = None
    assignee: str | None = None
    estimated_minutes: int | None = None

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
