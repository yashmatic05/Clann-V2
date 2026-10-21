"""
Step 4 tests for POST /api/admin/fetch-image — "never offer a site's default
logo as a poster".

ALL HTTP IS MOCKED (same fake-client pattern as test_admin_fetch_image.py):
httpx.AsyncClient is replaced with a route-table fake and socket.getaddrinfo
with a deterministic resolver, so no real site is ever contacted.

Covered: a candidate identical to the homepage's own og:image is rejected as
generic; a candidate that differs from it is accepted; a failed homepage fetch
skips generic detection entirely; the homepage fetch goes through the same SSRF
validation (a host resolving to a private address is never contacted); one
homepage fetch per host per hour across several lookups; a logo-like path is
generic; all-candidates-generic ends as reason "site_default_image".
"""

import ipaddress
import os
import socket
import sys
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "fetch_image_generic_unit_db")
os.environ.setdefault("ADMIN_EMAIL", "admin@clann.com")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$notarealhashnotarealhashnota")
os.environ.setdefault("ADMIN_TOKEN_SECRET", "fetch-image-generic-secret-0123456789")

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
import pytest
from fastapi.testclient import TestClient

import server as app_module

PUBLIC_IP = "93.184.216.34"
PRIVATE_IP = "10.0.0.7"
HOST = "events.example.com"
PAGE = f"https://{HOST}/e/42"
HOMEPAGE = f"https://{HOST}/"


class FakeResp:
    def __init__(self, status=200, content_type="text/html; charset=utf-8", body=b"", headers=None):
        self.status_code = status
        self.headers = {"content-type": content_type}
        if headers:
            self.headers.update({k.lower(): v for k, v in headers.items()})
        self._body = body if isinstance(body, bytes) else str(body).encode("utf-8")
        self.encoding = "utf-8"

    async def aiter_bytes(self):
        yield self._body

    async def aclose(self):
        pass


class _StreamCtx:
    def __init__(self, resp):
        self._resp = resp

    async def __aenter__(self):
        return self._resp

    async def __aexit__(self, *exc):
        return False


class FakeHttp:
    def __init__(self, routes):
        self.routes = routes
        self.seen = []

    def stream(self, method, url, headers=None, **kwargs):
        assert method == "GET"
        self.seen.append(url)
        route = self.routes.get(url)
        if route is None:
            raise httpx.ConnectError(f"no fake route for {url}")
        if isinstance(route, Exception):
            raise route
        return _StreamCtx(route)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


def html_page(*tags):
    return FakeResp(body="<html><head>" + "".join(tags) + "</head><body>x</body></html>")


def image_ok():
    return FakeResp(content_type="image/jpeg")


def resolver(table, calls=None):
    """Deterministic DNS. `table` maps host -> list of IPs, or a list of lists
    when the answer should change between calls (used for the SSRF test)."""

    def fake_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        try:
            ipaddress.ip_address(host)
            ips = [host]
        except ValueError:
            entry = table.get(host)
            if entry is None:
                raise socket.gaierror(8, f"fake DNS: no entry for {host}")
            if entry and isinstance(entry[0], list):
                index = 0 if calls is None else min(calls.get(host, 0), len(entry) - 1)
                ips = entry[index]
                if calls is not None:
                    calls[host] = calls.get(host, 0) + 1
            else:
                ips = entry
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in ips]

    return fake_getaddrinfo


@pytest.fixture()
def client():
    return TestClient(app_module.app)


@pytest.fixture()
def admin_headers():
    return {"X-Admin-Token": app_module.create_admin_token()}


@pytest.fixture(autouse=True)
def clear_homepage_cache():
    """The cache is process-wide and lasts an hour; tests must not inherit it."""
    app_module._image_lookup_homepage_cache.clear()
    yield
    app_module._image_lookup_homepage_cache.clear()


@pytest.fixture()
def net(monkeypatch):
    class _Net:
        fake = None

        def install(self, routes, table=None, calls=None):
            self.fake = FakeHttp(routes)
            monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: self.fake)
            monkeypatch.setattr(
                socket,
                "getaddrinfo",
                resolver(table or {HOST: [PUBLIC_IP], "cdn.example.com": [PUBLIC_IP]}, calls),
            )
            return self.fake

    return _Net()


