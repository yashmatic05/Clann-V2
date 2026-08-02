import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://clann-upskill.preview.emergentagent.com').rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@clann.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Clann@2026')


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Content-Type": "application/json", "X-Admin-Token": admin_token}


@pytest.fixture(scope="session")
def seeded_user(mongo_db):
    """Create a test user + session directly in Mongo. Returns dict with user_id/session_token."""
    user_id = f"TEST_user_{uuid.uuid4().hex[:10]}"
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    session_token = f"TEST_sess_{uuid.uuid4().hex[:16]}"
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "Test User",
        "picture": "",
        "role": "attendee",
        "phone": "",
        "city": "Delhi",
        "profile_complete": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    yield {"user_id": user_id, "email": email, "session_token": session_token}
    # cleanup
    mongo_db.users.delete_many({"user_id": user_id})
    mongo_db.user_sessions.delete_many({"user_id": user_id})
    mongo_db.saved_events.delete_many({"user_id": user_id})
    mongo_db.registered_events.delete_many({"user_id": user_id})
    mongo_db.event_reminders.delete_many({"user_id": user_id})
    mongo_db.feedback.delete_many({"user_id": user_id})


@pytest.fixture(scope="session")
def auth_headers(seeded_user):
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {seeded_user['session_token']}",
    }
