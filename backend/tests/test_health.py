"""Isolated tests for GET /api/health (process liveness only).

These tests import the FastAPI app directly and disable startup/shutdown
hooks so they do not require a live MongoDB or a deployed backend.
"""
import ast
import inspect
import os
import sys
from pathlib import Path
# Required before importing server.py (it reads these at module load).
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "clann_health_test")
os.environ.setdefault("ADMIN_EMAIL", "admin@example.com")
os.environ.setdefault(
    "ADMIN_PASSWORD_HASH",
    "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8K5Y4La",
)
os.environ.setdefault("ADMIN_TOKEN_SECRET", "test-secret-for-health-endpoint-only")

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402
from server import app, db, health  # noqa: E402

# Health must work even if Mongo is down; do not run seed/repair on startup.
app.router.on_startup.clear()
app.router.on_shutdown.clear()


def _client():
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_200_and_status_ok(self):
        r = _client().get("/api/health")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/json")
        assert r.json() == {"status": "ok"}

    def test_health_does_not_require_auth_headers_or_cookies(self):
        client = _client()
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

        r = client.get("/api/health", headers={"Authorization": "Bearer not-a-real-token"})
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

        client.cookies.set("session_token", "not-a-real-cookie")
        r = client.get("/api/health", headers={"X-Admin-Token": "not-a-real-admin"})
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_health_does_not_call_mongodb(self):
        original_getattr = db.__getattr__

        def _blocked_getattr(key):
            raise AssertionError(f"MongoDB collection accessed via db.{key}")

        db.__getattr__ = _blocked_getattr
        try:
            r = _client().get("/api/health")
            assert r.status_code == 200
            assert r.json() == {"status": "ok"}
        finally:
            db.__getattr__ = original_getattr

    def test_health_handler_source_has_no_database_access(self):
        source = inspect.getsource(health)
        tree = ast.parse(source)
        called_names = {
            node.func.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        attribute_roots = {
            node.value.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name)
        }
        forbidden = {"db", "client", "mongo_url"}
        assert not (called_names & forbidden)
        assert not (attribute_roots & forbidden)
        names = {
            node.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Name)
        }
        assert "db" not in names
        assert "client" not in names
        assert "mongo_url" not in names

    def test_health_only_allows_get(self):
        r = _client().post("/api/health")
        assert r.status_code == 405

    def test_health_appears_in_openapi(self):
        r = _client().get("/openapi.json")
        assert r.status_code == 200
        spec = r.json()
        assert "/api/health" in spec["paths"]
        assert "get" in spec["paths"]["/api/health"]
        assert "post" not in spec["paths"]["/api/health"]

    def test_existing_root_and_events_routes_still_registered(self):
        r = _client().get("/openapi.json")
        spec = r.json()
        assert spec["paths"]["/api/"]["get"]
        assert spec["paths"]["/api/events"]["get"]
        assert spec["paths"]["/api/events"]["post"]
        assert spec["paths"]["/api/events/{event_id}"]["get"]