def lookup(client, admin_headers, url=PAGE):
    return client.post("/api/admin/fetch-image", json={"url": url}, headers=admin_headers)


# ---------------------------------------------------------------------------
# Homepage image comparison
# ---------------------------------------------------------------------------


def test_candidate_equal_to_homepage_image_is_rejected(client, admin_headers, net):
    default = "https://cdn.example.com/site-default-cover.jpg"
    net.install({
        PAGE: html_page(f'<meta property="og:image" content="{default}"/>'),
        HOMEPAGE: html_page(f'<meta property="og:image" content="{default}"/>'),
        default: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] is None
    assert out["alternatives"] == []
    assert out["reason"] == "site_default_image"
    assert out["generic_candidates"] == [default]


def test_query_string_differences_still_match_the_homepage_image(client, admin_headers, net):
    default = "https://cdn.example.com/site-default-cover.jpg"
    net.install({
        PAGE: html_page(f'<meta property="og:image" content="{default}?w=1200&amp;h=630"/>'),
        HOMEPAGE: html_page(f'<meta property="og:image" content="{default}?w=600"/>'),
        f"{default}?w=1200&h=630": image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] is None
    assert out["reason"] == "site_default_image"


def test_candidate_different_from_homepage_image_is_accepted(client, admin_headers, net):
    default = "https://cdn.example.com/site-default-cover.jpg"
    poster = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'),
        HOMEPAGE: html_page(f'<meta property="og:image" content="{default}"/>'),
        poster: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] == poster
    assert out["alternatives"] == [poster]
    assert out["reason"] is None
    assert "generic_candidates" not in out


def test_mixed_candidates_keep_only_the_real_poster(client, admin_headers, net):
    default = "https://cdn.example.com/site-default-cover.jpg"
    poster = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{default}"/>',
            f'<meta name="twitter:image" content="{poster}"/>',
        ),
        HOMEPAGE: html_page(f'<meta name="twitter:image" content="{default}"/>'),
        default: image_ok(),
        poster: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] == poster
    assert out["alternatives"] == [poster]
    assert out["generic_candidates"] == [default]


def test_longer_alternative_lists_also_drop_the_default(client, admin_headers, net):
    default = "https://cdn.example.com/site-default-cover.jpg"
    a = "https://cdn.example.com/a.jpg"
    b = "https://cdn.example.com/b.jpg"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{a}"/>',
            f'<meta name="twitter:image" content="{default}"/>',
            f'<link rel="image_src" href="{b}"/>',
        ),
        HOMEPAGE: html_page(f'<meta property="og:image" content="{default}"/>'),
        a: image_ok(),
        b: image_ok(),
        default: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["alternatives"] == [a, b]
    assert out["generic_candidates"] == [default]


# ---------------------------------------------------------------------------
# Failure handling — generic detection must never block a lookup
# ---------------------------------------------------------------------------


def test_homepage_fetch_failure_skips_generic_detection(client, admin_headers, net):
    poster = "https://cdn.example.com/poster.jpg"
    fake = net.install({
        PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'),
        # NO route for HOMEPAGE -> the fake client raises ConnectError
        poster: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] == poster
    assert out["reason"] is None
    assert "generic_candidates" not in out
    # the homepage really was attempted (and only once)
    assert fake.seen.count(HOMEPAGE) == 1


def test_homepage_timeout_skips_generic_detection(client, admin_headers, net):
    poster = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'),
        HOMEPAGE: httpx.ConnectTimeout("no answer"),
        poster: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] == poster


def test_homepage_with_no_image_skips_generic_detection(client, admin_headers, net):
    """A homepage that simply publishes no og:image must not make every
    candidate generic."""
    poster = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'),
        HOMEPAGE: html_page('<meta property="og:title" content="No share image"/>'),
        poster: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] == poster
    assert "generic_candidates" not in out


# ---------------------------------------------------------------------------
# SSRF + caching
# ---------------------------------------------------------------------------


