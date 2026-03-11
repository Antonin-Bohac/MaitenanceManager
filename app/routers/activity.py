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
