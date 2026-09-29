import pytest


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    """Every test runs with time.sleep patched out (retry/poll backoff would
    otherwise make the suite slow). Individual tests can still assert sleep
    was called via the call count on this fixture's target if needed."""
    calls = []

    def fake_sleep(seconds):
        calls.append(seconds)

    monkeypatch.setattr("crayonz._client.time.sleep", fake_sleep)
    monkeypatch.setattr("crayonz.resources.jobs.time.sleep", fake_sleep)
    monkeypatch.setattr("crayonz.resources.tasks.time.sleep", fake_sleep)
    return calls
