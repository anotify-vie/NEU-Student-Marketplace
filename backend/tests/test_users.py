def login(client, email="student@example.com", password="Secret123"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_public_profile_hides_email(client, registered_user):
    response = client.get(f"/api/users/{registered_user['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Test Student"
    assert "email" not in body
    assert "password_hash" not in body


def test_public_profile_missing_user_returns_404(client):
    response = client.get("/api/users/99999")
    assert response.status_code == 404


def test_public_profile_stats_track_listing_lifecycle(client, registered_user, second_user):
    from test_items import create_item, uploaded_url

    login(client)
    url = uploaded_url(client)
    items = [create_item(client, url).json() for _ in range(3)]
    client.patch(f"/api/items/{items[1]['id']}/status", json={"status": "reserved"})
    client.patch(f"/api/items/{items[2]['id']}/status", json={"status": "sold"})
    client.post("/api/auth/logout")
    route = f"/api/users/{registered_user['id']}/stats"
    response = client.get(route)
    assert response.status_code == 200
    assert response.json() == {"total": 3, "available": 1, "reserved": 1, "sold": 1}
    assert client.get(f"/api/users/{second_user['id']}/stats").json() == {
        "total": 0, "available": 0, "reserved": 0, "sold": 0,
    }
    login(client)
    client.delete(f"/api/items/{items[2]['id']}")
    assert client.get(route).json() == {"total": 2, "available": 1, "reserved": 1, "sold": 0}


def test_public_profile_stats_missing_user_returns_404(client):
    assert client.get("/api/users/99999/stats").status_code == 404


def test_update_profile_requires_authentication(client):
    response = client.patch("/api/users/me", json={"display_name": "New Name"})
    assert response.status_code == 401


def test_update_own_profile(client, registered_user):
    login(client)
    response = client.patch(
        "/api/users/me",
        json={
            "display_name": "Updated Name",
            "faculty": "Faculty of Economics",
            "cohort": "k64",
            "bio": "Hello from NEU.",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Updated Name"
    assert body["faculty"] == "Faculty of Economics"
    assert body["cohort"] == "K64"
    assert body["bio"] == "Hello from NEU."


def test_update_profile_invalid_cohort_rejected(client, registered_user):
    login(client)
    response = client.patch("/api/users/me", json={"cohort": "Year 3"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Use a cohort such as K64."


def test_update_profile_invalid_name_rejected(client, registered_user):
    login(client)
    response = client.patch("/api/users/me", json={"display_name": "A"})
    assert response.status_code == 400


def test_update_profile_whitespace_name_rejected(client, registered_user):
    login(client)
    response = client.patch("/api/users/me", json={"display_name": "   "})
    assert response.status_code == 400


def test_update_profile_bio_too_long_rejected(client, registered_user):
    login(client)
    response = client.patch("/api/users/me", json={"bio": "x" * 301})
    assert response.status_code == 400


def test_cannot_update_other_user(client, registered_user):
    login(client)
    response = client.patch("/api/users/2/me", json={"display_name": "Hacked"})
    assert response.status_code == 404
