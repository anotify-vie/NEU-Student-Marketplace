import io

import config
import pytest
from PIL import Image


def _image(fmt: str) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (30, 120, 200)).save(buffer, fmt)
    return buffer.getvalue()


PNG = _image("PNG")
JPEG = _image("JPEG")
WEBP = _image("WEBP")


def login(client, email="student@example.com", password="Secret123"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def upload_image(client, content=PNG, content_type="image/png", name="photo.png"):
    return client.post(
        "/api/uploads",
        files={"file": (name, content, content_type)},
    )


def uploaded_url(client, content=PNG, content_type="image/png"):
    response = upload_image(client, content=content, content_type=content_type)
    assert response.status_code == 200, response.text
    return response.json()["image_url"]


def create_item(client, url, **overrides):
    payload = {
        "title": "Microeconomics Textbook",
        "category": "textbooks",
        "price": 45000,
        "condition": "good",
        "description": "Clean and well-kept textbook with helpful notes.",
        "location": "NEU - Zone A",
        "image_urls": [url],
    }
    payload.update(overrides)
    return client.post("/api/items", json=payload)


def test_create_item_requires_authentication(client):
    response = create_item(client, "/uploads/missing.jpg")
    assert response.status_code == 401


def test_create_item_valid(client, registered_user):
    login(client)
    url = uploaded_url(client)
    response = create_item(client, url)
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Microeconomics Textbook"
    assert body["seller_id"] == registered_user["id"]
    assert body["status"] == "available"
    assert body["price"] == 45000
    assert body["quantity"] == 1
    assert body["image_urls"] == [url]
    assert "password_hash" not in body


def test_create_item_invalid_category_rejected(client, registered_user):
    login(client)
    url = uploaded_url(client)
    response = create_item(client, url, category="electronics")
    assert response.status_code == 422


def test_create_item_negative_price_rejected(client, registered_user):
    login(client)
    url = uploaded_url(client)
    response = create_item(client, url, price=-1)
    assert response.status_code == 422


def test_create_item_missing_fields_rejected(client, registered_user):
    login(client)
    response = client.post("/api/items", json={"title": "Only a title"})
    assert response.status_code == 422


def test_create_item_allows_no_images(client, registered_user):
    login(client)
    response = create_item(client, "/uploads/x.jpg", image_urls=[])
    assert response.status_code == 201
    assert response.json()["image_urls"] == []


@pytest.mark.parametrize("quantity", [0, -1, True, "2"])
def test_create_item_rejects_invalid_quantity(client, registered_user, quantity):
    login(client)
    response = create_item(client, "/uploads/x.jpg", quantity=quantity, image_urls=[])
    assert response.status_code == 422


def test_update_item_preserves_images_when_updating_quantity(client, registered_user):
    login(client)
    url = uploaded_url(client)
    created = create_item(client, url).json()
    response = client.patch(f"/api/items/{created['id']}", json={"quantity": 3})
    assert response.status_code == 200
    assert response.json()["quantity"] == 3
    assert response.json()["price"] == created["price"]
    assert response.json()["image_urls"] == [url]


def test_update_item_can_remove_all_images(client, registered_user):
    login(client)
    url = uploaded_url(client)
    created = create_item(client, url).json()
    response = client.patch(f"/api/items/{created['id']}", json={"image_urls": []})
    assert response.status_code == 200
    assert response.json()["image_urls"] == []


def test_create_item_rejects_more_than_five_images(client, registered_user):
    login(client)
    urls = [uploaded_url(client) for _ in range(6)]
    response = create_item(client, urls[0], image_urls=urls)
    assert response.status_code == 422


def test_create_item_rejects_unknown_image_file(client, registered_user):
    login(client)
    response = create_item(client, "/uploads/does-not-exist.jpg")
    assert response.status_code == 400


def test_create_item_rejects_foreign_urls(client, registered_user):
    login(client)
    response = create_item(client, "https://evil.example.com/x.jpg")
    assert response.status_code == 400


def test_get_item_and_missing_item(client, registered_user):
    login(client)
    url = uploaded_url(client)
    created = create_item(client, url).json()
    response = client.get(f"/api/items/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]
    missing = client.get("/api/items/99999")
    assert missing.status_code == 404


def test_list_items_pagination_and_sort(client, registered_user):
    login(client)
    for price in (30000, 20000, 10000):
        create_item(client, uploaded_url(client), title=f"Item {price}", price=price)
    response = client.get("/api/items", params={"sort": "price_asc", "page_size": 2})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert [item["price"] for item in body["items"]] == [10000, 20000]
    second = client.get("/api/items", params={"sort": "price_asc", "page_size": 2, "page": 2}).json()
    assert [item["price"] for item in second["items"]] == [30000]


def test_list_items_search(client, registered_user):
    login(client)
    create_item(client, uploaded_url(client), title="Karate Uniform")
    create_item(client, uploaded_url(client), title="Desk Lamp", category="other")
    response = client.get("/api/items", params={"q": "karate"})
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "Karate Uniform"


def test_list_items_empty_result(client, registered_user):
    response = client.get("/api/items", params={"q": "nothing-matches-this"})
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "page": 1, "page_size": 12}


def test_update_item_owner_only(client, registered_user, second_user):
    login(client)
    created = create_item(client, uploaded_url(client)).json()
    login(client, email=second_user["email"])
    response = client.patch(f"/api/items/{created['id']}", json={"title": "Hacked"})
    assert response.status_code == 403
    login(client)
    response = client.patch(f"/api/items/{created['id']}", json={"title": "Updated Title"})
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Title"


def test_update_item_requires_authentication(client, registered_user):
    login(client)
    created = create_item(client, uploaded_url(client)).json()
    client.post("/api/auth/logout")
    response = client.patch(f"/api/items/{created['id']}", json={"title": "Nope"})
    assert response.status_code == 401


def test_delete_item_owner_only(client, registered_user, second_user):
    login(client)
    created = create_item(client, uploaded_url(client)).json()
    login(client, email=second_user["email"])
    assert client.delete(f"/api/items/{created['id']}").status_code == 403
    login(client)
    assert client.delete(f"/api/items/{created['id']}").status_code == 200
    assert client.get(f"/api/items/{created['id']}").status_code == 404


def test_delete_missing_item_returns_404(client, registered_user):
    login(client)
    assert client.delete("/api/items/99999").status_code == 404


def test_my_items_returns_only_own_listings(client, registered_user, second_user):
    login(client)
    mine = create_item(client, uploaded_url(client), title="My Listing").json()
    login(client, email=second_user["email"])
    create_item(client, uploaded_url(client), title="Other Listing")
    login(client)
    response = client.get("/api/me/items")
    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert "My Listing" in titles
    assert "Other Listing" not in titles
    assert mine["seller_id"] == registered_user["id"]


def test_create_item_rejects_another_users_upload(client, registered_user, second_user):
    login(client)
    victim_url = uploaded_url(client)
    login(client, email=second_user["email"])
    response = create_item(client, victim_url)
    assert response.status_code == 403
    assert client.get(victim_url).status_code == 200


def test_delete_item_keeps_image_used_by_another_listing(client, registered_user):
    login(client)
    url = uploaded_url(client)
    first = create_item(client, url, title="First Listing").json()
    create_item(client, url, title="Second Listing")
    assert client.delete(f"/api/items/{first['id']}").status_code == 200
    assert client.get(url).status_code == 200
    assert client.get("/api/items", params={"q": "Second Listing"}).json()["total"] == 1


def test_delete_item_removes_its_own_unused_upload(client, registered_user):
    login(client)
    url = uploaded_url(client)
    created = create_item(client, url).json()
    assert client.delete(f"/api/items/{created['id']}").status_code == 200
    assert client.get(url).status_code == 404


def test_delete_item_never_removes_untracked_seed_image(client, registered_user):
    login(client)
    seed = config.UPLOADS_DIR / "seed-sample.png"
    seed.write_bytes(PNG)
    created = create_item(client, "/uploads/seed-sample.png").json()
    assert client.delete(f"/api/items/{created['id']}").status_code == 200
    assert seed.is_file()


def test_update_item_rejects_null_fields(client, registered_user):
    login(client)
    url = uploaded_url(client)
    created = create_item(client, url).json()
    for field in ("title", "price", "image_urls"):
        response = client.patch(f"/api/items/{created['id']}", json={field: None})
        assert response.status_code == 422, field
    stored = client.get(f"/api/items/{created['id']}").json()
    assert stored["title"] == "Microeconomics Textbook"
    assert stored["image_urls"] == [url]
    assert client.get(url).status_code == 200


def test_create_item_rejects_non_integer_price(client, registered_user):
    login(client)
    url = uploaded_url(client)
    assert create_item(client, url, price=True).status_code == 422
    assert create_item(client, url, price="99").status_code == 422


def test_update_item_rejects_boolean_price(client, registered_user):
    login(client)
    created = create_item(client, uploaded_url(client)).json()
    response = client.patch(f"/api/items/{created['id']}", json={"price": True})
    assert response.status_code == 422
    assert client.get(f"/api/items/{created['id']}").json()["price"] == 45000


def test_update_item_releases_replaced_image(client, registered_user):
    login(client)
    old_url = uploaded_url(client)
    new_url = uploaded_url(client)
    created = create_item(client, old_url).json()
    response = client.patch(f"/api/items/{created['id']}", json={"image_urls": [new_url]})
    assert response.status_code == 200
    assert client.get(old_url).status_code == 404
    assert client.get(new_url).status_code == 200
