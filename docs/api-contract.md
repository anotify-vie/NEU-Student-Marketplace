# API CONTRACT v1.1 — Proposed listing enhancements (pending team approval)

> This document describes the **target API contract**, not proof that these enhancements are already implemented. Approve it with FE/BE before coding, then merge the documentation PR first. Preserve existing routes and response fields unless explicitly extended below. Local API base: `http://127.0.0.1:8000/api`.

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
    "category": "textbooks", "price": 45000, "quantity": 1, "condition": "good",
    "description": "Used but in good condition", "location": "NEU - Zone A",
    "status": "available", "image_urls": ["/uploads/example.jpg"],
    "created_at": "2026-10-31T09:00:00+07:00"
  },
  "Conversation": {
    "id": 10, "item_id": 101, "buyer_id": 2, "seller_id": 1, "updated_at": "2026-10-31T10:00:00+07:00",
    "other_user": {"id": 1, "display_name": "Minh Anh Nguyen", "avatar_url": null, "faculty": "Faculty of Economics", "cohort": "K64", "bio": "Economics student at NEU.", "campus": "NEU Main Campus", "joined_at": "2026-10-31T09:00:00+07:00"},
    "item": {"id": 101, "seller_id": 1, "title": "Microeconomics Textbook", "category": "textbooks", "price": 45000, "quantity": 1, "condition": "good", "description": "Used but in good condition", "location": "NEU - Zone A", "status": "available", "image_urls": ["/uploads/example.jpg"], "created_at": "2026-10-31T09:00:00+07:00"},
    "last_message": {"id": 500, "conversation_id": 10, "sender_id": 2, "text": "Is the textbook still available?", "created_at": "2026-10-31T10:00:00+07:00"}
  },
  "Message": {"id": 500, "conversation_id": 10, "sender_id": 2, "text": "Is the textbook still available?", "created_at": "2026-10-31T10:00:00+07:00"}
}
```

- `category`: `textbooks`, `uniforms`, `study_tools`, `student_items`, `other`.
- `condition`: `new`, `good`, `fair`.
- `status`: `available`, `reserved`, `sold`.
- Image URLs may be relative paths; `api.js` converts them to backend absolute URLs when needed.
- Items include `quantity` (integer >= 1, default 1). `price` remains an integer VND amount but now means the **total asking price for all `quantity` units together**, not price per unit.
- `image_urls` is an array of 0–5 image URLs; `[]` is valid. Missing images must not prevent creating or editing a listing.
- `GET /api/conversations` and `POST /api/conversations` return the Conversation shape above. `other_user` is the other participant's public profile (never `email`), `item` is the Item and `last_message` is the latest Message, or `null` before the first message. Conversations are sorted by `updated_at`, newest first.
- Profile updates (`PATCH /api/users/me`) accept optional `display_name` (2–80 chars), `faculty` (2–80 chars), `cohort` (e.g. `K64`) and `bio` (≤300 chars); omitted fields stay unchanged.
- Integration addition: `GET /api/users/{user_id}/stats` returns public listing counts `{total, available, reserved, sold}` from the same SQLite items shown elsewhere. Counts exclude deleted listings, include zeroes, and return 404 for an unknown user. No private account data is exposed.

## Endpoints and owners

| Method | Route | Purpose | Owner |
|---|---|---|---|
| POST | `/api/auth/register` | `{display_name,email,password}` → user | BE1 |
| POST | `/api/auth/login` | `{email,password}` → session cookie and user | BE1 |
| POST | `/api/auth/logout` | Clear session | BE1 |
| GET | `/api/auth/me` | Current user or 401 | BE1 |
| GET | `/api/users/{user_id}` | Safe public profile/seller info (never includes `email`) | BE1 |
| GET | `/api/users/{user_id}/stats` | Public listing counts by status for Profile | BE1 |
| PATCH | `/api/users/me` | Update own profile `{display_name?,faculty?,cohort?,bio?}`; 401 if unauthenticated | BE1 |
| GET | `/api/items/{id}` | Item detail and public seller info | BE1 |
| POST | `/api/items` | Create authenticated item; images optional; `quantity` defaults to 1 | BE1 |
| PATCH | `/api/items/{id}` | Partial item update, including optional image list/quantity (owner only) | BE1 |
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
  "items": [{"id":101,"seller_id":1,"title":"Microeconomics Textbook","category":"textbooks","price":45000,"quantity":1,"condition":"good","description":"Used but in good condition","location":"NEU - Zone A","status":"available","image_urls":["/uploads/example.jpg"],"created_at":"2026-10-31T09:00:00+07:00"}],
  "total": 1, "page": 1, "page_size": 12
}
```

## Listing quantity, pricing and image contract (v1.1 target)

The following extensions apply to `POST /api/items`, `PATCH /api/items/{id}`, `GET /api/items/{id}`, `GET /api/items`, `GET /api/me/items`, and any embedded Item object in conversations. Existing item fields and endpoint paths remain unchanged.

