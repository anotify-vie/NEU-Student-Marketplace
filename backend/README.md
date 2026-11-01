# Backend (BE1)

FastAPI + SQLite backend for the NEU Student Marketplace.

## Requirements

- Python 3.11+ (tested on 3.13)

## Setup (Windows)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Setup (macOS/Linux)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload
```

- Swagger UI: <http://127.0.0.1:8000/docs>
- Health check: `GET /api/health`

The SQLite database (`marketplace.db`) is created automatically on first start.

## Seed demo accounts and listings

```bash
python seed.py
```

| Email | Password |
|---|---|
| `buyer@example.com` | `DemoPass123!` |
| `seller@example.com` | `DemoPass123!` |

This also creates ten demo listings (eight available for the seller, one sold and one reserved for the buyer) and copies the sample images into `backend/uploads/`. These are local demonstration accounts only. Never reuse this password anywhere real.

## Reset the database

Stop the server, delete `backend/marketplace.db`, then start the server again (and re-run `python seed.py` if you want the demo data back).

## Tests

```bash
pytest
```

## Configuration (environment variables)

| Variable | Default |
|---|---|
| `MARKETPLACE_DB_PATH` | `backend/marketplace.db` |
| `MARKETPLACE_UPLOADS_DIR` | `backend/uploads` |
| `MAX_UPLOAD_BYTES` | `5242880` (5 MB) |
| `CORS_ORIGINS` | `http://127.0.0.1:5500,http://localhost:5500` |
| `SESSION_COOKIE_NAME` | `session_token` |
| `SESSION_MAX_AGE_SECONDS` | `604800` (7 days) |
| `COOKIE_SECURE` | `false` |

Never commit `.env` or real secrets. Uploaded images and the SQLite database are git-ignored.

## Implemented endpoints (API v1)

| Method | Route | Auth |
|---|---|---|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/logout` | public |
| GET | `/api/auth/me` | session cookie |
| PATCH | `/api/users/me` | session cookie |
| GET | `/api/users/{user_id}` | public (email never exposed) |
| POST | `/api/items` | session cookie (owner = current user) |
| GET | `/api/items` | public (`q`, `category`, `min_price`, `max_price`, `condition`, `status`, `sort`, `page`, `page_size`) |
| GET | `/api/items/{item_id}` | public |
| PATCH | `/api/items/{item_id}` | session cookie (owner only) |
| DELETE | `/api/items/{item_id}` | session cookie (owner only) |
| GET | `/api/me/items` | session cookie |
| POST | `/api/uploads` | session cookie (JPEG/PNG/WebP, max 5 MB, max 5 images per listing) |

Authentication uses an HTTP-only `session_token` cookie; passwords are hashed with bcrypt. Uploaded images are served from `/uploads/*`.
