from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maintenance Manager")

from app.routers import factories, sections, equipment, components, documentation, maintenance, tree
app.include_router(factories.router)
app.include_router(sections.router)
app.include_router(equipment.router)
app.include_router(components.router)
app.include_router(documentation.router)
app.include_router(maintenance.router)
app.include_router(tree.router)

app.mount("/", StaticFiles(directory=str(Path(__file__).parent / "static"), html=True), name="static")
