"""
Backend tests for Clann Iteration 4.
New feature: `is_government` field on Event models + query filter.
Also regression on all iteration-2/3 endpoints.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://clann-upskill.preview.emergentagent.com').rstrip('/')


# ============ New: is_government field ============
class TestIsGovernmentField:
    """POST/GET/PUT with is_government=true/false query filter."""

    def _payload(self, gov=False, title_suffix=""):
        return {
            "title": f"TEST_gov_evt_{title_suffix or uuid.uuid4().hex[:6]}",
            "category": "Workshop",
            "mode": "Offline",
            "short_description": "Government-funded UX program",
            "full_description": "A public sector initiative",
            "image_url": "https://example.com/gov.jpg",
            "location": "New Delhi",
            "city": "Delhi",
            "event_date": "2026-07-15",
            "start_time": "10:00",
            "end_time": "16:00",
            "registration_deadline": "2026-07-10",
            "is_paid": False,
            "total_seats": 100,
            "external_link": "https://example.com/register-gov",
            "skills": ["Design", "Policy"],
            "recommended_for": ["All"],
            "featured": False,
            "is_government": gov,
        }

    def test_create_event_with_is_government_true(self, api_client, admin_headers):
        r = api_client.post(f"{BASE_URL}/api/events", json=self._payload(gov=True, title_suffix="gov1"),
                            headers=admin_headers)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["is_government"] is True
        assert doc["title"].startswith("TEST_gov_evt_")

        # cleanup
        api_client.delete(f"{BASE_URL}/api/events/{doc['event_id']}", headers=admin_headers)

    def test_create_event_default_is_government_false(self, api_client, admin_headers):
        payload = self._payload(gov=False, title_suffix="notgov1")
        # Remove is_government to verify default
        del payload["is_government"]
        r = api_client.post(f"{BASE_URL}/api/events", json=payload, headers=admin_headers)
        assert r.status_code == 200
        doc = r.json()
        assert doc.get("is_government") is False

        api_client.delete(f"{BASE_URL}/api/events/{doc['event_id']}", headers=admin_headers)

    def test_list_filter_is_government_true(self, api_client, admin_headers):
        # Seed one gov and one non-gov
        gov = api_client.post(f"{BASE_URL}/api/events",
                              json=self._payload(gov=True, title_suffix="filtergov"),
                              headers=admin_headers).json()
        nongov = api_client.post(f"{BASE_URL}/api/events",
                                 json=self._payload(gov=False, title_suffix="filternotgov"),
                                 headers=admin_headers).json()
        try:
            r = api_client.get(f"{BASE_URL}/api/events", params={"is_government": "true"})
            assert r.status_code == 200
            data = r.json()
            ids = [e["event_id"] for e in data]
            assert gov["event_id"] in ids
            assert nongov["event_id"] not in ids
            for e in data:
                assert e.get("is_government") is True
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{gov['event_id']}", headers=admin_headers)
            api_client.delete(f"{BASE_URL}/api/events/{nongov['event_id']}", headers=admin_headers)

    def test_list_filter_is_government_false(self, api_client, admin_headers):
        gov = api_client.post(f"{BASE_URL}/api/events",
                              json=self._payload(gov=True, title_suffix="filterfg"),
                              headers=admin_headers).json()
        nongov = api_client.post(f"{BASE_URL}/api/events",
                                 json=self._payload(gov=False, title_suffix="filterfn"),
                                 headers=admin_headers).json()
        try:
            r = api_client.get(f"{BASE_URL}/api/events", params={"is_government": "false"})
            assert r.status_code == 200
            data = r.json()
            ids = [e["event_id"] for e in data]
            assert nongov["event_id"] in ids
            assert gov["event_id"] not in ids
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{gov['event_id']}", headers=admin_headers)
            api_client.delete(f"{BASE_URL}/api/events/{nongov['event_id']}", headers=admin_headers)

    def test_list_no_filter_returns_both(self, api_client, admin_headers):
        gov = api_client.post(f"{BASE_URL}/api/events",
                              json=self._payload(gov=True, title_suffix="both1"),
                              headers=admin_headers).json()
        nongov = api_client.post(f"{BASE_URL}/api/events",
                                 json=self._payload(gov=False, title_suffix="both2"),
                                 headers=admin_headers).json()
        try:
            r = api_client.get(f"{BASE_URL}/api/events")
            assert r.status_code == 200
            ids = [e["event_id"] for e in r.json()]
            assert gov["event_id"] in ids
            assert nongov["event_id"] in ids
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{gov['event_id']}", headers=admin_headers)
            api_client.delete(f"{BASE_URL}/api/events/{nongov['event_id']}", headers=admin_headers)

    def test_put_updates_is_government_flag(self, api_client, admin_headers):
        created = api_client.post(f"{BASE_URL}/api/events",
                                  json=self._payload(gov=False, title_suffix="putupd"),
                                  headers=admin_headers).json()
        eid = created["event_id"]
        try:
            r = api_client.put(f"{BASE_URL}/api/events/{eid}",
                               json={"is_government": True}, headers=admin_headers)
            assert r.status_code == 200
            assert r.json()["is_government"] is True

            r = api_client.get(f"{BASE_URL}/api/events/{eid}")
            assert r.status_code == 200
            assert r.json()["is_government"] is True

            # flip back
            r = api_client.put(f"{BASE_URL}/api/events/{eid}",
                               json={"is_government": False}, headers=admin_headers)
            assert r.status_code == 200
            assert r.json()["is_government"] is False
        finally:
            api_client.delete(f"{BASE_URL}/api/events/{eid}", headers=admin_headers)


# ============ Regression: existing seeded events must still list, no _id leak ============
class TestSeededListing:
    def test_seeded_events_visible(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/events")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3
        for e in data:
            assert "_id" not in e
            assert "event_id" in e
