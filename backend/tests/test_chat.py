import time
from datetime import datetime

import pytest

from schemas.chat import MessageResponse
from tests.test_items import create_item, login, uploaded_url


@pytest.fixture()
def item(client, registered_user, second_user):
    login(client)
    return create_item(client, uploaded_url(client)).json()


def as_buyer(client):
    login(client, email="second@example.com")


def open_conversation(client, item_id):
    return client.post("/api/conversations", json={"item_id": item_id})


def send(client, conversation_id, text):
    return client.post(f"/api/conversations/{conversation_id}/messages", json={"text": text})


def messages(client, conversation_id, **params):
    response = client.get(f"/api/conversations/{conversation_id}/messages", params=params)
    assert response.status_code == 200
    return response.json()


@pytest.fixture()
def conversation(client, item):
    as_buyer(client)
    return open_conversation(client, item["id"]).json()


def test_chat_endpoints_require_authentication(client):
    assert client.get("/api/conversations").status_code == 401
    assert client.post("/api/conversations", json={"item_id": 1}).status_code == 401
    assert client.get("/api/conversations/1/messages").status_code == 401
    assert client.post("/api/conversations/1/messages", json={"text": "Hi"}).status_code == 401


def test_buyer_starts_conversation(client, item, second_user):
    as_buyer(client)
    response = open_conversation(client, item["id"])
    assert response.status_code == 201
    body = response.json()
    assert body["item_id"] == item["id"]
    assert body["buyer_id"] == second_user["id"]
    assert body["seller_id"] == item["seller_id"]


def test_existing_conversation_is_reused(client, item, conversation):
    again = open_conversation(client, item["id"])
    assert again.status_code == 200
    assert again.json()["id"] == conversation["id"]
    assert len(client.get("/api/conversations").json()) == 1


def test_cannot_chat_about_own_listing(client, item):
    assert open_conversation(client, item["id"]).status_code == 400


def test_cannot_chat_about_unknown_listing(client, item):
    as_buyer(client)
    assert open_conversation(client, 99999).status_code == 404


def test_sold_listing_rejects_new_conversations_but_keeps_existing(client, item, conversation):
    send(client, conversation["id"], "Is it still available?")
    login(client)
    client.patch(f"/api/items/{item['id']}/status", json={"status": "sold"})
    as_buyer(client)
    assert open_conversation(client, item["id"]).json()["id"] == conversation["id"]
    assert len(messages(client, conversation["id"])) == 1


def test_new_conversation_on_sold_listing_is_rejected(client, item):
    login(client)
    client.patch(f"/api/items/{item['id']}/status", json={"status": "sold"})
    as_buyer(client)
    assert open_conversation(client, item["id"]).status_code == 400


def test_participants_exchange_messages_in_order(client, item, conversation, registered_user, second_user):
    first = send(client, conversation["id"], "  Is it still available?  ")
    assert first.status_code == 201
    assert first.json()["text"] == "Is it still available?"
    assert first.json()["sender_id"] == second_user["id"]
    login(client)
    send(client, conversation["id"], "Yes, it is.")
    thread = messages(client, conversation["id"])
    assert [m["text"] for m in thread] == ["Is it still available?", "Yes, it is."]
    assert thread[1]["sender_id"] == registered_user["id"]
    assert thread[0]["id"] < thread[1]["id"]


@pytest.mark.parametrize("text", ["", "   ", "x" * 1001])
def test_invalid_messages_are_rejected(client, conversation, text):
    assert send(client, conversation["id"], text).status_code == 422
    assert messages(client, conversation["id"]) == []


def test_message_of_maximum_length_is_accepted(client, conversation):
    assert send(client, conversation["id"], "x" * 1000).status_code == 201
    padded = send(client, conversation["id"], "  " + "y" * 1000 + "  ")
    assert padded.status_code == 201
    assert padded.json()["text"] == "y" * 1000


def test_after_id_returns_only_new_messages(client, conversation):
    first = send(client, conversation["id"], "one").json()
    send(client, conversation["id"], "two")
    send(client, conversation["id"], "three")
    assert [m["text"] for m in messages(client, conversation["id"], after_id=first["id"])] == ["two", "three"]
    assert messages(client, conversation["id"], after_id=10_000) == []


def test_default_fetch_returns_latest_fifty_in_order(client, conversation):
    for number in range(52):
        send(client, conversation["id"], f"m{number}")
    thread = messages(client, conversation["id"])
    assert len(thread) == 50
    assert thread[0]["text"] == "m2"
    assert thread[-1]["text"] == "m51"


