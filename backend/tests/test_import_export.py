from fastapi.testclient import TestClient

ZONE_FILE = """$ORIGIN example.com.
$TTL 3600
@       IN SOA ns1.example.com. admin.example.com. ( 2024010101 7200 900 1209600 86400 )
@       IN NS  ns1.example.com.
@       IN A   192.0.2.1
www     300 IN A 192.0.2.2
        300 IN A 192.0.2.3
mail    IN MX  10 mx.example.com.
txt     IN TXT "hello" "world"
bad     IN A   999.1.1.1
"""


def test_import_preview_then_commit(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    preview = client.post(
        f"/api/v1/hostedzones/{zid}/import", params={"dry_run": True}, json={"zone_file": ZONE_FILE}
    ).json()
    assert preview["skipped"] == 2  # apex SOA and NS
    assert [e["line"] for e in preview["errors"]] == [10]
    www = next(r for r in preview["record_sets"] if r["name"] == "www.example.com.")
    assert www["values"] == ["192.0.2.2", "192.0.2.3"] and www["ttl"] == 300
    assert client.get(f"/api/v1/hostedzones/{zid}").json()["record_count"] == 2

    good = "\n".join(line for line in ZONE_FILE.splitlines() if not line.startswith("bad"))
    committed = client.post(
        f"/api/v1/hostedzones/{zid}/import", params={"dry_run": False}, json={"zone_file": good}
    ).json()
    assert committed["change"]["status"] == "INSYNC"
    assert client.get(f"/api/v1/hostedzones/{zid}").json()["record_count"] == 6


def test_export_bind_and_json(client: TestClient, zone: dict) -> None:
    zid = zone["id"]
    client.post(
        f"/api/v1/hostedzones/{zid}/records",
        json={"name": "www", "type": "A", "ttl": 300, "values": ["192.0.2.2"]},
    )
    bind = client.get(f"/api/v1/hostedzones/{zid}/export", params={"format": "bind"})
    assert bind.status_code == 200
    assert "$ORIGIN example.com." in bind.text
    assert "www.example.com.\t300\tIN\tA\t192.0.2.2" in bind.text
    assert 'filename="example.com.zone"' in bind.headers["content-disposition"]

    data = client.get(f"/api/v1/hostedzones/{zid}/export", params={"format": "json"}).json()
    types = {r["Type"] for r in data["ResourceRecordSets"]}
    assert {"NS", "SOA", "A"} <= types
