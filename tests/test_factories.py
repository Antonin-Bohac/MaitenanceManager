def test_create_factory(client):
    r = client.post("/api/factories", json={"name": "Závod Praha", "description": "Hlavní závod"})
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Závod Praha"
    assert data["id"] is not None

def test_list_factories(client):
    client.post("/api/factories", json={"name": "Závod A"})
    client.post("/api/factories", json={"name": "Závod B"})
    r = client.get("/api/factories")
    assert r.status_code == 200
    assert len(r.json()) == 2

def test_get_factory(client):
    r = client.post("/api/factories", json={"name": "Test"})
    fid = r.json()["id"]
    r = client.get(f"/api/factories/{fid}")
    assert r.status_code == 200
    assert r.json()["name"] == "Test"

def test_update_factory(client):
    r = client.post("/api/factories", json={"name": "Old"})
    fid = r.json()["id"]
    r = client.put(f"/api/factories/{fid}", json={"name": "New"})
    assert r.status_code == 200
    assert r.json()["name"] == "New"

def test_delete_factory(client):
    r = client.post("/api/factories", json={"name": "ToDelete"})
    fid = r.json()["id"]
    r = client.delete(f"/api/factories/{fid}")
    assert r.status_code == 200
    r = client.get(f"/api/factories/{fid}")
    assert r.status_code == 404

def test_tree(client):
    f = client.post("/api/factories", json={"name": "F"}).json()
    s = client.post("/api/sections", json={"name": "S", "factory_id": f["id"]}).json()
    e = client.post("/api/equipment", json={"name": "E", "section_id": s["id"]}).json()
    client.post("/api/components", json={"name": "C", "equipment_id": e["id"]})
    r = client.get("/api/tree")
    assert r.status_code == 200
    tree = r.json()
    assert len(tree) == 1
    assert len(tree[0]["sections"]) == 1
    assert len(tree[0]["sections"][0]["equipment_list"]) == 1
    assert len(tree[0]["sections"][0]["equipment_list"][0]["components"]) == 1
