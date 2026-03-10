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
