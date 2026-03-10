from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Factory, Section, Equipment
from app.schemas import TreeFactory

router = APIRouter(tags=["tree"])

@router.get("/api/tree", response_model=list[TreeFactory])
def get_tree(db: Session = Depends(get_db)):
    factories = db.query(Factory).options(
        joinedload(Factory.sections)
        .joinedload(Section.equipment_list)
        .joinedload(Equipment.components)
    ).all()
    return factories
