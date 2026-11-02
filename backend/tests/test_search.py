import pytest

from tests.test_items import create_item, login, uploaded_url

ITEMS = [
    dict(title="Microeconomics Textbook", category="textbooks", price=45000, condition="good",
         description="Clean copy with helpful notes."),
    dict(title="Karate Uniform", category="uniforms", price=90000, condition="new",
         description="White uniform, size M."),
    dict(title="Desk Lamp", category="other", price=110000, condition="fair",
         description="Bright lamp for late microeconomics revision."),
    dict(title="Marketing Textbook", category="textbooks", price=45000, condition="fair",
         description="Highlighted chapters."),
]


@pytest.fixture()
def listings(client, registered_user):
    login(client)
    url = uploaded_url(client)
    return [create_item(client, url, **fields).json() for fields in ITEMS]


def titles(client, **params):
    response = client.get("/api/items", params=params)
    assert response.status_code == 200
    return [item["title"] for item in response.json()["items"]]


def test_search_matches_title_case_insensitively(client, listings):
    assert titles(client, q="KARATE") == ["Karate Uniform"]


def test_search_matches_description(client, listings):
    assert titles(client, q="revision") == ["Desk Lamp"]


def test_search_matches_title_and_description(client, listings):
    assert set(titles(client, q="microeconomics")) == {"Microeconomics Textbook", "Desk Lamp"}


def test_search_without_keyword_returns_everything(client, listings):
    assert len(titles(client)) == 4
    assert len(titles(client, q="   ")) == 4


def test_search_without_matches_returns_empty_collection(client, listings):
    body = client.get("/api/items", params={"q": "nothing-matches"}).json()
    assert body == {"items": [], "total": 0, "page": 1, "page_size": 12}


def test_wildcard_characters_in_keyword_match_literally(client, listings):
    url = listings[0]["image_urls"][0]
    create_item(client, url, title="100% Cotton Tee")
    create_item(client, url, title="Notes_Pack")
    assert titles(client, q="%") == ["100% Cotton Tee"]
    assert titles(client, q="_") == ["Notes_Pack"]
    assert titles(client, q="100%") == ["100% Cotton Tee"]


def test_filter_by_category(client, listings):
    assert set(titles(client, category="textbooks")) == {"Microeconomics Textbook", "Marketing Textbook"}


def test_filter_by_price_range_is_inclusive(client, listings):
    assert set(titles(client, min_price=45000, max_price=90000)) == {
        "Microeconomics Textbook", "Karate Uniform", "Marketing Textbook",
    }
    assert titles(client, min_price=100000) == ["Desk Lamp"]
    assert set(titles(client, max_price=45000)) == {"Microeconomics Textbook", "Marketing Textbook"}


def test_filter_by_condition(client, listings):
    assert set(titles(client, condition="fair")) == {"Desk Lamp", "Marketing Textbook"}


def test_filter_by_status(client, listings):
    client.patch(f"/api/items/{listings[1]['id']}/status", json={"status": "reserved"})
    assert titles(client, status="reserved") == ["Karate Uniform"]
    assert "Karate Uniform" not in titles(client, status="available")


def test_filters_can_be_combined(client, listings):
    assert titles(client, q="textbook", category="textbooks", condition="fair", max_price=50000) == [
        "Marketing Textbook"
    ]
    assert titles(client, category="uniforms", condition="fair") == []


def test_sort_newest_is_default(client, listings):
    expected = ["Marketing Textbook", "Desk Lamp", "Karate Uniform", "Microeconomics Textbook"]
    assert titles(client) == expected
    assert titles(client, sort="newest") == expected


def test_sort_by_price(client, listings):
    # The two 45,000 VND listings tie on price, so the newer one comes first.
    assert titles(client, sort="price_asc") == [
        "Marketing Textbook", "Microeconomics Textbook", "Karate Uniform", "Desk Lamp",
    ]
    assert titles(client, sort="price_desc") == [
        "Desk Lamp", "Karate Uniform", "Marketing Textbook", "Microeconomics Textbook",
    ]


def test_pagination_keeps_filters_and_order(client, listings):
    params = {"sort": "price_asc", "page_size": 3}
    first = client.get("/api/items", params={**params, "page": 1}).json()
    second = client.get("/api/items", params={**params, "page": 2}).json()
    assert first["total"] == second["total"] == 4
    assert [item["title"] for item in first["items"]] == [
        "Marketing Textbook", "Microeconomics Textbook", "Karate Uniform",
    ]
    assert [item["title"] for item in second["items"]] == ["Desk Lamp"]
    assert client.get("/api/items", params={**params, "page": 3}).json()["items"] == []


@pytest.mark.parametrize(
    "params",
    [
        {"page": 0},
        {"page_size": 0},
        {"page_size": 51},
        {"min_price": -1},
        {"max_price": "abc"},
        {"category": "electronics"},
        {"condition": "broken"},
        {"status": "deleted"},
        {"sort": "oldest"},
    ],
)
def test_invalid_query_parameters_are_rejected(client, params):
    assert client.get("/api/items", params=params).status_code == 422
