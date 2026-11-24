from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from src import app as app_module


@pytest.fixture
def activity_data(monkeypatch: pytest.MonkeyPatch):
    data = {
        "Test Sports & Arts": {
            "description": "Test activity",
            "schedule": "Monday",
            "max_participants": 10,
            "participants": [
                "student+club@mergington.edu",
                "other@mergington.edu",
            ],
        }
    }
    monkeypatch.setattr(app_module, "activities", data)
    return data


@pytest.fixture
def client(activity_data) -> Iterator[TestClient]:
    with TestClient(app_module.app) as test_client:
        yield test_client
