"""
Backend tests for Clann Iteration 2.
Covers: existing regression + new endpoints (whatsapp-toggle, register, registered,
reminder-toggle, reminder-prefs, feedback, admin/feedback), and phone validation.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://clann-upskill.preview.emergentagent.com').rstrip('/')


# ============ Regression: health + events ============
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert "Clann API is running" in r.json().get("message", "")

    def test_list_events(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # seeded events
        # ensure no _id leak
        for e in data:
            assert "_id" not in e
            assert "event_id" in e
            assert "event_date" in e


# ============ Admin auth ============
class TestAdminAuth:
    def test_admin_login_success(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/admin/login",
                            json={"email": "admin@clann.com", "password": "Clann@2026"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_admin_login_wrong_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/admin/login",
                            json={"email": "admin@clann.com", "password": "wrong"})
        assert r.status_code == 401

    def test_admin_stats_requires_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 401

    def test_admin_stats_with_token(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_events" in data
        assert "total_users" in data


# ============ WhatsApp Toggle (auth-only) ============
class TestWhatsAppToggle:
    def test_toggle_unauth_401(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/whatsapp-toggle", json={"enabled": True})
        assert r.status_code == 401

    def test_toggle_enabled_true(self, api_client, auth_headers, seeded_user, mongo_db):
        r = api_client.post(f"{BASE_URL}/api/auth/whatsapp-toggle",
                            json={"enabled": True}, headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body.get("enabled") is True
        u = mongo_db.users.find_one({"user_id": seeded_user["user_id"]})
        assert u.get("whatsapp_reminder_enabled") is True

    def test_toggle_enabled_false(self, api_client, auth_headers, seeded_user, mongo_db):
        r = api_client.post(f"{BASE_URL}/api/auth/whatsapp-toggle",
                            json={"enabled": False}, headers=auth_headers)
        assert r.status_code == 200
        u = mongo_db.users.find_one({"user_id": seeded_user["user_id"]})
        assert u.get("whatsapp_reminder_enabled") is False


# ============ Complete Profile phone validation ============
class TestCompleteProfile:
    def test_complete_profile_without_phone(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/auth/complete-profile",
                            json={"phone": "", "role": "attendee", "whatsapp_reminder_enabled": True},
                            headers=auth_headers)
        assert r.status_code == 400

    def test_complete_profile_with_phone(self, api_client, auth_headers, seeded_user, mongo_db):
        r = api_client.post(f"{BASE_URL}/api/auth/complete-profile",
                            json={"phone": "+91 9876543210", "role": "attendee",
                                  "whatsapp_reminder_enabled": True},
                            headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        u = mongo_db.users.find_one({"user_id": seeded_user["user_id"]})
        assert u["phone"] == "+91 9876543210"
        assert u["profile_complete"] is True
        assert u["whatsapp_reminder_enabled"] is True

    def test_complete_profile_unauth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/complete-profile",
                            json={"phone": "+91 9876543210"})
        assert r.status_code == 401


# ============ Register / Registered (calendar tracking) ============
class TestRegisterEvent:
    def test_register_unauth(self, api_client):
        # Need a valid event_id
        events = api_client.get(f"{BASE_URL}/api/events").json()
        eid = events[0]["event_id"]
        r = api_client.post(f"{BASE_URL}/api/events/{eid}/register")
        assert r.status_code == 401

    def test_register_and_list(self, api_client, auth_headers):
        events = api_client.get(f"{BASE_URL}/api/events").json()
        eid = events[0]["event_id"]
        expected_date = events[0]["event_date"]

        # Register
        r = api_client.post(f"{BASE_URL}/api/events/{eid}/register", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # GET /registered returns event with date
        r = api_client.get(f"{BASE_URL}/api/registered", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        ids = [d["event_id"] for d in data]
        assert eid in ids
        got = next(d for d in data if d["event_id"] == eid)
        assert got["event_date"] == expected_date

    def test_register_idempotent(self, api_client, auth_headers):
        events = api_client.get(f"{BASE_URL}/api/events").json()
        eid = events[0]["event_id"]
        r1 = api_client.post(f"{BASE_URL}/api/events/{eid}/register", headers=auth_headers)
        r2 = api_client.post(f"{BASE_URL}/api/events/{eid}/register", headers=auth_headers)
        assert r1.status_code == 200 and r2.status_code == 200

    def test_register_nonexistent_event(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/events/evt_nonexistent/register", headers=auth_headers)
        assert r.status_code == 404

    def test_registered_unauth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/registered")
        assert r.status_code == 401


# ============ Per-event reminder toggle ============
class TestEventReminderToggle:
    def test_unauth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/events/evt_x/reminder-toggle", json={"enabled": True})
        assert r.status_code == 401

    def test_toggle_on_and_off(self, api_client, auth_headers):
        events = api_client.get(f"{BASE_URL}/api/events").json()
        eid = events[0]["event_id"]

        r = api_client.post(f"{BASE_URL}/api/events/{eid}/reminder-toggle",
                            json={"enabled": True}, headers=auth_headers)
        assert r.status_code == 200

        r = api_client.get(f"{BASE_URL}/api/reminder-prefs", headers=auth_headers)
        assert r.status_code == 200
        assert eid in r.json()

        # Turn off
        r = api_client.post(f"{BASE_URL}/api/events/{eid}/reminder-toggle",
                            json={"enabled": False}, headers=auth_headers)
        assert r.status_code == 200
        r = api_client.get(f"{BASE_URL}/api/reminder-prefs", headers=auth_headers)
        assert eid not in r.json()

    def test_reminder_prefs_unauth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/reminder-prefs")
        assert r.status_code == 401


# ============ Feedback ============
class TestFeedback:
    def test_submit_unauth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/feedback",
                            json={"star_rating": 5, "feedback_text": "Great!"})
        assert r.status_code == 401

    def test_submit_valid(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/feedback",
                            json={"star_rating": 4, "feedback_text": "Nice app"},
                            headers=auth_headers)
        assert r.status_code == 200
        doc = r.json()
        assert doc["star_rating"] == 4
        assert doc["feedback_text"] == "Nice app"
        assert "feedback_id" in doc
        assert "submitted_at" in doc
        assert "_id" not in doc

    def test_rating_out_of_range(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/feedback",
                            json={"star_rating": 6, "feedback_text": "x"},
                            headers=auth_headers)
        assert r.status_code == 400

        r = api_client.post(f"{BASE_URL}/api/feedback",
                            json={"star_rating": 0, "feedback_text": "x"},
                            headers=auth_headers)
        assert r.status_code == 400

    def test_text_clipped_to_300(self, api_client, auth_headers):
        text = "a" * 500
        r = api_client.post(f"{BASE_URL}/api/feedback",
                            json={"star_rating": 3, "feedback_text": text},
                            headers=auth_headers)
        assert r.status_code == 200
        doc = r.json()
        assert len(doc["feedback_text"]) == 300


class TestAdminFeedback:
    def test_admin_feedback_requires_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/admin/feedback")
        assert r.status_code == 401

    def test_admin_feedback_with_token(self, api_client, admin_headers, auth_headers):
        # Ensure at least one feedback exists
        api_client.post(f"{BASE_URL}/api/feedback",
                        json={"star_rating": 5, "feedback_text": "admin-check"},
                        headers=auth_headers)
        r = api_client.get(f"{BASE_URL}/api/admin/feedback", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "_id" not in data[0]
        assert "star_rating" in data[0]
        assert "feedback_text" in data[0]


# ============ Regression: Save/Unsave/Saved list ============
class TestSaveFlow:
    def test_save_flow(self, api_client, auth_headers):
        events = api_client.get(f"{BASE_URL}/api/events").json()
        eid = events[0]["event_id"]

        r = api_client.post(f"{BASE_URL}/api/events/{eid}/save", headers=auth_headers)
        assert r.status_code == 200

        r = api_client.get(f"{BASE_URL}/api/saved", headers=auth_headers)
        assert r.status_code == 200
        ids = [d["event_id"] for d in r.json()]
        assert eid in ids

        r = api_client.delete(f"{BASE_URL}/api/events/{eid}/save", headers=auth_headers)
        assert r.status_code == 200

        r = api_client.get(f"{BASE_URL}/api/saved", headers=auth_headers)
        ids = [d["event_id"] for d in r.json()]
        assert eid not in ids


# ============ Regression: Event CRUD (create with empty external_link) ============
class TestEventCRUD:
    def test_create_event_empty_external_link(self, api_client, admin_headers):
        payload = {
            "title": "TEST_Empty_Link_Event",
            "category": "Workshop",
            "mode": "Offline",
            "short_description": "test",
            "full_description": "test full",
            "image_url": "https://example.com/x.jpg",
            "location": "Test",
            "city": "Delhi",
            "event_date": "2026-06-01",
            "start_time": "10:00",
            "end_time": "12:00",
            "registration_deadline": "2026-05-30",
            "is_paid": False,
            "total_seats": 10,
            "external_link": "",
            "skills": [],
            "recommended_for": [],
            "featured": False,
        }
        r = requests.post(f"{BASE_URL}/api/events", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["external_link"] == ""
        eid = created["event_id"]

        # GET verifies persistence
        r = requests.get(f"{BASE_URL}/api/events/{eid}")
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Empty_Link_Event"

        # DELETE cleanup
        r = requests.delete(f"{BASE_URL}/api/events/{eid}", headers=admin_headers)
        assert r.status_code == 200
