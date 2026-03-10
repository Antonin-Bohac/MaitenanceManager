import pytest

@pytest.fixture
def ids(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    c = client.post("/api/components", json={"name": "C", "equipment_id": e["id"]}).json()
    return {"equipment_id": e["id"], "component_id": c["id"]}

def test_create_doc_for_equipment(client, ids):
    r = client.post("/api/documentation", json={"name": "Manual", "url": "https://example.com/manual.pdf", "equipment_id": ids["equipment_id"]})
    assert r.status_code == 200
    assert r.json()["equipment_id"] == ids["equipment_id"]

def test_create_doc_for_component(client, ids):
    r = client.post("/api/documentation", json={"name": "Schéma", "url": "https://example.com/schema.pdf", "component_id": ids["component_id"]})
    assert r.status_code == 200
    assert r.json()["component_id"] == ids["component_id"]

def test_list_docs_by_equipment(client, ids):
    client.post("/api/documentation", json={"name": "A", "url": "https://a.com", "equipment_id": ids["equipment_id"]})
    r = client.get(f"/api/documentation?equipment_id={ids['equipment_id']}")
    assert len(r.json()) == 1

def test_list_docs_by_component(client, ids):
    client.post("/api/documentation", json={"name": "A", "url": "https://a.com", "component_id": ids["component_id"]})
    r = client.get(f"/api/documentation?component_id={ids['component_id']}")
    assert len(r.json()) == 1

def test_update_doc(client, ids):
    r = client.post("/api/documentation", json={"name": "Old", "url": "https://old.com", "equipment_id": ids["equipment_id"]})
    did = r.json()["id"]
    r = client.put(f"/api/documentation/{did}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_doc(client, ids):
    r = client.post("/api/documentation", json={"name": "Del", "url": "https://del.com", "equipment_id": ids["equipment_id"]})
    did = r.json()["id"]
    client.delete(f"/api/documentation/{did}")
    r = client.get(f"/api/documentation/{did}")
    assert r.status_code == 404
