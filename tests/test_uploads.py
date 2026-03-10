import io
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


def _make_file(content: bytes = b"hello pdf", filename: str = "test.pdf", content_type: str = "application/pdf"):
    return ("file", (filename, io.BytesIO(content), content_type))


def test_upload_file(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.post("/api/uploads", files=[_make_file()])
    assert r.status_code == 200
    data = r.json()
    assert data["original_filename"] == "test.pdf"
    assert data["url"].startswith("/api/uploads/")
    assert data["size"] == len(b"hello pdf")


def test_upload_rejected_extension(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.post("/api/uploads", files=[_make_file(b"virus", "bad.exe", "application/octet-stream")])
    assert r.status_code == 400
    assert "not allowed" in r.json()["detail"]


def test_serve_uploaded_file(client, tmp_path):
    # Place a real file in the patched UPLOAD_DIR
    test_file = tmp_path / "sample.txt"
    test_file.write_bytes(b"file content")

    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.get("/api/uploads/sample.txt")
    assert r.status_code == 200
    assert r.content == b"file content"


def test_serve_missing_file_returns_404(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.get("/api/uploads/nonexistent.pdf")
    assert r.status_code == 404


def test_path_traversal_blocked(client, tmp_path):
    with patch("app.routers.uploads.UPLOAD_DIR", tmp_path):
        r = client.get("/api/uploads/..%2Fetc%2Fpasswd")
    # FastAPI decodes the path parameter; the router should reject it
    assert r.status_code in (400, 404)
