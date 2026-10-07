import pytest
from fastapi.testclient import TestClient

from tests.conftest import create_record

VALID = [
    ("A", ["192.0.2.1"]),
    ("AAAA", ["2001:db8::8a2e:370:7334"]),
    ("CNAME", ["hostname.example.com"]),
    ("TXT", ['"v=spf1 include:_spf.example.com ~all"']),
    ("MX", ["10 mail.example.com"]),
    ("NS", ["ns-1.example.com"]),
    ("PTR", ["hostname.example.com"]),
    ("SRV", ["10 5 80 hostname.example.com"]),
    ("CAA", ['0 issue "ca.example.net"']),
]
INVALID = [
    ("A", ["192.0.2.300"]),
    ("AAAA", ["2001:db8::zz"]),
    ("CNAME", ["a.example.com", "b.example.com"]),
    ("TXT", ['"unbalanced']),
    ("MX", ["mail.example.com"]),
    ("NS", ["not a host"]),
    ("PTR", ["bad_host!"]),
    ("SRV", ["10 5 hostname.example.com"]),
    ("CAA", ['0 badtag "ca.example.net"']),
]


@pytest.mark.parametrize(("rtype", "values"), VALID)
def test_each_type_accepts_its_format(client: TestClient, zone: dict, rtype, values) -> None:
    response = create_record(
        client, zone["id"], name=f"r-{rtype.lower()}", type=rtype, values=values
    )
    assert response.status_code == 201, response.text
    assert response.json()["change"]["id"].startswith("C")


@pytest.mark.parametrize(("rtype", "values"), INVALID)
def test_each_type_rejects_bad_values(client: TestClient, zone: dict, rtype, values) -> None:
    response = create_record(client, zone["id"], name="bad", type=rtype, values=values)
    assert response.status_code == 400, response.text
    error = response.json()["error"]
    assert error["code"] == "InvalidInput"
    assert error["field_errors"][0]["field"].startswith("values")


def test_txt_is_auto_quoted_and_names_are_normalised(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    short = create_record(client, zid, name="Txt1", type="TXT", values=["hello world"])
    assert short.json()["record_set"]["values"] == ['"hello world"']
    assert short.json()["record_set"]["name"] == "txt1.example.com."
    # 'www', 'www.example.com' and 'www.example.com.' are the same record
    first = create_record(client, zid, name="www", type="A", values=["192.0.2.1"])
    assert first.status_code == 201
    for alias in ("www.example.com", "WWW.example.com."):
        dup = create_record(client, zid, name=alias, type="A", values=["192.0.2.2"])
        assert dup.status_code == 409
        assert "already exists" in dup.json()["error"]["message"]


def test_record_outside_zone_is_rejected(client: TestClient, zone: dict) -> None:
    response = create_record(
        client, zone["id"], name="www.other.org.", type="A", values=["192.0.2.1"]
    )
    assert response.status_code == 400
    assert response.json()["error"]["field_errors"][0]["field"] == "name"


def test_cname_rules(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    apex = create_record(client, zid, name="", type="CNAME", values=["target.example.net"])
    assert apex.status_code == 400
    assert "not permitted at apex" in apex.json()["error"]["message"]

    create_record(client, zid, name="shared", type="A", values=["192.0.2.1"])
    clash = create_record(client, zid, name="shared", type="CNAME", values=["x.example.net"])
    assert clash.status_code == 400
    assert clash.json()["error"]["code"] == "InvalidChangeBatch"

    create_record(client, zid, name="alias", type="CNAME", values=["x.example.net"])
    other = create_record(client, zid, name="alias", type="TXT", values=['"hi"'])
    assert other.status_code == 400


def test_default_records_editable_not_deletable(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    records = client.get(f"/api/v1/hostedzones/{zid}/records").json()["items"]
    for record in records:
        response = client.delete(f"/api/v1/hostedzones/{zid}/records/{record['id']}")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "InvalidChangeBatch"

    ns = next(r for r in records if r["type"] == "NS")
    edited = client.put(
        f"/api/v1/hostedzones/{zid}/records/{ns['id']}",
        json={"ttl": 3600, "values": ns["values"]},
    )
    assert edited.status_code == 200
    assert edited.json()["record_set"]["ttl"] == 3600


def test_update_replaces_values(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    created = create_record(client, zid, name="api", type="A", values=["192.0.2.1"]).json()
    rid = created["record_set"]["id"]
    response = client.put(
        f"/api/v1/hostedzones/{zid}/records/{rid}",
        json={"ttl": 60, "values": ["192.0.2.5", "192.0.2.6"]},
    )
    assert response.status_code == 200
    body = response.json()["record_set"]
    assert body["values"] == ["192.0.2.5", "192.0.2.6"] and body["ttl"] == 60


def test_weighted_routing_needs_set_identifier_and_weight(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    missing = create_record(
        client, zid, name="lb", type="A", values=["192.0.2.1"], routing_policy="WEIGHTED"
    )
    fields = {e["field"] for e in missing.json()["error"]["field_errors"]}
    assert {"set_identifier", "weight"} <= fields

    for set_id, weight in (("blue", 70), ("green", 30)):
        ok = create_record(
            client,
            zid,
            name="lb",
            type="A",
            values=["192.0.2.1"],
            routing_policy="WEIGHTED",
            set_identifier=set_id,
            weight=weight,
        )
        assert ok.status_code == 201
    simple = create_record(client, zid, name="lb", type="A", values=["192.0.2.9"])
    assert simple.status_code == 400


def test_search_type_filter_and_pagination(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    for n in range(12):
        create_record(client, zid, name=f"host{n}", type="A", values=[f"10.0.0.{n}"])
    page = client.get(
        f"/api/v1/hostedzones/{zid}/records", params={"type": "A", "page_size": 5, "page": 3}
    ).json()
    assert page["total"] == 12 and len(page["items"]) == 2

    by_value = client.get(
        f"/api/v1/hostedzones/{zid}/records", params={"search": "10.0.0.11"}
    ).json()
    assert [r["name"] for r in by_value["items"]] == ["host11.example.com."]
