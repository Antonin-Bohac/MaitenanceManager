import pytest
from datetime import date, timedelta

@pytest.fixture
def equipment_id(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    return e["id"]

@pytest.fixture
def component_id(client, equipment_id):
    c = client.post("/api/components", json={"name": "C", "equipment_id": equipment_id}).json()
    return c["id"]

def test_create_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={"title": "Výměna oleje", "due_date": "2026-04-01", "equipment_id": equipment_id})
    assert r.status_code == 200
    assert r.json()["status"] == "planned"

def test_complete_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={"title": "Test", "due_date": "2026-04-01", "equipment_id": equipment_id})
    tid = r.json()["id"]
    r = client.put(f"/api/maintenance/tasks/{tid}", json={"status": "completed"})
    assert r.json()["status"] == "completed"
    assert r.json()["completed_at"] is not None

def test_update_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={"title": "Old", "due_date": "2026-04-01", "equipment_id": equipment_id})
    tid = r.json()["id"]
    r = client.put(f"/api/maintenance/tasks/{tid}", json={"title": "New", "notes": "Updated"})
    assert r.json()["title"] == "New"
    assert r.json()["notes"] == "Updated"

def test_delete_task(client, equipment_id):
    r = client.post("/api/maintenance/tasks", json={"title": "Del", "due_date": "2026-04-01", "equipment_id": equipment_id})
    tid = r.json()["id"]
    r = client.delete(f"/api/maintenance/tasks/{tid}")
    assert r.status_code == 200
    r = client.get(f"/api/maintenance/tasks/{tid}")
    assert r.status_code == 404

def test_list_tasks_by_component(client, component_id):
    client.post("/api/maintenance/tasks", json={"title": "T1", "due_date": "2026-04-01", "component_id": component_id})
    r = client.get(f"/api/maintenance/tasks?component_id={component_id}")
    assert len(r.json()) == 1

def test_create_plan(client, equipment_id):
    r = client.post("/api/maintenance/plans", json={"title": "Pravidelná kontrola", "interval_days": 30, "next_due": "2026-04-01", "equipment_id": equipment_id})
    assert r.status_code == 200
    assert r.json()["interval_days"] == 30

def test_update_plan(client, equipment_id):
    r = client.post("/api/maintenance/plans", json={"title": "Old", "interval_days": 30, "next_due": "2026-04-01", "equipment_id": equipment_id})
    pid = r.json()["id"]
    r = client.put(f"/api/maintenance/plans/{pid}", json={"title": "New", "interval_days": 60})
    assert r.json()["title"] == "New"
    assert r.json()["interval_days"] == 60

def test_delete_plan(client, equipment_id):
    r = client.post("/api/maintenance/plans", json={"title": "Del", "interval_days": 30, "next_due": "2026-04-01", "equipment_id": equipment_id})
    pid = r.json()["id"]
    r = client.delete(f"/api/maintenance/plans/{pid}")
    assert r.status_code == 200
    r = client.get(f"/api/maintenance/plans/{pid}")
    assert r.status_code == 404

def test_list_plans_by_component(client, component_id):
    client.post("/api/maintenance/plans", json={"title": "P1", "interval_days": 14, "next_due": "2026-04-01", "component_id": component_id})
    r = client.get(f"/api/maintenance/plans?component_id={component_id}")
    assert len(r.json()) == 1

def test_overview(client, equipment_id):
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    client.post("/api/maintenance/tasks", json={"title": "Upcoming", "due_date": tomorrow, "equipment_id": equipment_id})
    client.post("/api/maintenance/tasks", json={"title": "Overdue", "due_date": yesterday, "equipment_id": equipment_id})
    r = client.get("/api/maintenance/overview")
    assert r.status_code == 200
    data = r.json()
    assert len(data["upcoming"]) >= 1
    assert len(data["overdue"]) >= 1

def test_complete_plan_task_generates_next(client, equipment_id):
    plan = client.post("/api/maintenance/plans", json={"title": "Recurring", "interval_days": 30, "next_due": date.today().isoformat(), "equipment_id": equipment_id}).json()
    r = client.put(f"/api/maintenance/plans/{plan['id']}/complete")
    assert r.status_code == 200
    data = r.json()
    assert data["last_completed"] == date.today().isoformat()
    expected_next = (date.today() + timedelta(days=30)).isoformat()
    assert data["next_due"] == expected_next
    tasks = client.get(f"/api/maintenance/tasks?equipment_id={equipment_id}").json()
    plan_tasks = [t for t in tasks if t["plan_id"] == plan["id"]]
    assert len(plan_tasks) == 1
    assert plan_tasks[0]["due_date"] == expected_next
