REGISTER = {
    "display_name": "Test Student",
    "email": "student@example.com",
    "password": "Secret123",
}


def register(client, **overrides):
    return client.post("/api/auth/register", json={**REGISTER, **overrides})


def test_register_returns_safe_user(client):
    response = register(client)
    assert response.status_code == 201
    body = response.json()
    assert body["display_name"] == "Test Student"
    assert body["email"] == "student@example.com"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_email_rejected(client):
    assert register(client).status_code == 201
    response = register(client)
    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists."


def test_register_invalid_email_rejected(client):
    response = register(client, email="not-an-email")
    assert response.status_code == 422


def test_register_short_password_rejected(client):
    response = register(client, password="short")
    assert response.status_code == 400
    assert response.json()["detail"] == "Use at least 8 characters."


def test_register_long_password_rejected(client):
    response = register(client, password="x" * 73)
    assert response.status_code == 400
    assert response.json()["detail"] == "Use at most 72 bytes for your password."


def test_register_multibyte_password_over_72_bytes_rejected(client):
    response = register(client, password="á" * 37)  # 74 UTF-8 bytes
    assert response.status_code == 400


def test_register_whitespace_only_name_rejected(client):
    assert register(client, display_name="   ").status_code == 422
    assert register(client, display_name=" A ").status_code == 422


def test_register_rejects_email_with_spaces(client):
    response = register(client, email="bad address@example.com")
    assert response.status_code == 422


def test_login_with_oversized_password_returns_401(client):
    register(client)
    response = client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": "x" * 73}
    )
    assert response.status_code == 401


def test_register_missing_fields_rejected(client):
    response = client.post("/api/auth/register", json={"email": "a@b.com"})
    assert response.status_code == 422


def test_register_normalizes_email(client):
    response = register(client, email="  Student@Example.COM ")
    assert response.status_code == 201
    assert response.json()["email"] == "student@example.com"


def test_login_and_me_with_valid_credentials(client):
    register(client)
    response = client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": "Secret123"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "student@example.com"
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["id"] == response.json()["id"]


def test_login_wrong_password_rejected(client):
    register(client)
    response = client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": "WrongPass1"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_login_unknown_email_rejected(client):
    response = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "Secret123"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password."


def test_me_without_session_returns_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_logout_invalidates_session(client):
    register(client)
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_password_is_hashed_in_database(client, registered_user):
    from sqlmodel import Session, select

    from database import engine
    from models import User

    with Session(engine) as db:
        user = db.exec(select(User).where(User.email == "student@example.com")).first()
        assert user.password_hash != "Secret123"
        assert "Secret123" not in user.password_hash
