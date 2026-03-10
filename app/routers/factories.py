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