- **Create:** `title`, `category`, `condition`, `description`, `location` and `price` remain required under the current contract. `quantity` is optional with default `1`; `image_urls` is optional with default `[]`. Validate `quantity` as an integer >= 1, `price` as an integer >= 0, and `image_urls` as a list with 0–5 acceptable uploaded image URLs. Reject invalid values with the existing validation error convention.
- **Update:** `PATCH /api/items/{id}` updates *only supplied fields*; omitted fields remain unchanged. `quantity` may be updated, but changing only `quantity` preserves the current **total** `price`. `image_urls` is **replacement semantics**: send the complete desired list (existing plus new) to add images; send `[]` to remove all image references. Only the owner may update. Do not interpret omission as clearing images.
- **Upload:** Use existing `POST /api/uploads` (authenticated; multipart `file`) to obtain an `image_url`, then submit the desired list through `POST /api/items` or `PATCH /api/items/{id}`. No new upload endpoint needed. Creating without uploading is valid; sellers may upload later when editing.
- **Responses:** Always include `quantity` and `image_urls`, even if `quantity` is `1` and `image_urls` is `[]`. Include `quantity` in embedded conversation `item` objects too, so a single shared Item schema is consistent.
- **Old SQLite rows:** migrate existing data without deleting listings or changing their prices; assign `quantity = 1` to every existing item, with a DB-level default/non-null constraint as appropriate. Schema initialization alone may not migrate an existing SQLite table.
- **Price shown for selected units:** the browser may select integer `selected_quantity` between 1 and the listing `quantity`; this is **UI state**, not a new field on Item and not a checkout/order request. Calculate `selected_price_vnd = floor((2 * price * selected_quantity + quantity) / (2 * quantity))` for nonnegative integer VND prices (equivalent to round-half-up to the nearest VND). Use integer-safe arithmetic; show the exact total `price` when all units are selected. Example: `price=100000`, `quantity=3`: selecting 1 → `33333`, 2 → `66667`, 3 → `100000` VND. The display is informational; there is no reservation, payment, or automatic inventory decrement.
- **Search/sort:** `min_price`, `max_price`, `price_asc`, `price_desc` continue using the **total listing price** for backwards compatibility. Clearly label this in the UI; no unit-price filter is introduced in this increment.

Example create body:

```json
{
  "title": "Microeconomics Textbook", "category": "textbooks", "condition": "good",
  "description": "Used but in good condition", "location": "NEU Campus",
  "quantity": 5, "price": 250000, "image_urls": []
}
```

Example edit adding an image without losing existing images:

```json
{"quantity": 3, "price": 180000, "image_urls": ["/uploads/existing.jpg", "/uploads/new.jpg"]}
```

### Authentication validation notes for FE

- Login uses **email** and password; this contract does **not** introduce username-based login. Show the email format hint rather than claiming a username is accepted.
- Verified against `backend/schemas/__init__.py` and `backend/routers/auth.py`:
  - **Registration display name:** 2–80 characters; surrounding whitespace is trimmed and the trimmed name must still contain at least 2 characters. The request also enforces the 80-character limit before trimming.
  - **Registration email:** required, validated with Pydantic `EmailStr`; surrounding whitespace is trimmed and the address is lowercased before validation/storage. No university-domain restriction or email verification is implemented. A duplicate normalized address returns 409.
  - **Registration password:** at least **8 characters** and at most **72 UTF-8 bytes** (bcrypt limit). Passwords are not trimmed; there is no required uppercase, digit or symbol rule. A password may satisfy the character minimum but exceed the byte maximum, e.g. 37 `á` characters occupy 74 bytes and are rejected. These limits return 400; the request schema separately accepts only strings of 1–128 characters (otherwise 422).
  - **Login:** email is trimmed/lowercased; its request limit is 254 characters. Login does not use `EmailStr` validation or impose registration's password minimum: its password schema accepts 1–128 characters. Unknown email or incorrect password returns the same 401 message, `Incorrect email or password.`; schema-invalid requests return 422.
- FE hints must use these server-enforced rules, including the UTF-8 byte distinction, without adding stricter password criteria or username-based login.

## Image uploads

`POST /api/uploads` sends a `FormData` field named `file`, returning `{ "image_url": "/uploads/abc123.jpg" }`. Allow jpeg/png/webp, maximum 5 MB per image, server-generated random filenames, checks on MIME type and actual file content, no executable uploads. Maximum five images per item, **minimum zero**. Frontend previews selected files (if any), uploads them and then submits item `image_urls`; sellers may create a listing without any image and add images during a later edit.

## Chat and polling

- `POST /api/conversations` is idempotent for `(buyer_id, item_id)` to avoid duplicate conversations.
- `GET /api/conversations/{id}/messages?after_id=500` fetches new messages. Without `after_id`, fetch the latest 50 and display in chronological order.
- Poll every 3–5 seconds **only while the chat screen is open**; stop polling on navigation. Reject any read/write by nonparticipants.
- Message length ≤1000 characters; trim surrounding spaces; reject empty messages.

## Shared error test cases

- Unauthenticated POST/PATCH/DELETE → 401.
- Another user edits/deletes/changes status → 403.
- Unknown ID → 404.
- Missing required fields, negative price, quantity < 1, non-integer quantity/price, invalid enum/image, more than five images → 400 or 422.
- Image-free create (omitted `image_urls` or `[]`) succeeds; edit can append an image after upload without losing old URLs; sending `[]` removes references.
- Legacy items retain their existing price and read as `quantity=1` following migration.
- Selected quantity `1..quantity` never exceeds available units; price rounding matches the documented integer rule.
- Search with no matches → 200 with `items: []`, `total: 0`.
- Reject chats with own listing and new chats on sold listings.
- CORS must specify actual Live Server origins, e.g. `http://127.0.0.1:5500`, `http://localhost:5500`; do not combine wildcard origins and cookie credentials.

## API approval process

FE1 and FE2 implement `api.js` with mocked responses first. BE1 and BE2 review this contract. Change contracts only through a separate, approved PR agreed to by all four members. Never silently rename response fields or endpoints mid-development. **For v1.1: merge this contract change first, then BE and FE implement in parallel on separate branches; merge BE before FE real-API integration and full-stack acceptance.**