def test_negative_after_id_is_rejected(client, conversation):
    response = client.get(f"/api/conversations/{conversation['id']}/messages", params={"after_id": -1})
    assert response.status_code == 422


def test_non_participants_cannot_read_or_write(client, conversation):
    send(client, conversation["id"], "Private")
    client.post("/api/auth/logout")
    client.post(
        "/api/auth/register",
        json={"display_name": "Third Student", "email": "third@example.com", "password": "Secret123"},
    )
    assert client.get("/api/conversations").json() == []
    assert client.get(f"/api/conversations/{conversation['id']}/messages").status_code == 403
    assert send(client, conversation["id"], "Hello").status_code == 403


def test_unknown_conversation_returns_404(client, conversation):
    assert client.get("/api/conversations/99999/messages").status_code == 404
    assert send(client, 99999, "Hello").status_code == 404


def test_conversations_are_sorted_by_recent_activity(client, item, conversation):
    login(client)
    other = create_item(client, uploaded_url(client), title="Second Listing").json()
    as_buyer(client)
    second = open_conversation(client, other["id"]).json()
    assert [c["id"] for c in client.get("/api/conversations").json()] == [second["id"], conversation["id"]]
    time.sleep(0.05)  # The Windows clock only ticks about every 15 ms.
    send(client, conversation["id"], "Bump")
    assert [c["id"] for c in client.get("/api/conversations").json()] == [conversation["id"], second["id"]]
    login(client)
    assert len(client.get("/api/conversations").json()) == 2


def test_deleting_a_listing_deletes_its_conversations(client, item, conversation):
    send(client, conversation["id"], "Hello")
    login(client)
    assert client.delete(f"/api/items/{item['id']}").status_code == 200
    assert client.get("/api/conversations").json() == []
    as_buyer(client)
    assert client.get("/api/conversations").json() == []
    assert client.get(f"/api/conversations/{conversation['id']}/messages").status_code == 404


def test_conversation_list_includes_other_user_item_and_last_message(
    client, item, conversation, registered_user, second_user
):
    assert conversation["last_message"] is None
    send(client, conversation["id"], "First")
    send(client, conversation["id"], "Latest question")
    buyer_view = client.get("/api/conversations").json()[0]
    assert buyer_view["other_user"]["id"] == registered_user["id"]
    assert buyer_view["other_user"]["display_name"] == "Test Student"
    assert "email" not in buyer_view["other_user"]
    assert buyer_view["item"]["id"] == item["id"]
    assert buyer_view["item"]["title"] == item["title"]
    assert buyer_view["last_message"]["text"] == "Latest question"
    assert buyer_view["last_message"]["sender_id"] == second_user["id"]
    login(client)
    seller_view = client.get("/api/conversations").json()[0]
    assert seller_view["other_user"]["id"] == second_user["id"]
    assert seller_view["last_message"]["created_at"] == buyer_view["last_message"]["created_at"]


def test_chat_timestamps_are_always_utc():
    # Older SQLModel versions hand back naive datetimes; browsers would read them as local time.
    message = MessageResponse(
        id=1, conversation_id=1, sender_id=1, text="Hi", created_at=datetime(2026, 1, 1, 3, 0)
    )
    assert message.model_dump(mode="json")["created_at"] == "2026-01-01T03:00:00Z"


@pytest.mark.parametrize("quantity", [None, 3], ids=["default", "multiple-units"])
def test_image_free_conversation_items_include_current_quantity(client, registered_user, second_user, quantity):
    login(client)
    created = create_item(client, **({} if quantity is None else {"quantity": quantity})).json()
    as_buyer(client)
    opened = open_conversation(client, created["id"])
    assert opened.status_code == 201
    for conversation in [opened.json(), client.get("/api/conversations").json()[0]]:
        assert conversation["item"]["quantity"] == (quantity or 1)
        assert conversation["item"]["image_urls"] == []
    login(client)
    updated = client.patch(f"/api/items/{created['id']}", json={"quantity": 5})
    assert updated.status_code == 200
    assert updated.json()["price"] == created["price"]
    assert client.get("/api/conversations").json()[0]["item"]["quantity"] == 5
    as_buyer(client)
    reopened = open_conversation(client, created["id"])
    assert reopened.status_code == 200
    assert reopened.json()["id"] == opened.json()["id"]
    assert reopened.json()["item"]["quantity"] == 5
    assert client.get("/api/conversations").json()[0]["item"]["quantity"] == 5
