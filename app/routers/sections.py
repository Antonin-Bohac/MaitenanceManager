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
