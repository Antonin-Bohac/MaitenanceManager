from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Translation
from app.schemas import TranslationUpsert, TranslationOut

router = APIRouter(prefix="/api/translations", tags=["translations"])


@router.get("", response_model=list[TranslationOut])
def list_translations(
    entity_type: str = Query(...),
    entity_id: int | None = Query(None),
    lang: str = Query(...),
    db: Session = Depends(get_db),
):
    q = db.query(Translation).filter(
        Translation.entity_type == entity_type,
        Translation.lang == lang,
    )
    if entity_id is not None:
        q = q.filter(Translation.entity_id == entity_id)
    return q.all()


@router.get("/batch", response_model=list[TranslationOut])
def batch_translations(
    entity_type: str = Query(...),
    lang: str = Query(...),
    db: Session = Depends(get_db),
):
    return (
        db.query(Translation)
        .filter(Translation.entity_type == entity_type, Translation.lang == lang)
        .all()
    )


@router.put("", response_model=TranslationOut)
def upsert_translation(data: TranslationUpsert, db: Session = Depends(get_db)):
    existing = (
        db.query(Translation)
        .filter(
            Translation.entity_type == data.entity_type,
            Translation.entity_id == data.entity_id,
            Translation.field_name == data.field_name,
            Translation.lang == data.lang,
        )
        .first()
    )
    if existing:
        existing.value = data.value
        db.commit()
        db.refresh(existing)
        return existing
    else:
        t = Translation(**data.model_dump())
        db.add(t)
        db.commit()
        db.refresh(t)
        return t
