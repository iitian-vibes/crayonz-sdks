"""Inbound webhook verification.

Every delivery is a POST with the event name in ``X-Crayonz-Event`` and an
HMAC-SHA256 hex digest of the *raw* request body, keyed on your webhook
secret, in ``X-Crayonz-Signature``. Always verify against the raw bytes —
not a re-serialized/parsed version, which can differ byte-for-byte and make
a legitimate delivery look forged.
"""
from __future__ import annotations

import hashlib
import hmac
from typing import Optional, Union


def verify_webhook_signature(
    raw_body: Union[str, bytes],
    signature: Optional[str],
    secret: str,
) -> bool:
    """Verify a Crayonz webhook delivery. Returns True iff the signature is
    valid, using a constant-time comparison.

    Example (Flask)::

        raw = request.get_data()
        ok = verify_webhook_signature(raw, request.headers.get("X-Crayonz-Signature"), secret)
        if not ok:
            abort(401)
    """
    if not signature or not secret:
        return False
    body_bytes = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    expected = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
    # hmac.compare_digest is constant-time and safe with mismatched lengths.
    return hmac.compare_digest(expected, signature)
