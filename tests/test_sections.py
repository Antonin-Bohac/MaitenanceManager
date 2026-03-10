import pytest

@pytest.fixture
def factory_id(client):
    r = client.post("/api/factories", json={"name": "Test Factory"})
    return r.json()["id"]

def test_create_section(client, factory_id):
    r = client.post("/api/sections", json={"name": "Linka 1", "factory_id": factory_id})
    assert r.status_code == 200
    assert r.json()["name"] == "Linka 1"

def test_list_sections_by_factory(client, factory_id):
    client.post("/api/sections", json={"name": "A", "factory_id": factory_id})
    client.post("/api/sections", json={"name": "B", "factory_id": factory_id})
    r = client.get(f"/api/sections?factory_id={factory_id}")
    assert len(r.json()) == 2

def test_update_section(client, factory_id):
    r = client.post("/api/sections", json={"name": "Old", "factory_id": factory_id})
    sid = r.json()["id"]
    r = client.put(f"/api/sections/{sid}", json={"name": "New"})
    assert r.json()["name"] == "New"

def test_delete_section(client, factory_id):
    r = client.post("/api/sections", json={"name": "Del", "factory_id": factory_id})
    sid = r.json()["id"]
    client.delete(f"/api/sections/{sid}")
    r = client.get(f"/api/sections/{sid}")
    assert r.status_code == 404
