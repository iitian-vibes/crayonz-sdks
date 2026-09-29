import httpx
import pytest
import respx

from crayonz import Client, CrayonzError

BASE = "https://api.crayonz.ai"


@respx.mock
def test_jobs_wait_polls_until_completed(no_sleep):
    respx.get(f"{BASE}/api/jobs/j1").mock(
        side_effect=[
            httpx.Response(200, json={"status": "ok", "job": {"id": "j1", "job_type": "design.custom", "status": "queued", "progress_pct": 10}}),
            httpx.Response(200, json={"status": "ok", "job": {"id": "j1", "job_type": "design.custom", "status": "running", "progress_pct": 60}}),
            httpx.Response(
                200,
                json={
                    "status": "ok",
                    "job": {
                        "id": "j1",
                        "job_type": "design.custom",
                        "status": "completed",
                        "progress_pct": 100,
                        "result": {"status": "success", "design_id": "d1", "file_url": "https://x/d.png", "print_ready": True},
                    },
                },
            ),
        ]
    )
    with Client(api_key="cz_test_abc") as client:
        job = client.jobs.wait("j1", interval=0.01)
    assert job["status"] == "completed"
    assert job["result"]["file_url"] == "https://x/d.png"


@respx.mock
def test_jobs_wait_raises_on_failure():
    respx.get(f"{BASE}/api/jobs/j1").mock(
        return_value=httpx.Response(200, json={"status": "ok", "job": {"id": "j1", "job_type": "design.custom", "status": "failed", "last_error": "model timeout"}})
    )
    with Client(api_key="cz_test_abc") as client:
        with pytest.raises(CrayonzError, match="model timeout"):
            client.jobs.wait("j1", interval=0.01)


@respx.mock
def test_jobs_wait_times_out():
    respx.get(f"{BASE}/api/jobs/j1").mock(
        return_value=httpx.Response(200, json={"status": "ok", "job": {"id": "j1", "job_type": "design.custom", "status": "running"}})
    )
    with Client(api_key="cz_test_abc") as client:
        with pytest.raises(CrayonzError, match="did not reach a terminal state"):
            client.jobs.wait("j1", interval=0.01, timeout=0.03)


@respx.mock
def test_designs_create_and_wait():
    respx.post(f"{BASE}/api/design/custom").mock(
        return_value=httpx.Response(202, json={"status": "queued", "job_id": "j1", "poll_url": "/api/jobs/j1"})
    )
    respx.get(f"{BASE}/api/jobs/j1").mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "ok",
                "job": {
                    "id": "j1",
                    "job_type": "design.custom",
                    "status": "completed",
                    "result": {"status": "success", "design_id": "d1", "file_url": "https://x/d.png", "print_ready": True},
                },
            },
        )
    )
    with Client(api_key="cz_test_abc") as client:
        design = client.designs.create_and_wait(idea="skate logo", interval=0.01)
    assert design["design_id"] == "d1"
    assert design["file_url"] == "https://x/d.png"


@respx.mock
def test_tasks_wait_polls_until_completed():
    respx.get(f"{BASE}/v1/tasks/t1").mock(
        side_effect=[
            httpx.Response(200, json={"taskId": "t1", "status": "processing"}),
            httpx.Response(200, json={"taskId": "t1", "status": "completed", "resultImage": "https://x/result.jpg"}),
        ]
    )
    with Client(api_key="cz_test_abc") as client:
        task = client.tasks.wait("t1", interval=0.01)
    assert task["status"] == "completed"
    assert task["resultImage"] == "https://x/result.jpg"


@respx.mock
def test_tasks_wait_raises_on_failure():
    respx.get(f"{BASE}/v1/tasks/t1").mock(
        return_value=httpx.Response(200, json={"taskId": "t1", "status": "failed", "error": "no face detected"})
    )
    with Client(api_key="cz_test_abc") as client:
        with pytest.raises(CrayonzError, match="no face detected"):
            client.tasks.wait("t1", interval=0.01)


