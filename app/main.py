from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import Base, engine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maintenance Manager")

# Routers will be added here (BEFORE static mount)

app.mount("/", StaticFiles(directory=str(Path(__file__).parent / "static"), html=True), name="static")
