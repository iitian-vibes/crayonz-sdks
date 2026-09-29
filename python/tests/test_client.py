import os

import httpx
import pytest
import respx

from crayonz import (
    APIError,
    AuthenticationError,
    Client,
    InsufficientCreditsError,
    RateLimitError,
    ValidationError,
)

BASE = "https://api.crayonz.ai"


def test_requires_api_key(monkeypatch):
    monkeypatch.delenv("CRAYONZ_API_KEY", raising=False)
    with pytest.raises(ValueError, match="api_key is required"):
        Client()


def test_falls_back_to_env_var(monkeypatch):
    monkeypatch.setenv("CRAYONZ_API_KEY", "cz_test_fromenv")
    client = Client()
    assert isinstance(client, Client)
    client.close()


def test_rejects_wrong_prefix():
    with pytest.raises(ValueError, match="must start with cz_live_ or cz_test_"):
        Client(api_key="sk_live_nope")


def test_accepts_valid_prefixes():
    Client(api_key="cz_test_abc").close()
    Client(api_key="cz_live_abc").close()


@respx.mock
def test_sends_expected_headers():
    route = respx.post(f"{BASE}/api/mockup/render").mock(
        return_value=httpx.Response(200, json={"status": "success", "mockup_url": "x", "garment": "tshirt", "color": {"name": "Black", "hex": "#000"}, "view": "front", "credits_charged": 10})
    )
    with Client(api_key="cz_test_abc") as client:
        client.mockups.render(design_url="https://x/d.png", garment="tshirt")

    req = route.calls[0].request
    assert req.headers["x-api-key"] == "cz_test_abc"
    assert req.headers["user-agent"].startswith("crayonz-python/")
    assert req.headers["content-type"] == "application/json"


@respx.mock
def test_sends_tag_header():
    route = respx.post(f"{BASE}/api/mockup/render").mock(
        return_value=httpx.Response(200, json={"status": "success", "mockup_url": "x", "garment": "tshirt", "color": {"name": "Black", "hex": "#000"}, "view": "front", "credits_charged": 10})
    )
    with Client(api_key="cz_test_abc", tag="project=launch") as client:
        client.mockups.render(design_url="https://x/d.png", garment="tshirt")
    assert route.calls[0].request.headers["x-crayonz-tag"] == "project=launch"


@pytest.mark.parametrize(
    "status,body,expected_cls",
    [
        (401, {"status": "error", "detail": "invalid api key"}, AuthenticationError),
        (402, {"status": "error", "detail": "Insufficient credits: this call costs 18 and the balance is 6."}, InsufficientCreditsError),
        (422, {"detail": [{"loc": ["body", "design_brief"], "msg": "Field required", "type": "missing"}]}, ValidationError),
        (403, {"status": "error", "detail": "missing scope: design-api:write"}, APIError),
        (404, {"status": "error", "detail": "no size chart for hoodiee"}, APIError),
        (500, {"status": "error", "error": "boom"}, APIError),
    ],
)
@respx.mock
def test_error_mapping(status, body, expected_cls):
    respx.post(f"{BASE}/api/quality/score").mock(return_value=httpx.Response(status, json=body))
    with Client(api_key="cz_test_abc", max_retries=0) as client:
        with pytest.raises(expected_cls):
            client.quality.score(image_url="x", design_brief="y")


@respx.mock
def test_extracts_customapi_error_shape():
    respx.post(f"{BASE}/v1/try-on").mock(
        return_value=httpx.Response(401, json={"error": "Unauthorized", "message": "Invalid API key"})
    )
    with Client(api_key="cz_test_abc", max_retries=0) as client:
        with pytest.raises(AuthenticationError, match="Invalid API key"):
            client.try_on.create(user_photo="a", product_image="b")


@respx.mock
def test_joins_validation_detail_with_location():
    respx.post(f"{BASE}/api/quality/score").mock(
        return_value=httpx.Response(
            422, json={"detail": [{"loc": ["body", "design_brief"], "msg": "Field required", "type": "missing"}]}
        )
    )
    with Client(api_key="cz_test_abc", max_retries=0) as client:
        with pytest.raises(ValidationError, match=r"body\.design_brief: Field required"):
            client.quality.score(image_url="x", design_brief="y")


@respx.mock
def test_error_carries_status_body_endpoint():
    body = {"status": "error", "detail": "no size chart for hoodiee"}
    respx.post(f"{BASE}/api/mockup/render").mock(return_value=httpx.Response(404, json=body))
    with Client(api_key="cz_test_abc", max_retries=0) as client:
        with pytest.raises(APIError) as exc_info:
            client.mockups.render(design_url="x", garment="hoodiee")
    err = exc_info.value
    assert err.status == 404
    assert err.body == body
    assert err.endpoint == "/api/mockup/render"


@respx.mock
def test_retries_429_and_succeeds(no_sleep):
    route = respx.get(f"{BASE}/api/designs").mock(
        side_effect=[
            httpx.Response(429, json={"status": "error", "detail": "rate limit exceeded"}, headers={"retry-after": "0"}),
            httpx.Response(429, json={"status": "error", "detail": "rate limit exceeded"}, headers={"retry-after": "0"}),
            httpx.Response(200, json={"status": "ok", "count": 0, "designs": []}),
        ]
    )
    with Client(api_key="cz_test_abc", max_retries=2) as client:
        result = client.designs.list()
    assert result == {"status": "ok", "count": 0, "designs": []}
    assert route.call_count == 3


@respx.mock
def test_gives_up_after_max_retries():
    respx.get(f"{BASE}/api/designs").mock(
        return_value=httpx.Response(429, json={"status": "error", "detail": "rate limit exceeded"}, headers={"retry-after": "0"})
    )
    with Client(api_key="cz_test_abc", max_retries=1) as client:
        with pytest.raises(RateLimitError):
            client.designs.list()


@respx.mock
def test_never_retries_404():
    route = respx.get(f"{BASE}/api/designs").mock(
        return_value=httpx.Response(404, json={"status": "error", "detail": "not found"})
    )
    with Client(api_key="cz_test_abc", max_retries=2) as client:
        with pytest.raises(APIError):
            client.designs.list()
    assert route.call_count == 1


@respx.mock
def test_retries_5xx():
    route = respx.get(f"{BASE}/api/designs").mock(
        side_effect=[
            httpx.Response(500, json={"status": "error", "error": "boom"}),
            httpx.Response(200, json={"status": "ok", "count": 0, "designs": []}),
        ]
    )
    with Client(api_key="cz_test_abc", max_retries=2) as client:
        result = client.designs.list()
    assert result["status"] == "ok"
    assert route.call_count == 2


@respx.mock
def test_designs_create_sync_appends_async_0_query():
    route = respx.post(f"{BASE}/api/design/custom").mock(
        return_value=httpx.Response(200, json={"status": "success", "design_id": "d1", "file_url": "https://x/d.png", "print_ready": True})
    )
    with Client(api_key="cz_test_abc") as client:
        client.designs.create(idea="a logo", sync=True)
    assert route.calls[0].request.url.params["async"] == "0"


@respx.mock
def test_designs_create_default_is_async_no_query():
    route = respx.post(f"{BASE}/api/design/custom").mock(
        return_value=httpx.Response(202, json={"status": "queued", "job_id": "j1", "poll_url": "/api/jobs/j1"})
    )
    with Client(api_key="cz_test_abc") as client:
        client.designs.create(idea="a logo")
    assert "async" not in route.calls[0].request.url.params
