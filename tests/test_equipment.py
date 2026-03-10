import pytest

@pytest.fixture
def section_id(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    return s["id"]

def test_create_equipment(client, section_id):
    r = client.post("/api/equipment", json={"name": "CNC Fréza", "section_id": section_id})
    assert r.status_code == 200
    assert r.json()["name"] == "CNC Fréza"

def test_list_equipment_by_section(client, section_id):
    client.post("/api/equipment", json={"name": "A", "section_id": section_id})
    client.post("/api/equipment", json={"name": "B", "section_id": section_id})
    r = client.get(f"/api/equipment?section_id={section_id}")
    assert len(r.json()) == 2

def test_update_equipment(client, section_id):
    r = client.post("/api/equipment", json={"name": "Old", "section_id": section_id})
    eid = r.json()["id"]
    r = client.put(f"/api/equipment/{eid}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_equipment(client, section_id):
    r = client.post("/api/equipment", json={"name": "Del", "section_id": section_id})
    eid = r.json()["id"]
    client.delete(f"/api/equipment/{eid}")
    r = client.get(f"/api/equipment/{eid}")
    assert r.status_code == 404
