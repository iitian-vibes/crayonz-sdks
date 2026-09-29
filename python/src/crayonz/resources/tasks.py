from __future__ import annotations

import time
from typing import TYPE_CHECKING

from .._exceptions import CrayonzError

if TYPE_CHECKING:
    from .._client import _Transport


class TasksResource:
    def __init__(self, transport: "_Transport") -> None:
        self._transport = transport

    def get(self, task_id: str) -> dict:
        """Poll a Virtual Try-On task by id (returned as taskId by try_on.create/variations)."""
        if not task_id:
            raise ValueError("task_id is required")
        return self._transport.request("GET", f"/v1/tasks/{task_id}")

    def wait(self, task_id: str, *, timeout: float = 180.0, interval: float = 3.0) -> dict:
        """Poll a task until it completes or fails. Returns the completed task dict."""
        deadline = time.monotonic() + timeout
        endpoint = f"/v1/tasks/{task_id}"

        while True:
            task = self.get(task_id)
            status = task.get("status")

            if status == "completed":
                return task
            if status == "failed":
                raise CrayonzError(
                    task.get("error") or f"Task {task_id} failed", status=0, body=task, endpoint=endpoint
                )
            if time.monotonic() >= deadline:
                raise CrayonzError(
                    f"Task {task_id} did not complete within {timeout}s (last status: {status})",
                    status=0,
                    body=task,
                    endpoint=endpoint,
                )
            time.sleep(interval)
