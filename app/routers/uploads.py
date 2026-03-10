import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.database import DATA_DIR

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = Path(DATA_DIR) / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".txt", ".csv"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("")
async def upload_file(file: UploadFile):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File extension '{ext}' is not allowed.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds the 20 MB size limit.")

    unique_name = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_DIR / unique_name
    dest.write_bytes(contents)

    return {
        "filename": unique_name,
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "url": f"/api/uploads/{unique_name}",
    }


@router.get("/{filename}")
async def serve_file(filename: str):
    # Guard against path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = UPLOAD_DIR / filename
    # Resolve and confirm the file is still inside UPLOAD_DIR
    try:
        resolved = file_path.resolve()
        upload_dir_resolved = UPLOAD_DIR.resolve()
        if not str(resolved).startswith(str(upload_dir_resolved)):
            raise HTTPException(status_code=400, detail="Invalid filename.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    if not resolved.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    return FileResponse(str(resolved))
