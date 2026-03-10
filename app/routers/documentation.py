from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Documentation
from app.schemas import DocumentationCreate, DocumentationUpdate, DocumentationOut

router = APIRouter(prefix="/api/documentation", tags=["documentation"])

@router.get("", response_model=list[DocumentationOut])
def list_documentation(equipment_id: int | None = Query(None), component_id: int | None = Query(None), task_id: int | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Documentation)
    if equipment_id:
        q = q.filter(Documentation.equipment_id == equipment_id)
    if component_id:
        q = q.filter(Documentation.component_id == component_id)
    if task_id:
        q = q.filter(Documentation.task_id == task_id)
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
