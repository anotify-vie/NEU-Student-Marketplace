# API CONTRACT v1 — Draft for Frontend/Backend Agreement

> This is the **team's proposed design**, not a verbatim requirement from the instructor's slides. All four members must approve it before implementation. Local API base: `http://127.0.0.1:8000/api`.

## Shared conventions

- UTF-8 JSON; integer IDs; ISO 8601 timestamps; integer prices in VND.
- Proposed authentication: **HTTP-only session cookie**. Frontend uses `credentials: 'include'`; backend CORS must allow only explicitly listed frontend origins (never wildcard origins with credentials).
- JSON for data-changing requests, except image uploads using `multipart/form-data`.
- Standard error shape: `{ "detail": "A clear English error message" }`; appropriate HTTP 400/401/403/404/422/500.
- Public GET access to item lists/details; login required for create/edit/delete, chat and private profile.
- Never trust `seller_id` from client input: derive it from the authenticated session. Enforce listing ownership and conversation membership on the server.

## Data models

```json
{
  "User": {"id": 1, "display_name": "Minh Anh Nguyen", "email": "student@example.com", "avatar_url": null, "faculty": "Faculty of Economics", "cohort": "K64", "bio": "Economics student at NEU.", "campus": "NEU Main Campus", "joined_at": "2026-10-31T09:00:00+07:00"},
  "Item": {
    "id": 101, "seller_id": 1, "title": "Microeconomics Textbook",
    "category": "textbooks", "price": 45000, "condition": "good",
    "description": "Used but in good condition", "location": "NEU - Zone A",
    "status": "available", "image_urls": ["/uploads/example.jpg"],
    "created_at": "2026-10-31T09:00:00+07:00"
  },
  "Conversation": {"id": 10, "item_id": 101, "buyer_id": 2, "seller_id": 1, "updated_at": "2026-10-31T10:00:00+07:00"},
  "Message": {"id": 500, "conversation_id": 10, "sender_id": 2, "text": "Is the textbook still available?", "created_at": "2026-10-31T10:00:00+07:00"}
}
```

- `category`: `textbooks`, `uniforms`, `study_tools`, `student_items`, `other`.
- `condition`: `new`, `good`, `fair`.
- `status`: `available`, `reserved`, `sold`.
- Image URLs may be relative paths; `api.js` converts them to backend absolute URLs when needed.
- Profile updates (`PATCH /api/users/me`) accept optional `display_name` (2–80 chars), `faculty` (2–80 chars), `cohort` (e.g. `K64`) and `bio` (≤300 chars); omitted fields stay unchanged.

## Endpoints and owners

| Method | Route | Purpose | Owner |
|---|---|---|---|
| POST | `/api/auth/register` | `{display_name,email,password}` → user | BE1 |
| POST | `/api/auth/login` | `{email,password}` → session cookie and user | BE1 |
| POST | `/api/auth/logout` | Clear session | BE1 |
| GET | `/api/auth/me` | Current user or 401 | BE1 |
| GET | `/api/users/{user_id}` | Safe public profile/seller info (never includes `email`) | BE1 |
| PATCH | `/api/users/me` | Update own profile `{display_name?,faculty?,cohort?,bio?}`; 401 if unauthenticated | BE1 |
| GET | `/api/items/{id}` | Item detail and public seller info | BE1 |
| POST | `/api/items` | Create authenticated item (JSON fields and uploaded image URLs) | BE1 |
| PATCH | `/api/items/{id}` | Edit item (owner only) | BE1 |
| DELETE | `/api/items/{id}` | Delete item (owner only) | BE1 |
| POST | `/api/uploads` | Upload one image; return `image_url` (login required) | BE1 |
| GET | `/api/me/items` | Authenticated user's own listings | BE1 |
| GET | `/api/items` | List/search/filter/sort/paginate | BE2 |
| PATCH | `/api/items/{id}/status` | `{status}`; owner only | BE2 |
| GET | `/api/conversations` | Authenticated user's conversations | BE2 |
| POST | `/api/conversations` | `{item_id}`; open/create conversation with seller | BE2 |
| GET | `/api/conversations/{id}/messages` | Read messages | BE2 |
| POST | `/api/conversations/{id}/messages` | `{text}` → new message | BE2 |

**Register overlapping `/items` routes carefully** so dynamic `/{id}` routes do not intercept static paths. `/me/items` is separated as shown.

## GET /api/items query

`?q=microeconomics&category=textbooks&min_price=0&max_price=100000&condition=good&status=available&sort=newest&page=1&page_size=12`

- `q`: case-insensitive text search over title and description.
- `sort`: `newest` (default), `price_asc`, `price_desc`.
- `page >= 1`, `1 <= page_size <= 50`.
- Response:

```json
{
  "items": [{"id":101,"seller_id":1,"title":"Microeconomics Textbook","category":"textbooks","price":45000,"condition":"good","description":"Used but in good condition","location":"NEU - Zone A","status":"available","image_urls":["/uploads/example.jpg"],"created_at":"2026-10-31T09:00:00+07:00"}],
  "total": 1, "page": 1, "page_size": 12
}
```

## Image uploads

`POST /api/uploads` sends a `FormData` field named `file`, returning `{ "image_url": "/uploads/abc123.jpg" }`. Allow jpeg/png/webp, maximum 5 MB per image, server-generated random filenames, checks on MIME type and actual file content, no executable uploads. Maximum five images per item. Frontend previews selected files, uploads them and then submits item `image_urls`.

## Chat and polling

- `POST /api/conversations` is idempotent for `(buyer_id, item_id)` to avoid duplicate conversations.
- `GET /api/conversations/{id}/messages?after_id=500` fetches new messages. Without `after_id`, fetch the latest 50 and display in chronological order.
- Poll every 3–5 seconds **only while the chat screen is open**; stop polling on navigation. Reject any read/write by nonparticipants.
- Message length ≤1000 characters; trim surrounding spaces; reject empty messages.

## Shared error test cases

- Unauthenticated POST/PATCH/DELETE → 401.
- Another user edits/deletes/changes status → 403.
- Unknown ID → 404.
- Missing fields, negative price, invalid enum/image → 400 or 422.
- Search with no matches → 200 with `items: []`, `total: 0`.
- Reject chats with own listing and new chats on sold listings.
- CORS must specify actual Live Server origins, e.g. `http://127.0.0.1:5500`, `http://localhost:5500`; do not combine wildcard origins and cookie credentials.

## API approval process

FE1 and FE2 implement `api.js` with mocked responses first. BE1 and BE2 review this contract. Change contracts only through a separate, approved PR agreed to by all four members. Never silently rename response fields or endpoints mid-development.
