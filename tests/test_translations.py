import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_upsert_and_get_translation():
    # Create
    r = client.put("/api/translations", json={
        "entity_type": "factory", "entity_id": 999, "field_name": "name",
        "lang": "de", "value": "Testfabrik"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["value"] == "Testfabrik"
    tid = data["id"]

    # Update (upsert same key)
    r = client.put("/api/translations", json={
        "entity_type": "factory", "entity_id": 999, "field_name": "name",
        "lang": "de", "value": "Testfabrik Aktualisiert"
    })
    assert r.status_code == 200
    assert r.json()["id"] == tid
    assert r.json()["value"] == "Testfabrik Aktualisiert"

    # Get
    r = client.get("/api/translations", params={
        "entity_type": "factory", "entity_id": 999, "lang": "de"
    })
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert items[0]["value"] == "Testfabrik Aktualisiert"

    # Cleanup
    from app.database import SessionLocal
    from app.models import Translation
    db = SessionLocal()
    db.query(Translation).filter(Translation.entity_id == 999).delete()
    db.commit()
    db.close()


def test_batch_translations():
    # Create two translations
    for eid in [997, 998]:
        client.put("/api/translations", json={
            "entity_type": "factory", "entity_id": eid, "field_name": "name",
            "lang": "de", "value": f"Fabrik {eid}"
        })

    r = client.get("/api/translations/batch", params={
        "entity_type": "factory", "lang": "de"
    })
    assert r.status_code == 200
    items = r.json()
    ids = {i["entity_id"] for i in items}
    assert 997 in ids
    assert 998 in ids

    # Cleanup
    from app.database import SessionLocal
    from app.models import Translation
    db = SessionLocal()
    db.query(Translation).filter(Translation.entity_id.in_([997, 998])).delete()
    db.commit()
    db.close()
