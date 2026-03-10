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
