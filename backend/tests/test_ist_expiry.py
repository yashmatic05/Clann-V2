"""
IST expiry tests — the public event list must expire events in India time.

`datetime.utcnow()` is 5h30m behind Asia/Kolkata, so an event happening today
used to disappear from the public list at 18:30 IST instead of at midnight.
These tests pin the conversion AND the query the public endpoint actually
issues, with the database replaced by an in-memory fake (no network, no Mongo).

The admin path is unchanged on purpose: an authenticated admin keeps seeing
events that have already happened.
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "ist_expiry_unit_db")
os.environ.setdefault("ADMIN_EMAIL", "admin@clann.com")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$notarealhashnotarealhashnota")
os.environ.setdefault("ADMIN_TOKEN_SECRET", "ist-expiry-unit-test-secret-0123456789")

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

import server as app_module


EVENTS = [
    {"event_id": "past", "title": "Yesterday", "event_date": "2026-10-21", "category": "Workshop"},
    {"event_id": "today", "title": "Today", "event_date": "2026-10-22", "category": "Workshop"},
    {"event_id": "later", "title": "Later", "event_date": "2026-11-05", "category": "Workshop"},
]


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _limit):
        return list(self._docs)


class FakeEvents:
    """Minimal stand-in for a Motor collection: records the query, filters on
    the one operator list_events actually uses (`event_date` `$gte`)."""

    def __init__(self, docs):
        self.docs = docs
        self.queries = []

    def find(self, query, _projection=None):
        self.queries.append(query)
        cutoff = (query.get("event_date") or {}).get("$gte")
        if cutoff is None:
            return FakeCursor(self.docs)
        return FakeCursor([d for d in self.docs if d["event_date"] >= cutoff])

    async def distinct(self, _field):
        return []


class FakeDb:
    def __init__(self, docs):
        self.events = FakeEvents(docs)


@pytest.fixture()
def client():
    # No `with`: startup/lifespan (Mongo seeding) is deliberately never run.
    return TestClient(app_module.app)


@pytest.fixture()
def fake_db(monkeypatch):
    db = FakeDb([dict(e) for e in EVENTS])
    monkeypatch.setattr(app_module, "db", db)
    return db


@pytest.fixture()
def frozen_at_0130_ist(monkeypatch):
    """Freeze the clock at 2026-10-21 20:00 UTC == 01:30 IST on 22 Oct.

    `today_ist` itself is NOT stubbed — only the instant it is asked about — so
    the timezone conversion under test is the real one.
    """
    instant = datetime(2026, 10, 21, 20, 0, tzinfo=timezone.utc)
    real = app_module.today_ist
    monkeypatch.setattr(app_module, "today_ist", lambda now=None: real(instant))
    return instant


def test_today_ist_converts_utc_to_india_time():
    real = app_module.today_ist
    assert real(datetime(2026, 10, 21, 20, 0, tzinfo=timezone.utc)) == "2026-10-22"
    assert real(datetime(2026, 10, 21, 18, 29, tzinfo=timezone.utc)) == "2026-10-21"
    assert real(datetime(2026, 10, 21, 18, 31, tzinfo=timezone.utc)) == "2026-10-22"


def test_public_list_excludes_yesterday_and_includes_today(client, fake_db, frozen_at_0130_ist):
    resp = client.get("/api/events")
    assert resp.status_code == 200
    ids = [e["event_id"] for e in resp.json()]
    # 2026-10-21 is yesterday in India at 01:30 on the 22nd, even though UTC
    # still says the 21st.
    assert "past" not in ids
    assert ids == ["today", "later"]


def test_public_cutoff_is_the_india_date(client, fake_db, frozen_at_0130_ist):
    client.get("/api/events")
    query = fake_db.events.queries[0]
    assert query["event_date"] == {"$gte": "2026-10-22"}


def test_public_cutoff_would_have_been_wrong_in_utc(client, fake_db, frozen_at_0130_ist):
    """The old code used utcnow(), which at this instant is still 2026-10-21."""
    assert frozen_at_0130_ist.strftime("%Y-%m-%d") == "2026-10-21"
    client.get("/api/events")
    assert fake_db.events.queries[0]["event_date"]["$gte"] != "2026-10-21"


def test_admin_requests_are_unchanged(client, fake_db, frozen_at_0130_ist):
    headers = {"X-Admin-Token": app_module.create_admin_token()}
    resp = client.get("/api/events", headers=headers)
    assert resp.status_code == 200
    ids = [e["event_id"] for e in resp.json()]
    assert ids == ["past", "today", "later"]  # an admin still sees everything
    assert "event_date" not in fake_db.events.queries[0]


def test_no_utcnow_left_in_the_events_listing():
    """Guard against the cutoff drifting back to UTC. Comments are ignored --
    the docstring above deliberately names the call it replaced."""
    source = (BACKEND_DIR / "server.py").read_text(encoding="utf-8")
    code = "\n".join(
        line for line in source.splitlines() if not line.strip().startswith("#")
    )
    assert "datetime.utcnow()" not in code
