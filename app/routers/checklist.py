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
