from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import MaintenanceTask, MaintenancePlan, Equipment, Component, Section, Factory
from app.schemas import (
    MaintenanceTaskCreate, MaintenanceTaskUpdate, MaintenanceTaskOut,
    MaintenancePlanCreate, MaintenancePlanUpdate, MaintenancePlanOut,
)

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

@router.get("/tasks", response_model=list[MaintenanceTaskOut])
def list_tasks(equipment_id: int | None = Query(None), component_id: int | None = Query(None), db: Session = Depends(get_db)):
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

@router.get("/plans", response_model=list[MaintenancePlanOut])
def list_plans(equipment_id: int | None = Query(None), component_id: int | None = Query(None), db: Session = Depends(get_db)):
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
    plan = db.query(MaintenancePlan).filter(MaintenancePlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    today = date.today()
    plan.last_completed = today
    plan.next_due = today + timedelta(days=plan.interval_days)
    next_task = MaintenanceTask(
        title=plan.title, description=plan.description, due_date=plan.next_due,
        status="planned", equipment_id=plan.equipment_id, component_id=plan.component_id, plan_id=plan.id,
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

@router.get("/overview")
def maintenance_overview(db: Session = Depends(get_db)):
    today = date.today()
    overdue_tasks = db.query(MaintenanceTask).filter(MaintenanceTask.due_date < today, MaintenanceTask.status == "planned").all()
    for task in overdue_tasks:
        task.status = "overdue"
    if overdue_tasks:
        db.commit()
    all_overdue = db.query(MaintenanceTask).filter(MaintenanceTask.status == "overdue").all()
    upcoming = db.query(MaintenanceTask).filter(MaintenanceTask.due_date >= today, MaintenanceTask.status == "planned").all()
    return {
        "overdue": [MaintenanceTaskOut.model_validate(t).model_dump() for t in all_overdue],
        "upcoming": [MaintenanceTaskOut.model_validate(t).model_dump() for t in upcoming],
    }


@router.get("/dashboard")
def dashboard_data(db: Session = Depends(get_db)):
    today = date.today()
    # Auto-mark overdue
    overdue_tasks = db.query(MaintenanceTask).filter(
        MaintenanceTask.due_date < today, MaintenanceTask.status == "planned"
    ).all()
    for task in overdue_tasks:
        task.status = "overdue"
    if overdue_tasks:
        db.commit()

    # All tasks with relationships
    tasks = (
        db.query(MaintenanceTask)
        .options(
            joinedload(MaintenanceTask.equipment).joinedload(Equipment.section).joinedload(Section.factory),
            joinedload(MaintenanceTask.component).joinedload(Component.equipment),
        )
        .order_by(MaintenanceTask.due_date.asc())
        .all()
    )

    rows = []
    for t in tasks:
        equipment_name = t.equipment.name if t.equipment else (t.component.equipment.name if t.component and t.component.equipment else "")
        component_name = t.component.name if t.component else ""
        section_name = ""
        factory_name = ""
        if t.equipment and t.equipment.section:
            section_name = t.equipment.section.name
            if t.equipment.section.factory:
                factory_name = t.equipment.section.factory.name
        elif t.component and t.component.equipment and t.component.equipment.section:
            section_name = t.component.equipment.section.name
            if t.component.equipment.section.factory:
                factory_name = t.component.equipment.section.factory.name

        rows.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "status": t.status,
            "equipment_name": equipment_name,
            "component_name": component_name,
            "section_name": section_name,
            "factory_name": factory_name,
            "equipment_id": t.equipment_id,
            "component_id": t.component_id,
            "plan_id": t.plan_id,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        })

    # Stats
    total_tasks = len(rows)
    overdue_count = sum(1 for r in rows if r["status"] == "overdue")
    planned_count = sum(1 for r in rows if r["status"] == "planned")
    completed_count = sum(1 for r in rows if r["status"] == "completed")
    total_equipment = db.query(Equipment).count()
    total_plans = db.query(MaintenancePlan).count()

    return {
        "tasks": rows,
        "stats": {
            "total_tasks": total_tasks,
            "overdue": overdue_count,
            "planned": planned_count,
            "completed": completed_count,
            "total_equipment": total_equipment,
            "total_plans": total_plans,
        },
    }
