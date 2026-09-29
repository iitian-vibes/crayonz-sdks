from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any, Optional

from .._exceptions import CrayonzError

if TYPE_CHECKING:
    from .._client import _Transport


class JobsResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def get(self, job_id: str) -> dict:
        """Poll a design-pipeline job (returned as job_id by e.g. designs.create)."""
        if not job_id:
            raise ValueError("job_id is required")
        return self._transport.request("GET", f"/api/jobs/{job_id}")

    def wait(self, job_id: str, *, timeout: float = 300.0, interval: float = 3.0) -> dict:
        """Poll a job until it reaches a terminal state. Returns the job dict
        (job["result"] holds the endpoint's normal synchronous response
        shape). Raises CrayonzError if the job fails/cancels, or if it
        doesn't finish within ``timeout`` seconds."""
        deadline = time.monotonic() + timeout
        endpoint = f"/api/jobs/{job_id}"

        while True:
            job = self.get(job_id)["job"]
            status = job.get("status")

            if status == "completed":
                return job
            if status in ("failed", "cancelled"):
                raise CrayonzError(
                    job.get("last_error") or f"Job {job_id} {status}",
                    status=0,
                    body=job,
                    endpoint=endpoint,
                )
            if time.monotonic() >= deadline:
                raise CrayonzError(
                    f"Job {job_id} did not reach a terminal state within {timeout}s (last status: {status})",
                    status=0,
                    body=job,
                    endpoint=endpoint,
                )
            time.sleep(interval)
