import config
from tests.test_items import JPEG, PNG, WEBP, upload_image


def test_upload_requires_authentication(client):
    response = upload_image(client)
    assert response.status_code == 401


def test_upload_png(client, registered_user):
    login_response = client.post(
        "/api/auth/login", json={"email": "student@example.com", "password": "Secret123"}
    )
    assert login_response.status_code == 200
    response = upload_image(client)
    assert response.status_code == 200
    url = response.json()["image_url"]
    assert url.startswith("/uploads/")
    assert url.endswith(".png")
    filename = url.removeprefix("/uploads/")
    assert (config.UPLOADS_DIR / filename).is_file()
    served = client.get(url)
    assert served.status_code == 200
    assert served.content.startswith(b"\x89PNG")


def test_upload_jpeg_and_webp(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    jpeg = upload_image(client, content=JPEG, content_type="image/jpeg", name="photo.jpg")
    assert jpeg.status_code == 200
    assert jpeg.json()["image_url"].endswith(".jpg")
    webp = upload_image(client, content=WEBP, content_type="image/webp", name="photo.webp")
    assert webp.status_code == 200
    assert webp.json()["image_url"].endswith(".webp")


def test_upload_rejects_disallowed_type(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    response = upload_image(client, content=b"hello", content_type="text/plain", name="notes.txt")
    assert response.status_code == 400


def test_upload_rejects_content_type_mismatch(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    response = upload_image(client, content=b"not a png at all", content_type="image/png", name="fake.png")
    assert response.status_code == 400


def test_upload_rejects_oversized_file(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    big_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * (5 * 1024 * 1024)
    response = upload_image(client, content=big_png, content_type="image/png", name="big.png")
    assert response.status_code == 400


def test_upload_rejects_empty_file(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    response = upload_image(client, content=b"", content_type="image/png", name="empty.png")
    assert response.status_code == 400


def test_upload_rejects_png_header_with_garbage(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    fake = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    response = upload_image(client, content=fake, content_type="image/png", name="fake.png")
    assert response.status_code == 400


def test_upload_rejects_truncated_image(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    response = upload_image(client, content=PNG[: len(PNG) // 2], content_type="image/png", name="cut.png")
    assert response.status_code == 400


def test_upload_rejects_valid_image_with_mismatched_declared_type(client, registered_user):
    client.post("/api/auth/login", json={"email": "student@example.com", "password": "Secret123"})
    response = upload_image(client, content=JPEG, content_type="image/png", name="photo.png")
    assert response.status_code == 400
    assert response.json()["detail"] == "The file content does not match its image type."
