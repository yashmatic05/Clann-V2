"""
Backend tests for Clann Iteration 7 — Public Organizer Submissions + Admin Approval Queue.

Focus:
- POST /api/submissions — public organizer form, submission lands as `pending`
- GET  /api/submissions/{id}/status — public status lookup gated by email
- GET  /api/admin/submissions — admin queue list + status filters
- POST /api/admin/submissions/{id}/approve — creates a live event (like the admin form)
- POST /api/admin/submissions/{id}/reject — marks rejected with optional reason
- DELETE /api/admin/submissions/{id} — permanent removal
- Regression: admin login + /admin/stats (now includes pending_submissions).

All rows created here are TEST-prefixed and cleaned up in finally blocks.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get(
    'REACT_APP_BACKEND_URL', 'https://clann-upskill.preview.emergentagent.com'
).rstrip('/')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


class TestOrganizerSubmissions:
    """Public submission form + status lookup."""

    def _payload(self, title=None):
        return {
            "organizer_name": "Iter7 Organizer",
            "organizer_email": f"TEST_iter7_{uuid.uuid4().hex[:8]}@example.com",
            "organizer_phone": "+91 9999999999",
            "title": title or f"TEST_iter7 Submission {uuid.uuid4().hex[:6]}",
            "category": "Workshop",
            "mode": "Offline",
            "short_description": "Iteration 7 smoke submission.",
            "full_description": "Full description for the iteration 7 smoke submission.",
            "image_url": "https://example.com/event-banner.jpg",
            "location": "Connaught Place, New Delhi",
            "city": "Delhi",
            "event_date": "2027-01-15",
            "start_time": "10:00",
            "end_time": "13:00",
            "registration_deadline": "2027-01-10",
            "is_paid": False,
            "price": None,
            "total_seats": 25,
            "external_link": "https://example.com/register-iter7",
            "notes": "Smoke test",
        }

    def test_submit_creates_pending_submission(self, api_client, mongo_db):
        payload = self._payload()
        r = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
        assert r.status_code == 200, r.text
        sub = r.json()
        sid = sub["submission_id"]
        try:
            assert sid.startswith("sub_")
            assert sub["status"] == "pending"
            assert sub["organizer_email"] == payload["organizer_email"].lower()
            assert "_id" not in sub
            assert sub["title"] == payload["title"]
        finally:
            mongo_db.submissions.delete_many({"submission_id": sid})

    def test_status_lookup_gated_by_email(self, api_client, mongo_db):
        payload = self._payload()
        r = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
        sid = r.json()["submission_id"]
        try:
            # wrong email -> 404 (never leaks)
            r2 = api_client.get(
                f"{BASE_URL}/api/submissions/{sid}/status",
                params={"email": "nobody@example.com"},
            )
            assert r2.status_code == 404
            # correct email -> 200 with status
            r3 = api_client.get(
                f"{BASE_URL}/api/submissions/{sid}/status",
                params={"email": payload["organizer_email"]},
            )
            assert r3.status_code == 200, r3.text
            data = r3.json()
            assert data["submission_id"] == sid
            assert data["status"] == "pending"
            assert data["title"] == payload["title"]
            # missing submission -> 404
            r4 = api_client.get(
                f"{BASE_URL}/api/submissions/sub_doesnotexist/status",
                params={"email": payload["organizer_email"]},
            )
            assert r4.status_code == 404
        finally:
            mongo_db.submissions.delete_many({"submission_id": sid})

    def test_validation_rejects_bad_input(self, api_client):
        # event_date must be YYYY-MM-DD
        r = api_client.post(
            f"{BASE_URL}/api/submissions",
            json={**self._payload(), "event_date": "15/01/2027"},
        )
        assert r.status_code == 400, r.text
        # missing required fields -> 422 (pydantic min_length / EmailStr)
        r = api_client.post(f"{BASE_URL}/api/submissions", json={"title": "x"})
        assert r.status_code == 422, r.text


class TestAdminApprovalQueue:
    """Admin-side queue: list, approve (publishes event), reject, delete."""

    def _payload(self, title=None):
        return {
            "organizer_name": "Iter7 Organizer",
            "organizer_email": f"TEST_iter7_{uuid.uuid4().hex[:8]}@example.com",
            "organizer_phone": "+91 9999999999",
            "title": title or f"TEST_iter7 AdminFlow {uuid.uuid4().hex[:6]}",
            "category": "Meetup",
            "mode": "Online",
            "short_description": "Iteration 7 admin-flow smoke submission.",
            "full_description": "Full description.",
            "image_url": "https://example.com/event-banner.jpg",
            "location": "Online",
            "city": "Delhi",
            "event_date": "2027-02-20",
            "start_time": "18:00",
            "end_time": "20:00",
            "registration_deadline": "2027-02-18",
            "is_paid": True,
            "price": "₹199",
            "total_seats": 50,
            "external_link": "https://example.com/register-iter7-admin",
            "notes": "",
        }

    def test_queue_requires_admin(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/admin/submissions")
        assert r.status_code == 401

    def test_list_filters_by_status(self, api_client, admin_headers, mongo_db):
        payload = self._payload()
        r = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
        assert r.status_code == 200, r.text
        sid = r.json()["submission_id"]
        try:
            r1 = api_client.get(f"{BASE_URL}/api/admin/submissions", headers=admin_headers)
            assert r1.status_code == 200, r1.text
            assert any(s["submission_id"] == sid for s in r1.json())

            r2 = api_client.get(
                f"{BASE_URL}/api/admin/submissions?status=pending", headers=admin_headers
            )
            assert all(s["status"] == "pending" for s in r2.json())
            assert any(s["submission_id"] == sid for s in r2.json())
        finally:
            mongo_db.submissions.delete_many({"submission_id": sid})

    def test_approve_publishes_event(self, api_client, admin_headers, mongo_db):
        payload = self._payload()
        r = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
        assert r.status_code == 200, r.text
        sid = r.json()["submission_id"]
        created_event_id = None
        try:
            r = api_client.post(
                f"{BASE_URL}/api/admin/submissions/{sid}/approve", headers=admin_headers
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["status"] == "approved"
            event = data["event"]
            created_event_id = event["event_id"]
            assert event["title"] == payload["title"]
            assert event["clann_event_id"].startswith("CLN-")
            assert len(event.get("skills", [])) > 0  # auto tags
            assert event.get("seats_left") == payload["total_seats"]

            # event is now publicly visible
            r2 = api_client.get(f"{BASE_URL}/api/events/{created_event_id}")
            assert r2.status_code == 200
            assert r2.json()["title"] == payload["title"]

            # submission shows approved + linked event
            r3 = api_client.get(
                f"{BASE_URL}/api/submissions/{sid}/status",
                params={"email": payload["organizer_email"]},
            )
            assert r3.json()["status"] == "approved"
            assert r3.json()["created_event_id"] == created_event_id

            # approving twice is a 409
            r4 = api_client.post(
                f"{BASE_URL}/api/admin/submissions/{sid}/approve", headers=admin_headers
            )
            assert r4.status_code == 409
        finally:
            if created_event_id:
                mongo_db.events.delete_many({"event_id": created_event_id})
            mongo_db.submissions.delete_many({"submission_id": sid})

    def test_approve_blocks_duplicate_title(self, api_client, admin_headers, mongo_db):
        title = f"TEST_iter7 DuplicateTitle {uuid.uuid4().hex[:6]}"
        payload = self._payload(title)
        r = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
        sid1 = r.json()["submission_id"]
        created_event_id = None
        try:
            r = api_client.post(
                f"{BASE_URL}/api/admin/submissions/{sid1}/approve", headers=admin_headers
            )
            assert r.status_code == 200, r.text
            created_event_id = r.json()["event"]["event_id"]

            # same title submitted again -> approve must 409 (no duplicate event)
            dup = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
            assert dup.status_code == 200
            sid2 = dup.json()["submission_id"]
            try:
                r2 = api_client.post(
                    f"{BASE_URL}/api/admin/submissions/{sid2}/approve", headers=admin_headers
                )
                assert r2.status_code == 409, r2.text
            finally:
                mongo_db.submissions.delete_many({"submission_id": sid2})
        finally:
            if created_event_id:
                mongo_db.events.delete_many({"event_id": created_event_id})
            mongo_db.submissions.delete_many({"submission_id": sid1})

    def test_reject_flow_with_reason(self, api_client, admin_headers, mongo_db):
        payload = self._payload()
        r = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
        sid = r.json()["submission_id"]
        try:
            r = api_client.post(
                f"{BASE_URL}/api/admin/submissions/{sid}/reject",
                json={"reason": "Duplicate of existing event"},
                headers=admin_headers,
            )
            assert r.status_code == 200, r.text
            assert r.json()["status"] == "rejected"
            assert r.json()["reason"] == "Duplicate of existing event"

            r2 = api_client.get(
                f"{BASE_URL}/api/submissions/{sid}/status",
                params={"email": payload["organizer_email"]},
            )
            assert r2.json()["status"] == "rejected"
            assert r2.json()["reject_reason"] == "Duplicate of existing event"

            # no event was created
            assert r2.json().get("created_event_id") is None

            # rejecting twice -> 409; approving after reject -> 409
            r3 = api_client.post(
                f"{BASE_URL}/api/admin/submissions/{sid}/reject", json={}, headers=admin_headers
            )
            assert r3.status_code == 409
            r4 = api_client.post(
                f"{BASE_URL}/api/admin/submissions/{sid}/approve", headers=admin_headers
            )
            assert r4.status_code == 409
        finally:
            mongo_db.submissions.delete_many({"submission_id": sid})

    def test_delete_submission(self, api_client, admin_headers, mongo_db):
        payload = self._payload()
        r = api_client.post(f"{BASE_URL}/api/submissions", json=payload)
        sid = r.json()["submission_id"]
        try:
            r = api_client.delete(
                f"{BASE_URL}/api/admin/submissions/{sid}", headers=admin_headers
            )
            assert r.status_code == 200

            r2 = api_client.get(
                f"{BASE_URL}/api/submissions/{sid}/status",
                params={"email": payload["organizer_email"]},
            )
            assert r2.status_code == 404

            r3 = api_client.delete(
                f"{BASE_URL}/api/admin/submissions/{sid}", headers=admin_headers
            )
            assert r3.status_code == 404
        finally:
            mongo_db.submissions.delete_many({"submission_id": sid})


class TestAdminStatsRegression:
    """/admin/stats now exposes pending_submissions for the admin dashboard."""

    def test_stats_include_pending_submissions(self, api_client, admin_headers):
        r = api_client.get(f"{BASE_URL}/api/admin/stats", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_events" in data
        assert "total_users" in data
        assert "total_organizers" in data
        assert "pending_submissions" in data
        assert isinstance(data["pending_submissions"], int)
