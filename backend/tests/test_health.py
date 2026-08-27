import pytest
from django.db.utils import OperationalError
from django.urls import reverse


@pytest.mark.django_db
def test_health_returns_ok(client):
    response = client.get(reverse("health"))
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"


def test_health_reports_degraded_when_database_is_down(client, monkeypatch):
    """The `database` key must reflect a real round-trip, not a constant.

    A reviewer checks this by running `docker compose stop db` against a live
    api container; this test pins the same branch so it cannot regress.
    """

    class DeadConnection:
        def cursor(self):
            raise OperationalError("connection refused")

    monkeypatch.setattr("config.health.connections", {"default": DeadConnection()})

    response = client.get(reverse("health"))
    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["database"] == "unavailable"


def test_schema_is_served(client):
    assert client.get("/api/v1/schema/").status_code == 200


def test_docs_are_served(client):
    assert client.get("/api/v1/docs/").status_code == 200
