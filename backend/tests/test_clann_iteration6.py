"""
Backend tests for Clann Iteration 6.

Focus:
- /api/auth/me returns FULL user document (phone / city / role / whatsapp_reminder_enabled)
  after login/refresh. Verifies the seeded profile is not overwritten and that the
  route no longer returns a stripped-down user.
- Regression: admin login, events CRUD, saved / registered flows, feedback and
  reminder-prefs still work end-to-end.
"""
import os
import uuid
import requests
import pytest
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get(
    'REACT_APP_BACKEND_URL', 'https://clann-upskill.preview.emergentagent.com'
).rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


# ============ Iteration 6 primary bug fix ============
class TestAuthMeReturnsFullUser:
    """/api/auth/me must return phone/city/role/whatsapp_reminder_enabled after seed."""

    def _seed_user(self, mongo, phone="+91 9876543210", city="Delhi", role="attendee"):
        user_id = f"TEST_user_{uuid.uuid4().hex[:10]}"
        email = f"TEST_iter6_{uuid.uuid4().hex[:8]}@example.com"
        session_token = f"TEST_sess_{uuid.uuid4().hex[:16]}"
        mongo.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": "Iter6 Test User",
            "picture": "",
            "role": role,
            "phone": phone,
            "city": city,
            "org_name": "",
            "event_types": [],
            "instagram": "",
            "whatsapp_reminder_enabled": True,
            "profile_complete": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        mongo.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
        })
        return {"user_id": user_id, "email": email, "session_token": session_token,
                "phone": phone, "city": city, "role": role}

    def _cleanup(self, mongo, user_id):
        mongo.users.delete_many({"user_id": user_id})
        mongo.user_sessions.delete_many({"user_id": user_id})

    def test_me_returns_phone_city_role(self, api_client, mongo_db):
        u = self._seed_user(mongo_db, phone="+91 9876543210", city="Delhi", role="attendee")
        try:
            r = api_client.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {u['session_token']}"},
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["email"] == u["email"]
            assert data["phone"] == "+91 9876543210", f"expected phone, got: {data}"
            assert data["city"] == "Delhi"
            assert data["role"] == "attendee"
            assert data.get("whatsapp_reminder_enabled") is True
            assert "_id" not in data
        finally:
            self._cleanup(mongo_db, u["user_id"])

    def test_me_returns_organizer_fields(self, api_client, mongo_db):
        u = self._seed_user(mongo_db, phone="+91 8888888888", city="Mumbai", role="organizer")
        try:
            r = api_client.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {u['session_token']}"},
            )
            assert r.status_code == 200
            data = r.json()
            assert data["role"] == "organizer"
            assert data["phone"] == "+91 8888888888"
            assert data["city"] == "Mumbai"
            # Organizer-specific fields exist (even if empty)
            assert "org_name" in data
            assert "event_types" in data
        finally:
            self._cleanup(mongo_db, u["user_id"])

    def test_me_401_without_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_401_with_bad_token(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer TEST_definitely_not_a_real_token"},
        )
        assert r.status_code == 401

    def test_me_401_when_session_expired(self, api_client, mongo_db):
        user_id = f"TEST_user_{uuid.uuid4().hex[:10]}"
        session_token = f"TEST_expired_{uuid.uuid4().hex[:12]}"
        mongo_db.users.insert_one({"user_id": user_id, "email": f"TEST_{uuid.uuid4().hex[:6]}@x.com"})
        mongo_db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": datetime.now(timezone.utc) - timedelta(days=1),
            "created_at": datetime.now(timezone.utc) - timedelta(days=8),
        })
        try:
            r = api_client.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {session_token}"},
            )
            assert r.status_code == 401
        finally:
            mongo_db.users.delete_many({"user_id": user_id})
            mongo_db.user_sessions.delete_many({"user_id": user_id})