def test_homepage_fetch_is_ssrf_validated_and_a_blocked_host_is_never_contacted(
    client, admin_headers, net
):
    """The page is served from a public address; by the time the homepage is
    requested the same hostname resolves to a private address, so the homepage
    must be rejected by the SSRF rules and never actually fetched."""
    poster = "https://cdn.example.com/poster.jpg"
    calls = {}
    fake = net.install(
        {
            PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'),
            poster: image_ok(),
        },
        table={
            HOST: [[PUBLIC_IP], [PRIVATE_IP], [PRIVATE_IP], [PRIVATE_IP]],
            "cdn.example.com": [PUBLIC_IP],
        },
        calls=calls,
    )
    out = lookup(client, admin_headers).json()
    assert out["image_url"] == poster  # lookup still succeeds
    assert HOMEPAGE not in fake.seen  # the private homepage was never contacted


def test_one_homepage_fetch_per_host_for_several_events(client, admin_headers, net):
    default = "https://cdn.example.com/site-default-cover.jpg"
    poster1 = "https://cdn.example.com/poster-1.jpg"
    poster2 = "https://cdn.example.com/poster-2.jpg"
    page2 = f"https://{HOST}/e/99"
    fake = net.install({
        PAGE: html_page(f'<meta property="og:image" content="{poster1}"/>'),
        page2: html_page(f'<meta property="og:image" content="{poster2}"/>'),
        HOMEPAGE: html_page(f'<meta property="og:image" content="{default}"/>'),
        poster1: image_ok(),
        poster2: image_ok(),
    })
    first = lookup(client, admin_headers).json()
    second = lookup(client, admin_headers, url=page2).json()

    assert first["image_url"] == poster1
    assert second["image_url"] == poster2
    assert fake.seen.count(HOMEPAGE) == 1  # cached for the hour
    # and the cached ANSWER is reused too: a default image on the second page
    # would still be recognised without another homepage fetch
    assert app_module._image_lookup_homepage_cache


def test_cached_homepage_answer_is_reused(client, admin_headers, net):
    default = "https://cdn.example.com/site-default-cover.jpg"
    fake = net.install({
        PAGE: html_page(f'<meta property="og:image" content="{default}"/>'),
        HOMEPAGE: html_page(f'<meta property="og:image" content="{default}"/>'),
        default: image_ok(),
    })
    lookup(client, admin_headers)
    lookup(client, admin_headers)
    assert fake.seen.count(HOMEPAGE) == 1


# ---------------------------------------------------------------------------
# Logo-like paths
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("path", ["logo.png", "assets/favicon.ico", "img/sprite.png", "placeholder.jpg", "default.jpg"])
def test_logo_like_path_is_generic(client, admin_headers, net, path):
    candidate = f"https://cdn.example.com/{path}"
    poster = "https://cdn.example.com/promo.jpg"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{candidate}"/>',
            f'<meta name="twitter:image" content="{poster}"/>',
        ),
        HOMEPAGE: html_page('<meta property="og:title" content="No share image"/>'),
        candidate: image_ok(),
        poster: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] == poster
    assert out["alternatives"] == [poster]
    assert out["generic_candidates"] == [candidate]


def test_all_generic_candidates_report_site_default_image(client, admin_headers, net):
    logo = "https://cdn.example.com/assets/logo.png"
    favicon = "https://cdn.example.com/favicon.ico"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{logo}"/>',
            f'<link rel="image_src" href="{favicon}"/>',
        ),
        HOMEPAGE: html_page('<meta property="og:title" content="No share image"/>'),
        logo: image_ok(),
        favicon: image_ok(),
    })
    out = lookup(client, admin_headers).json()
    assert out["image_url"] is None
    assert out["alternatives"] == []
    assert out["reason"] == "site_default_image"
    assert out["generic_candidates"] == [logo, favicon]


def test_unreachable_candidates_still_say_no_image_found(client, admin_headers, net):
    poster = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'),
        poster: FakeResp(status=404, content_type="image/png"),
    })
    out = lookup(client, admin_headers).json()
    assert out["reason"] == "no_image_found"
    assert out["image_url"] is None
