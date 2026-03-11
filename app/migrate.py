"""Database migration: add i18n, checklist, activity log, and task fields."""
from sqlalchemy import text
from app.database import engine, Base
from app.models import Translation, TaskChecklistItem, TaskActivityLog


def migrate():
    # Create new tables
    Base.metadata.create_all(bind=engine, tables=[
        Translation.__table__,
        TaskChecklistItem.__table__,
        TaskActivityLog.__table__,
    ])

    with engine.connect() as conn:
        # Check existing columns on maintenance_tasks
        result = conn.execute(text("PRAGMA table_info(maintenance_tasks)"))
        existing_cols = {row[1] for row in result}

        if "priority" not in existing_cols:
            conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN priority VARCHAR(20) DEFAULT 'medium'"))
        if "assignee" not in existing_cols:
            conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN assignee VARCHAR(200)"))
        if "estimated_minutes" not in existing_cols:
            conn.execute(text("ALTER TABLE maintenance_tasks ADD COLUMN estimated_minutes INTEGER"))
        conn.commit()

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
