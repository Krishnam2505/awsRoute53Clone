from fastapi.testclient import TestClient


def test_login_me_logout_cycle(anon: TestClient) -> None:
    assert anon.get("/api/v1/auth/me").status_code == 401

    response = anon.post(
        "/api/v1/auth/login",
        json={
            "login_type": "iam",
            "account_id": "1234-5678-9012",
            "username": "demo",
            "password": "demo1234",
        },
    )
    assert response.status_code == 200
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie and "max-age=604800" in cookie

    me = anon.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json() == {"id": 1, "username": "demo", "account_id": "123456789012"}

    assert anon.post("/api/v1/auth/logout").status_code == 204
    assert anon.get("/api/v1/auth/me").status_code == 401


def test_wrong_password_and_wrong_account_are_rejected(anon: TestClient) -> None:
    bad_password = anon.post(
        "/api/v1/auth/login", json={"login_type": "root", "username": "demo", "password": "x"}
    )
    assert bad_password.status_code == 401
    assert bad_password.json()["error"]["code"] == "InvalidCredentials"

    wrong_account = anon.post(
        "/api/v1/auth/login",
        json={
            "login_type": "iam",
            "account_id": "999999999999",
            "username": "demo",
            "password": "demo1234",
        },
    )
    assert wrong_account.status_code == 401


def test_protected_routes_need_a_session(anon: TestClient) -> None:
    response = anon.get("/api/v1/hostedzones")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NotAuthenticated"
