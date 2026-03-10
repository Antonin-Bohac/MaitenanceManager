from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.database import Base, engine
from app.routers import factories, sections, equipment, components, documentation, maintenance, tree, uploads

Base.metadata.create_all(bind=engine)

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Maintenance Manager")
app.include_router(factories.router)
app.include_router(sections.router)
app.include_router(equipment.router)
app.include_router(components.router)
app.include_router(documentation.router)
app.include_router(maintenance.router)
app.include_router(tree.router)
app.include_router(uploads.router)

app.mount("/css", StaticFiles(directory=str(STATIC_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(STATIC_DIR / "js")), name="js")


@app.get("/")
async def serve_index():
    return FileResponse(str(STATIC_DIR / "index.html"))
