import base64
import hashlib
import hmac
import json
import os
import time

SECRET = os.environ.get("PORTAL_SECRET", "dev-only-change-me")
SANDBOX = os.environ.get("SANDBOX_MODE", "1") == "1"


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or base64.b16encode(os.urandom(8)).decode().lower()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def check_password(password: str, stored: str) -> bool:
    salt, digest = stored.split("$", 1)
    trial = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return hmac.compare_digest(trial, digest)


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def make_token(user_id: int, role: str, district: str) -> str:
    payload = {"sub": user_id, "role": role, "district": district, "exp": int(time.time()) + 60 * 60 * 8}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_token(token: str) -> dict | None:
    try:
        body, sig = token.split(".", 1)
        expect = _b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(expect, sig):
            return None
        payload = json.loads(_unb64(body))
        if payload["exp"] < time.time():
            return None
        return payload
    except (ValueError, KeyError, json.JSONDecodeError):
        return None
