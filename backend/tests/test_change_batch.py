from fastapi.testclient import TestClient


def test_batch_is_all_or_nothing(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    batch = {
        "comment": "two good, one bad",
        "changes": [
            {
                "action": "CREATE",
                "record_set": {"name": "a", "type": "A", "ttl": 300, "values": ["192.0.2.1"]},
            },
            {
                "action": "CREATE",
                "record_set": {"name": "b", "type": "A", "ttl": 300, "values": ["192.0.2.2"]},
            },
            {
                "action": "CREATE",
                "record_set": {"name": "c", "type": "A", "ttl": 300, "values": ["not-an-ip"]},
            },
        ],
    }
    response = client.post(f"/api/v1/hostedzones/{zid}/changes", json=batch)
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "InvalidChangeBatch"
    assert error["field_errors"][0]["field"] == "changes[2].record_set.values[0]"
    assert client.get(f"/api/v1/hostedzones/{zid}").json()["record_count"] == 2

    batch["changes"].pop()
    ok = client.post(f"/api/v1/hostedzones/{zid}/changes", json=batch)
    assert ok.status_code == 200
    assert ok.json()["status"] == "INSYNC"
    assert client.get(f"/api/v1/changes/{ok.json()['id']}").json()["comment"] == batch["comment"]
    assert client.get(f"/api/v1/hostedzones/{zid}").json()["record_count"] == 4


def test_upsert_and_bulk_delete(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    upsert = {
        "action": "UPSERT",
        "record_set": {"name": "u", "type": "A", "ttl": 300, "values": ["192.0.2.1"]},
    }
    client.post(f"/api/v1/hostedzones/{zid}/changes", json={"changes": [upsert]})
    upsert["record_set"]["values"] = ["192.0.2.9"]
    client.post(f"/api/v1/hostedzones/{zid}/changes", json={"changes": [upsert]})
    items = client.get(f"/api/v1/hostedzones/{zid}/records", params={"type": "A"}).json()["items"]
    assert len(items) == 1 and items[0]["values"] == ["192.0.2.9"]

    delete = {"changes": [{"action": "DELETE", "record": {"id": items[0]["id"]}}]}
    assert client.post(f"/api/v1/hostedzones/{zid}/changes", json=delete).status_code == 200
    assert client.get(f"/api/v1/hostedzones/{zid}").json()["record_count"] == 2


def test_validation_errors_use_the_shared_format(client: TestClient, zone: dict) -> None:
    response = client.post(f"/api/v1/hostedzones/{zone['id']}/changes", json={"changes": []})
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "InvalidInput"
    assert error["field_errors"][0]["field"] == "changes"