@respx.mock
def test_mockups_render():
    route = respx.post(f"{BASE}/api/mockup/render").mock(
        return_value=httpx.Response(200, json={"status": "success", "mockup_url": "https://x/m.png", "garment": "tshirt", "color": {"name": "Black", "hex": "#1A1A1A"}, "view": "front", "credits_charged": 10})
    )
    with Client(api_key="cz_test_abc") as client:
        result = client.mockups.render(design_url="https://x/d.png", garment="tshirt")
    assert result["credits_charged"] == 10
    import json
    assert json.loads(route.calls[0].request.content) == {"design_url": "https://x/d.png", "garment": "tshirt"}


@respx.mock
def test_quality_score():
    respx.post(f"{BASE}/api/quality/score").mock(
        return_value=httpx.Response(200, json={"status": "scored", "recommendation": "approve", "scores": {}, "issues": [], "strengths": [], "scored_at": "now"})
    )
    with Client(api_key="cz_test_abc") as client:
        result = client.quality.score(image_url="https://x/d.png", design_brief="a logo")
    assert result["recommendation"] == "approve"


@respx.mock
def test_photoshoots_model_product_recommend_vibes():
    respx.post(f"{BASE}/api/photoshoot/v3/generate").mock(return_value=httpx.Response(200, json={"shots": [], "requested": 1, "succeeded": 0, "model_used": "x"}))
    respx.post(f"{BASE}/api/photoshoot/v3/generate-product").mock(return_value=httpx.Response(200, json={"shots": [], "model_used": "x"}))
    respx.post(f"{BASE}/api/photoshoot/recommend-vibes").mock(return_value=httpx.Response(200, json={"recommendations": [], "model_used": "x"}))
    with Client(api_key="cz_test_abc") as client:
        client.photoshoots.model(design_reference_url="https://x/d.png")
        client.photoshoots.product(compositor_flatlay_url="https://x/m.png", shot_types=["packshot_white"])
        client.photoshoots.recommend_vibes(title="A logo")


@respx.mock
def test_try_on_create_and_variations():
    respx.post(f"{BASE}/v1/try-on").mock(return_value=httpx.Response(202, json={"taskId": "t1", "status": "queued"}))
    respx.post(f"{BASE}/v1/try-on/variations").mock(return_value=httpx.Response(202, json={"taskId": "t2", "status": "queued"}))
    with Client(api_key="cz_test_abc") as client:
        r1 = client.try_on.create(user_photo="a", product_image="b")
        r2 = client.try_on.variations(user_photo="a", product_image="b")
    assert r1["taskId"] == "t1"
    assert r2["taskId"] == "t2"


@respx.mock
def test_sizing_recommend():
    route = respx.post(f"{BASE}/v1/size-recommendation").mock(return_value=httpx.Response(200, json={"recommendedSize": "M", "reasoning": "x"}))
    with Client(api_key="cz_test_abc") as client:
        result = client.sizing.recommend(image="https://x/tee.png", size_chart="S:36 M:40")
    assert result["recommendedSize"] == "M"
    import json
    assert json.loads(route.calls[0].request.content)["sizeChart"] == "S:36 M:40"


@respx.mock
def test_outfits_complete():
    respx.post(f"{BASE}/v1/complete-outfit").mock(return_value=httpx.Response(200, json={"outfits": [], "summary": "x"}))
    with Client(api_key="cz_test_abc") as client:
        client.outfits.complete(product_images=["https://x/tee.png"])


@respx.mock
def test_designs_list_and_get():
    respx.get(f"{BASE}/api/designs").mock(return_value=httpx.Response(200, json={"status": "ok", "count": 0, "designs": []}))
    respx.get(f"{BASE}/api/designs/d1").mock(return_value=httpx.Response(200, json={"status": "ok", "design": {"id": "d1", "file_url": "https://x/d.png", "created_at": "now"}}))
    with Client(api_key="cz_test_abc") as client:
        client.designs.list(tag="project=launch", limit=10)
        design = client.designs.get("d1")
    assert design["design"]["id"] == "d1"


def test_network_error_wrapped():
    def raising_transport(request):
        raise httpx.ConnectError("boom", request=request)

    transport = httpx.MockTransport(raising_transport)
    with Client(api_key="cz_test_abc", max_retries=0, http_client=httpx.Client(transport=transport)) as client:
        with pytest.raises(CrayonzError, match="Network error"):
            client.designs.list()
