import os
import tempfile
from pathlib import Path

_TEST_DIR = Path(tempfile.mkdtemp(prefix="neu-marketplace-test-"))
os.environ["MARKETPLACE_DB_PATH"] = str(_TEST_DIR / "test.db")
os.environ["MARKETPLACE_UPLOADS_DIR"] = str(_TEST_DIR / "uploads")
(_TEST_DIR / "uploads").mkdir()

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

import main
from database import engine


@pytest.fixture()
def client():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture()
def registered_user(client):
    payload = {
        "display_name": "Test Student",
        "email": "student@example.com",
        "password": "Secret123",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    return response.json()


@pytest.fixture()
def second_user(client):
    payload = {
        "display_name": "Second Student",
        "email": "second@example.com",
        "password": "Secret123",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    client.post("/api/auth/logout")
    return response.json()