# ============ Regression: admin + events CRUD ============
class TestAdminEventCRUDRegression:
    def _payload(self, suffix=""):
        return {
            "title": f"TEST_iter6_{suffix or uuid.uuid4().hex[:6]}",
            "category": "Workshop",
            "mode": "Offline",
            "short_description": "Iter6 regression event",
            "full_description": "Regression check for CRUD",
            "image_url": "https://example.com/iter6.jpg",
            "location": "Delhi",
            "city": "Delhi",
            "event_date": "2026-08-01",
            "start_time": "10:00",
            "end_time": "13:00",
            "registration_deadline": "2026-07-28",
            "is_paid": False,
            "total_seats": 20,
            "external_link": "https://example.com/register-iter6",
            "skills": ["Design"],
            "recommended_for": ["Students"],
            "featured": False,
            "is_government": False,
        }

    def test_admin_login(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/admin/login",
            json={"email": "admin@clann.com", "password": "Clann@2026"},
        )
        assert r.status_code == 200
        assert r.json().get("token")

    def test_create_get_update_delete(self, api_client, admin_headers):
        # CREATE
        created = api_client.post(
            f"{BASE_URL}/api/events", json=self._payload("crud"), headers=admin_headers
        )
        assert created.status_code == 200, created.text
        eid = created.json()["event_id"]

        # GET
        g = api_client.get(f"{BASE_URL}/api/events/{eid}")
        assert g.status_code == 200
        assert g.json()["event_date"] == "2026-08-01"

        # UPDATE
        u = api_client.put(
            f"{BASE_URL}/api/events/{eid}",
            json={"title": "TEST_iter6_updated"},
            headers=admin_headers,
        )
        assert u.status_code == 200
        assert u.json()["title"] == "TEST_iter6_updated"

        # persistence
        g2 = api_client.get(f"{BASE_URL}/api/events/{eid}")
        assert g2.json()["title"] == "TEST_iter6_updated"

        # DELETE
        d = api_client.delete(f"{BASE_URL}/api/events/{eid}", headers=admin_headers)
        assert d.status_code == 200

        # verify removed
        g3 = api_client.get(f"{BASE_URL}/api/events/{eid}")
        assert g3.status_code == 404

    def test_list_sorted_by_date_asc(self, api_client, admin_headers):
        # Create two events, later date first, earlier date second — API must sort asc.
        a = self._payload("sortA"); a["event_date"] = "2027-01-15"
        b = self._payload("sortB"); b["event_date"] = "2026-01-15"
        ra = api_client.post(f"{BASE_URL}/api/events", json=a, headers=admin_headers).json()
        rb = api_client.post(f"{BASE_URL}/api/events", json=b, headers=admin_headers).json()
        try:
            r = api_client.get(f"{BASE_URL}/api/events")
            assert r.status_code == 200
            data = r.json()
            idx_a = next(i for i, e in enumerate(data) if e["event_id"] == ra["event_id"])
            idx_b = next(i for i, e in enumerate(data) if e["event_id"] == rb["event_id"])
            assert idx_b < idx_a, "events should be sorted by event_date ascending"
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{ra['event_id']}", headers=admin_headers)
            api_client.delete(f"{BASE_URL}/api/events/{rb['event_id']}", headers=admin_headers)

    def test_no_mongo_id_in_public_responses(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        for e in r.json():
            assert "_id" not in e


# ============ Regression: saved / registered / reminder-prefs / feedback ============
class TestAuthedFlows:
    """Uses the shared `seeded_user` fixture from conftest."""

    def _make_event(self, api_client, admin_headers, suffix="authflow"):
        payload = {
            "title": f"TEST_iter6_{suffix}_{uuid.uuid4().hex[:6]}",
            "category": "Workshop", "mode": "Offline",
            "short_description": "auth flow regression",
            "full_description": "auth flow regression",
            "image_url": "https://example.com/x.jpg",
            "location": "Delhi", "city": "Delhi",
            "event_date": "2026-09-10", "start_time": "10:00", "end_time": "13:00",
            "registration_deadline": "2026-09-05",
            "is_paid": False, "total_seats": 5,
            "external_link": "https://example.com/register",
            "skills": [], "recommended_for": [],
            "featured": False, "is_government": False,
        }
        r = api_client.post(f"{BASE_URL}/api/events", json=payload, headers=admin_headers)
        assert r.status_code == 200
        return r.json()["event_id"]

    def test_save_and_unsave(self, api_client, admin_headers, auth_headers):
        eid = self._make_event(api_client, admin_headers, "save")
        try:
            r = api_client.post(f"{BASE_URL}/api/events/{eid}/save", headers=auth_headers)
            assert r.status_code == 200
            saved = api_client.get(f"{BASE_URL}/api/saved", headers=auth_headers).json()
            assert any(e["event_id"] == eid for e in saved)

            r2 = api_client.delete(f"{BASE_URL}/api/events/{eid}/save", headers=auth_headers)
            assert r2.status_code == 200
            saved2 = api_client.get(f"{BASE_URL}/api/saved", headers=auth_headers).json()
            assert not any(e["event_id"] == eid for e in saved2)
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{eid}", headers=admin_headers)

    def test_register_and_reminder_prefs(self, api_client, admin_headers, auth_headers):
        eid = self._make_event(api_client, admin_headers, "reg")
        try:
            r = api_client.post(f"{BASE_URL}/api/events/{eid}/register", headers=auth_headers)
            assert r.status_code == 200
            regs = api_client.get(f"{BASE_URL}/api/registered", headers=auth_headers).json()
            assert any(e["event_id"] == eid for e in regs)

            r2 = api_client.post(
                f"{BASE_URL}/api/events/{eid}/reminder-toggle",
                json={"enabled": True}, headers=auth_headers,
            )
            assert r2.status_code == 200
            prefs = api_client.get(f"{BASE_URL}/api/reminder-prefs", headers=auth_headers).json()
            assert eid in prefs

            r3 = api_client.post(
                f"{BASE_URL}/api/events/{eid}/reminder-toggle",
                json={"enabled": False}, headers=auth_headers,
            )
            assert r3.status_code == 200
            prefs2 = api_client.get(f"{BASE_URL}/api/reminder-prefs", headers=auth_headers).json()
            assert eid not in prefs2
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{eid}", headers=admin_headers)

    def test_whatsapp_toggle_updates_user(self, api_client, auth_headers, seeded_user, mongo_db):
        r = api_client.post(
            f"{BASE_URL}/api/auth/whatsapp-toggle",
            json={"enabled": False}, headers=auth_headers,
        )
        assert r.status_code == 200
        assert r.json()["enabled"] is False

        me = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers).json()
        assert me["whatsapp_reminder_enabled"] is False

        # flip back
        api_client.post(
            f"{BASE_URL}/api/auth/whatsapp-toggle",
            json={"enabled": True}, headers=auth_headers,
        )
        me2 = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers).json()
        assert me2["whatsapp_reminder_enabled"] is True

    def test_feedback_submit(self, api_client, admin_headers, auth_headers):
        r = api_client.post(
            f"{BASE_URL}/api/feedback",
            json={"star_rating": 5, "feedback_text": "TEST_iter6 feedback"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        fb_id = r.json()["feedback_id"]

        # admin can list it
        listing = api_client.get(f"{BASE_URL}/api/admin/feedback", headers=admin_headers).json()
        assert any(f["feedback_id"] == fb_id for f in listing)

    def test_complete_profile_updates_phone(self, api_client, auth_headers, mongo_db, seeded_user):
        r = api_client.post(
            f"{BASE_URL}/api/auth/complete-profile",
            json={"phone": "+91 7777000011", "city": "Bangalore", "role": "attendee",
                  "whatsapp_reminder_enabled": True},
            headers=auth_headers,
        )
        assert r.status_code == 200
        me = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers).json()
        assert me["phone"] == "+91 7777000011"
        assert me["city"] == "Bangalore"


# ============ Regression: government filter still works ============
class TestGovernmentFilterRegression:
    def test_filter_true_and_false(self, api_client, admin_headers):
        pay = {
            "title": f"TEST_iter6_gov_{uuid.uuid4().hex[:5]}",
            "category": "Workshop", "mode": "Offline",
            "short_description": "gov", "full_description": "gov",
            "image_url": "https://example.com/g.jpg",
            "location": "Delhi", "city": "Delhi",
            "event_date": "2026-10-05", "start_time": "10:00", "end_time": "13:00",
            "registration_deadline": "2026-10-01",
            "is_paid": False, "total_seats": 10,
            "external_link": "https://example.com/reg-gov",
            "skills": [], "recommended_for": [],
            "featured": False, "is_government": True,
        }
        gov = api_client.post(f"{BASE_URL}/api/events", json=pay, headers=admin_headers).json()
        try:
            r = api_client.get(f"{BASE_URL}/api/events", params={"is_government": "true"})
            assert r.status_code == 200
            assert any(e["event_id"] == gov["event_id"] for e in r.json())
            for e in r.json():
                assert e.get("is_government") is True

            r2 = api_client.get(f"{BASE_URL}/api/events", params={"is_government": "false"})
            assert all(e["event_id"] != gov["event_id"] for e in r2.json())
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{gov['event_id']}", headers=admin_headers)
