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
