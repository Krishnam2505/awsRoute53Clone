import os
from collections.abc import Iterator

# Plain-HTTP test client: the Secure cookie flag would stop httpx from sending the session
os.environ["SESSION_COOKIE_SECURE"] = "false"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

import app.models  # noqa: F401
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db, make_engine
from app.main import create_app
from app.models import User

# bcrypt is slow on purpose; hash the two demo passwords once per test run
_HASHES = {"demo1234": hash_password("demo1234"), "alice1234": hash_password("alice1234")}


@pytest.fixture
def db_session(tmp_path) -> Iterator[sessionmaker[Session]]:
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with factory() as db:
        db.add_all(
            [
                User(username="demo", password_hash=_HASHES["demo1234"], account_id="123456789012"),
                User(
                    username="alice", password_hash=_HASHES["alice1234"], account_id="210987654321"
                ),
            ]
        )
        db.commit()
    yield factory
    engine.dispose()


def _client(factory: sessionmaker[Session]) -> TestClient:
    application = create_app()

    def override() -> Iterator[Session]:
        with factory() as db:
            yield db

    application.dependency_overrides[get_db] = override
    return TestClient(application)


def login(client: TestClient, username: str = "demo", password: str = "demo1234") -> None:
    account = {"demo": "123456789012", "alice": "210987654321"}[username]
    response = client.post(
        "/api/v1/auth/login",
        json={
            "login_type": "iam",
            "account_id": account,
            "username": username,
            "password": password,
        },
    )
    assert response.status_code == 200, response.text


@pytest.fixture
def anon(db_session) -> TestClient:
    return _client(db_session)


@pytest.fixture
def client(db_session) -> TestClient:
    c = _client(db_session)
    login(c)
    return c


@pytest.fixture
def other_client(db_session) -> TestClient:
    c = _client(db_session)
    login(c, "alice", "alice1234")
    return c


@pytest.fixture
def zone(client: TestClient) -> dict:
    response = client.post("/api/v1/hostedzones", json={"name": "example.com"})
    assert response.status_code == 201, response.text
    return response.json()["hosted_zone"]


def create_record(client: TestClient, zone_id: str, **body):
    body.setdefault("ttl", 300)
    return client.post(f"/api/v1/hostedzones/{zone_id}/records", json=body)
