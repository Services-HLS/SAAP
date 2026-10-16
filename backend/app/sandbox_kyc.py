"""Sandbox.co.in Aadhaar Offline e-KYC (OTP) client.

Matched to the working Vanadarshani integration:
  d:\\HARITHA\\vanadarshani\\vanadarshani-backend\\src\\services\\sandbox.service.js

Key details from that project:
- baseUrl: https://api.sandbox.co.in
- x-api-version: 2.0
- Authorization: SANDBOX_AUTH_TOKEN (static JWT from console / authenticate)
- x-api-key: SANDBOX_API_KEY
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

log = logging.getLogger("sandbox_kyc")

_token: str | None = None
_token_expires_at = 0.0


def _api_key() -> str:
    return os.environ.get("SANDBOX_API_KEY", "").strip()


def _api_secret() -> str:
    return os.environ.get("SANDBOX_API_SECRET", "").strip()


def _auth_token_env() -> str:
    """Same as Vanadarshani: process.env.SANDBOX_AUTH_TOKEN"""
    return os.environ.get("SANDBOX_AUTH_TOKEN", "").strip()


def _api_base() -> str:
    return os.environ.get("SANDBOX_API_BASE", "https://api.sandbox.co.in").rstrip("/")


def _api_version() -> str:
    # Vanadarshani uses 2.0 — 1.0.0 caused body/version mismatches.
    return os.environ.get("SANDBOX_API_VERSION", "2.0").strip() or "2.0"


class SandboxKycError(Exception):
    def __init__(self, message: str, status_code: int = 502, details: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


def credentials_configured() -> bool:
    # Working project needs API key + auth token (secret only used to mint a new token).
    return bool(_api_key() and (_auth_token_env() or _api_secret()))


def _headers(access_token: str) -> dict[str, str]:
    token = access_token.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    return {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-version": _api_version(),
        "Authorization": token,
        "x-api-key": _api_key(),
    }


def _extract_message(payload: Any, fallback: str) -> str:
    if not isinstance(payload, dict):
        return fallback
    data = payload.get("data")
    if isinstance(data, dict):
        for key in ("message", "msg", "error", "detail"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    for key in ("message", "msg", "error", "detail"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return fallback


def _friendly_error(message: str, status_code: int) -> str:
    lower = (message or "").lower()
    if "invalid request body" in lower or "invalid request" in lower:
        return (
            "Sandbox rejected the verify payload. Resend OTP and try again. "
            "(reference_id must be sent as a string.)"
        )
    if status_code == 503 or "source unavailable" in lower:
        return (
            "Aadhaar source is temporarily unavailable (Sandbox/UIDAI 503). "
            "Wait 30–60 seconds, Resend OTP, then verify the new code."
        )
    if "under process" in lower:
        return "Verification is still processing. Wait 30 seconds and try Verify again."
    if "invalid otp" in lower:
        return "Invalid OTP. Check the 6-digit code, or Resend OTP."
    if "otp expired" in lower or "expired" in lower:
        return "OTP expired. Click Resend OTP and enter the new code."
    if status_code in {401, 403} or "unauthorized" in lower or "forbidden" in lower:
        return (
            "Sandbox auth failed. Paste a fresh SANDBOX_AUTH_TOKEN from console "
            "(same as Vanadarshani) or ensure SANDBOX_API_SECRET can mint a new token."
        )
    return message or "Sandbox KYC request failed"


async def authenticate(force: bool = False) -> str:
    """Mint a fresh JWT with API secret (Vanadarshani token in .env is often expired).

    Falls back to SANDBOX_AUTH_TOKEN only when secret is missing.
    """
    global _token, _token_expires_at

    if not force and _token and time.time() < _token_expires_at:
        return _token

    if not _api_secret():
        env_token = _auth_token_env()
        if env_token:
            return env_token
        raise SandboxKycError(
            "Set SANDBOX_API_SECRET (or SANDBOX_AUTH_TOKEN like Vanadarshani)",
            status_code=503,
        )

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": _api_key(),
        "x-api-secret": _api_secret(),
        "x-api-version": _api_version(),
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(f"{_api_base()}/authenticate", headers=headers)

    try:
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        raise SandboxKycError("Sandbox authenticate returned non-JSON", details=response.text) from exc

    if response.status_code >= 400 or (isinstance(payload, dict) and int(payload.get("code", 200)) >= 400):
        raise SandboxKycError(
            _friendly_error(_extract_message(payload, "Sandbox authenticate failed"), response.status_code or 502),
            status_code=response.status_code or 502,
            details=payload,
        )

    data = payload.get("data") if isinstance(payload, dict) else None
    token = data.get("access_token") if isinstance(data, dict) else None
    if not token and isinstance(payload, dict):
        token = payload.get("access_token")
    if not token:
        raise SandboxKycError("Sandbox authenticate did not return access_token", details=payload)

    _token = str(token)
    _token_expires_at = time.time() + 23 * 60 * 60
    return _token


async def _request(method: str, path: str, json_body: dict) -> dict:
    token = await authenticate()
    url = f"{_api_base()}{path}"

    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.request(method, url, headers=_headers(token), json=json_body)
        if response.status_code in {401, 403}:
            # Static token may be expired — try minting a fresh one with API secret.
            token = await authenticate(force=True)
            response = await client.request(method, url, headers=_headers(token), json=json_body)

    try:
        payload = response.json()
    except Exception as exc:  # noqa: BLE001
        raise SandboxKycError("Sandbox API returned non-JSON", details=response.text) from exc

    if not isinstance(payload, dict):
        raise SandboxKycError("Unexpected Sandbox API response", details=payload)

    code = payload.get("code", response.status_code)
    if response.status_code >= 400 or (isinstance(code, int) and code >= 400):
        message = _extract_message(payload, "Sandbox KYC request failed")
        log.warning("Sandbox %s %s failed: %s %s", method, path, message, payload)
        raise SandboxKycError(
            _friendly_error(message, response.status_code if response.status_code >= 400 else int(code)),
            status_code=response.status_code if response.status_code >= 400 else int(code),
            details=payload,
        )
    return payload


async def generate_otp(aadhaar_number: str, reason: str = "KYC verification") -> dict:
    # Body matches Vanadarshani sandbox.service.js sendAadhaarOtp
    payload = await _request(
        "POST",
        "/kyc/aadhaar/okyc/otp",
        {
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
            "aadhaar_number": aadhaar_number,
            "consent": "Y",
            "reason": (reason or "KYC verification")[:40],
        },
    )
    data = payload.get("data") or {}
    reference_id = data.get("reference_id")
    if reference_id is None:
        reference_id = data.get("ref_id")
    if reference_id is None or reference_id == "":
        raise SandboxKycError("Sandbox Generate OTP did not return reference_id", details=payload)
    return {
        "reference_id": str(reference_id),
        "message": data.get("message") or "OTP sent successfully",
        "transaction_id": payload.get("transaction_id"),
        "raw": data,
    }


async def verify_otp(reference_id: str, otp: str) -> dict:
    # Live probe against api.sandbox.co.in (x-api-version 2.0):
    # - reference_id as int  -> HTTP 400 "Invalid request body"
    # - reference_id as str  -> body accepted (then OTP/ref validated)
    # Always send reference_id as a JSON string.
    ref = str(reference_id).strip()
    otp_value = str(otp).strip()
    payload = await _request(
        "POST",
        "/kyc/aadhaar/okyc/otp/verify",
        {
            "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
            "reference_id": ref,
            "otp": otp_value,
        },
    )

    data = payload.get("data") or {}
    # Some Sandbox responses return HTTP 200 with only an error message in data.
    status = str(data.get("status") or "").upper()
    message = str(data.get("message") or "")
    verified_flag = payload.get("verified") is True or data.get("verified") is True

    if not data.get("name") and not verified_flag:
        lower = message.lower()
        if lower in {"invalid otp", "otp expired", "invalid reference_id"} or "otp" in lower or "unavailable" in lower or "reference" in lower:
            raise SandboxKycError(_friendly_error(message, 400), status_code=400, details=payload)
        if status and status not in {"VALID", "SUCCESS", "VERIFIED"}:
            raise SandboxKycError(_friendly_error(message or status, 400), status_code=400, details=payload)

    if status and status not in {"VALID", "SUCCESS", "VERIFIED"} and not verified_flag and not data.get("name"):
        raise SandboxKycError(_friendly_error(message or status, 400), status_code=400, details=payload)

    return {
        "reference_id": str(data.get("reference_id") or reference_id),
        "status": status or "VALID",
        "message": message or "OTP verified successfully",
        "name": data.get("name") or "",
        "date_of_birth": data.get("date_of_birth") or "",
        "gender": data.get("gender") or "",
        "full_address": data.get("full_address") or "",
        "care_of": data.get("care_of") or "",
        "year_of_birth": data.get("year_of_birth") or "",
        "photo": data.get("photo") or "",
        "address": data.get("address") or {},
        "transaction_id": payload.get("transaction_id"),
        "raw": data if data else payload,
    }


def map_gender(value: str) -> str:
    key = (value or "").strip().upper()
    if key in {"F", "FEMALE"}:
        return "Female"
    if key in {"M", "MALE"}:
        return "Male"
    if key:
        return "Other"
    return ""


def map_dob(value: str) -> str:
    """Convert DD-MM-YYYY (Sandbox) to YYYY-MM-DD when possible."""
    text = (value or "").strip()
    if not text:
        return ""
    for sep in ("-", "/"):
        parts = text.split(sep)
        if len(parts) == 3 and len(parts[2]) == 4:
            day, month, year = parts
            if len(day) <= 2 and len(month) <= 2:
                try:
                    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
                except ValueError:
                    pass
    if len(text) == 10 and text[4] == "-" and text[7] == "-":
        return text
    return ""
