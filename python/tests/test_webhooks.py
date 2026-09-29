import hashlib
import hmac
import json

from crayonz import Client, verify_webhook_signature

SECRET = "whsec_test_secret"


def sign(body: str, key: str = SECRET) -> str:
    return hmac.new(key.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def test_accepts_correctly_signed_payload():
    body = json.dumps({"event": "usage.threshold", "data": {"pct": 80}, "delivered_at": "now"})
    assert verify_webhook_signature(body, sign(body), SECRET) is True


def test_rejects_tampered_body():
    body = json.dumps({"event": "usage.threshold", "data": {"pct": 80}})
    signature = sign(body)
    tampered = json.dumps({"event": "usage.threshold", "data": {"pct": 100}})
    assert verify_webhook_signature(tampered, signature, SECRET) is False


def test_rejects_wrong_secret():
    body = json.dumps({"event": "key.rotated", "data": {}})
    assert verify_webhook_signature(body, sign(body, "wrong_secret"), SECRET) is False


def test_rejects_missing_signature():
    assert verify_webhook_signature("{}", None, SECRET) is False
    assert verify_webhook_signature("{}", "", SECRET) is False


def test_rejects_wrong_length_signature_without_raising():
    assert verify_webhook_signature("{}", "not-a-valid-length", SECRET) is False


def test_accepts_bytes_body():
    body = json.dumps({"event": "plan.activated", "data": {}})
    assert verify_webhook_signature(body.encode("utf-8"), sign(body), SECRET) is True


def test_available_as_client_webhooks_verify():
    client = Client(api_key="cz_test_abc")
    body = json.dumps({"event": "plan.activated", "data": {}})
    assert client.webhooks.verify(body, sign(body), SECRET) is True
    client.close()
