import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def task_id():
    r = client.post("/api/maintenance/tasks", json={
        "title": "Checklist Test Task", "due_date": "2026-12-01"
    })
    tid = r.json()["id"]
    yield tid
    client.delete(f"/api/maintenance/tasks/{tid}")


def test_add_and_list_checklist(task_id):
    r = client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Check oil"})
    assert r.status_code == 200
    item = r.json()
    assert item["text"] == "Check oil"
    assert item["is_completed"] is False

    r = client.get(f"/api/maintenance/tasks/{task_id}/checklist")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_toggle_checklist_item(task_id):
    r = client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Replace filter"})
    item_id = r.json()["id"]

    r = client.put(f"/api/maintenance/tasks/{task_id}/checklist/{item_id}", json={"is_completed": True})
    assert r.status_code == 200
    assert r.json()["is_completed"] is True


def test_delete_checklist_item(task_id):
    r = client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Temp item"})
    item_id = r.json()["id"]

    r = client.delete(f"/api/maintenance/tasks/{task_id}/checklist/{item_id}")
    assert r.status_code == 200

    r = client.get(f"/api/maintenance/tasks/{task_id}/checklist")
    assert len(r.json()) == 0


def test_checklist_creates_activity_log(task_id):
    client.post(f"/api/maintenance/tasks/{task_id}/checklist", json={"text": "Logged item"})

    r = client.get(f"/api/maintenance/tasks/{task_id}/activity")
    entries = r.json()
    assert any(e["action"] == "checklist_added" for e in entries)
