import os
import tempfile
from pathlib import Path

os.environ["MARKETPLACE_DB_PATH"] = str(
    Path(tempfile.mkdtemp(prefix="neu-marketplace-test-")) / "test.db"
)

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
