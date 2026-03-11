import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def task_id():
    r = client.post("/api/maintenance/tasks", json={
        "title": "Activity Test Task", "due_date": "2026-12-01"
    })
    tid = r.json()["id"]
    yield tid
    client.delete(f"/api/maintenance/tasks/{tid}")


def test_task_created_logged(task_id):
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    assert r.status_code == 200
    entries = r.json()
    assert any(e["action"] == "task_created" for e in entries)


def test_status_change_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"status": "completed"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "status_changed" for e in entries)


def test_priority_change_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"priority": "high"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "priority_changed" for e in entries)


def test_assignee_change_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"assignee": "John"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "assignee_changed" for e in entries)


def test_notes_edit_logged(task_id):
    client.put(f"/api/maintenance/tasks/{task_id}", json={"notes": "Updated notes"})
    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "notes_edited" for e in entries)
