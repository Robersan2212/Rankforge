"""AES-256-GCM encryption for OAuth tokens at rest."""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException

_NONCE_BYTES = 12
_KEY_BYTES = 32


def _encryption_key() -> bytes:
    raw = os.environ.get("TOKEN_ENCRYPTION_KEY", "").strip()
    if not raw:
        raise HTTPException(
            status_code=500,
            detail="TOKEN_ENCRYPTION_KEY is not configured on the API server",
        )

    for decoder in (
        lambda v: base64.urlsafe_b64decode(v + "=="),
        lambda v: bytes.fromhex(v),
        lambda v: v.encode("utf-8"),
    ):
        try:
            key = decoder(raw)
            if len(key) == _KEY_BYTES:
                return key
        except Exception:
            continue

    raise HTTPException(
        status_code=500,
        detail="TOKEN_ENCRYPTION_KEY must be 32 bytes (base64, hex, or raw)",
    )


def encrypt_token(plaintext: str) -> str:
    key = _encryption_key()
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt_token(encrypted: str) -> str:
    key = _encryption_key()
    try:
        payload = base64.urlsafe_b64decode(encrypted.encode("ascii"))
        nonce, ciphertext = payload[:_NONCE_BYTES], payload[_NONCE_BYTES:]
        return AESGCM(key).decrypt(nonce, ciphertext, None).decode("utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to decrypt stored token",
        ) from exc
