import pytest

from tests.test_items import create_item, login, uploaded_url


@pytest.fixture()
def item(client, registered_user):
    login(client)
    return create_item(client, uploaded_url(client)).json()


def set_status(client, item_id, status):
    return client.patch(f"/api/items/{item_id}/status", json={"status": status})


def test_status_requires_authentication(client, item):
    client.post("/api/auth/logout")
    assert set_status(client, item["id"], "reserved").status_code == 401


def test_status_rejects_non_owner(client, item, second_user):
    login(client, email=second_user["email"])
    assert set_status(client, item["id"], "reserved").status_code == 403
    assert client.get(f"/api/items/{item['id']}").json()["status"] == "available"


def test_status_unknown_item_returns_404(client, registered_user):
    login(client)
    assert set_status(client, 99999, "reserved").status_code == 404


def test_available_to_reserved_to_sold(client, item):
    assert set_status(client, item["id"], "reserved").json()["status"] == "reserved"
    assert set_status(client, item["id"], "sold").json()["status"] == "sold"
    assert client.get(f"/api/items/{item['id']}").json()["status"] == "sold"
    assert client.get("/api/me/items").json()[0]["status"] == "sold"


def test_reserved_returns_to_available(client, item):
    set_status(client, item["id"], "reserved")
    assert set_status(client, item["id"], "available").json()["status"] == "available"


def test_available_can_be_sold_directly(client, item):
    assert set_status(client, item["id"], "sold").json()["status"] == "sold"


def test_sold_cannot_be_reopened(client, item):
    set_status(client, item["id"], "sold")
    assert set_status(client, item["id"], "available").status_code == 400
    assert set_status(client, item["id"], "reserved").status_code == 400


def test_unchanged_status_is_rejected(client, item):
    assert set_status(client, item["id"], "available").status_code == 400


def test_invalid_status_value_is_rejected(client, item):
    assert set_status(client, item["id"], "deleted").status_code == 422
    assert client.patch(f"/api/items/{item['id']}/status", json={}).status_code == 422
