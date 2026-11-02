import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


DATABASE_PATH = _env("MARKETPLACE_DB_PATH", str(BACKEND_DIR / "marketplace.db"))

UPLOADS_DIR = Path(_env("MARKETPLACE_UPLOADS_DIR", str(BACKEND_DIR / "uploads")))
MAX_UPLOAD_BYTES = int(_env("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))

CORS_ORIGINS = [
    origin.strip()
    for origin in _env(
        "CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500"
    ).split(",")
    if origin.strip()
]

SESSION_COOKIE_NAME = _env("SESSION_COOKIE_NAME", "session_token")
SESSION_MAX_AGE_SECONDS = int(_env("SESSION_MAX_AGE_SECONDS", str(7 * 24 * 3600)))
COOKIE_SECURE = _env("COOKIE_SECURE", "false").lower() == "true"
