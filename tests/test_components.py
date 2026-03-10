import pytest

@pytest.fixture
def equipment_id(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    return e["id"]

def test_create_component(client, equipment_id):
    r = client.post("/api/components", json={"name": "Motor", "equipment_id": equipment_id})
    assert r.status_code == 200
    assert r.json()["name"] == "Motor"

def test_list_components_by_equipment(client, equipment_id):
    client.post("/api/components", json={"name": "A", "equipment_id": equipment_id})
    client.post("/api/components", json={"name": "B", "equipment_id": equipment_id})
    r = client.get(f"/api/components?equipment_id={equipment_id}")
    assert len(r.json()) == 2

def test_update_component(client, equipment_id):
    r = client.post("/api/components", json={"name": "Old", "equipment_id": equipment_id})
    cid = r.json()["id"]
    r = client.put(f"/api/components/{cid}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_component(client, equipment_id):
    r = client.post("/api/components", json={"name": "Del", "equipment_id": equipment_id})
    cid = r.json()["id"]
    client.delete(f"/api/components/{cid}")
    r = client.get(f"/api/components/{cid}")
    assert r.status_code == 404
