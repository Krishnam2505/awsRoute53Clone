from fastapi.testclient import TestClient

from tests.conftest import create_record


def test_create_zone_adds_default_ns_and_soa(client: TestClient, zone: dict) -> None:
    assert zone["id"].startswith("Z") and len(zone["id"]) == 21
    assert zone["name"] == "example.com."
    assert zone["record_count"] == 2
    servers = zone["name_servers"]
    assert len(servers) == 4
    assert sorted(s.split(".", 2)[2] for s in servers) == ["co.uk.", "com.", "net.", "org."]

    records = client.get(f"/api/v1/hostedzones/{zone['id']}/records").json()["items"]
    by_type = {r["type"]: r for r in records}
    assert by_type["NS"]["ttl"] == 172800 and by_type["NS"]["is_default"]
    soa = by_type["SOA"]
    assert soa["ttl"] == 900
    assert soa["values"][0].endswith("hostmaster.example.com. 1 7200 900 1209600 86400")


def test_zone_name_rules(client: TestClient) -> None:
    for bad in ("com", "exa mple.com", "-bad.com", "a" * 64 + ".com"):
        response = client.post("/api/v1/hostedzones", json={"name": bad})
        assert response.status_code == 400, bad
        body = response.json()["error"]
        assert body["code"] == "InvalidInput"
        assert body["field_errors"][0]["field"] == "name"

    long_description = client.post(
        "/api/v1/hostedzones", json={"name": "ok.com", "description": "x" * 257}
    )
    assert long_description.json()["error"]["field_errors"][0]["field"] == "description"


def test_private_zone_needs_a_vpc(client: TestClient) -> None:
    response = client.post("/api/v1/hostedzones", json={"name": "corp.internal", "type": "private"})
    assert response.status_code == 400
    assert response.json()["error"]["field_errors"][0]["field"] == "vpcs"

    ok = client.post(
        "/api/v1/hostedzones",
        json={
            "name": "corp.internal",
            "type": "private",
            "vpcs": [{"region": "us-east-1", "vpc_id": "vpc-0a1b2c3d4e5f67890"}],
        },
    )
    assert ok.status_code == 201
    assert ok.json()["hosted_zone"]["type"] == "private"


def test_same_zone_name_twice_is_allowed(client: TestClient, zone: dict) -> None:
    again = client.post("/api/v1/hostedzones", json={"name": "example.com"})
    assert again.status_code == 201
    assert again.json()["hosted_zone"]["id"] != zone["id"]


def test_list_search_filter_and_paginate(client: TestClient) -> None:
    for name in ("alpha.com", "beta.com", "gamma.org"):
        client.post("/api/v1/hostedzones", json={"name": name, "description": f"{name} site"})
    page = client.get("/api/v1/hostedzones", params={"page_size": 2, "page": 2}).json()
    assert page["total"] == 3 and page["page"] == 2 and len(page["items"]) == 1

    found = client.get("/api/v1/hostedzones", params={"search": "BETA"}).json()
    assert [z["name"] for z in found["items"]] == ["beta.com."]
    assert client.get("/api/v1/hostedzones", params={"type": "private"}).json()["total"] == 0


def test_edit_changes_description_and_tags_only(client: TestClient, zone: dict) -> None:
    response = client.patch(
        f"/api/v1/hostedzones/{zone['id']}",
        json={"description": "Marketing", "tags": [{"key": "env", "value": "prod"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["hosted_zone"]["description"] == "Marketing"
    assert body["hosted_zone"]["tags"] == [{"key": "env", "value": "prod"}]
    assert body["hosted_zone"]["name"] == "example.com."
    assert body["change"]["status"] == "INSYNC"


def test_delete_refused_while_records_exist(client: TestClient, zone: dict) -> None:
    zone_id = zone["id"]
    created = create_record(client, zone_id, name="www", type="A", values=["192.0.2.1"])
    response = client.delete(f"/api/v1/hostedzones/{zone_id}")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "HostedZoneNotEmpty"

    record_id = created.json()["record_set"]["id"]
    client.delete(f"/api/v1/hostedzones/{zone_id}/records/{record_id}")
    assert client.delete(f"/api/v1/hostedzones/{zone_id}").status_code == 204
    assert client.get(f"/api/v1/hostedzones/{zone_id}").status_code == 404


def test_other_users_zone_is_not_found(
    client: TestClient, other_client: TestClient, zone: dict
) -> None:
    response = other_client.get(f"/api/v1/hostedzones/{zone['id']}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NoSuchHostedZone"
    assert other_client.get("/api/v1/hostedzones").json()["total"] == 0
