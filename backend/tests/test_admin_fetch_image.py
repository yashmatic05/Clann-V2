"""
Unit tests for POST /api/admin/fetch-image — the admin Image Finder lookup.

ALL HTTP IS MOCKED: no real network is touched. httpx.AsyncClient is replaced
with a route-table fake and socket.getaddrinfo with a deterministic resolver,
so Unstop / Devfolio / Luma and every other real site are deliberately NOT
exercised here (the sandbox has no general internet access; live-site probing
must be done from a normal browser/network environment).

Covered: og:image / attribute-order / relative URLs / twitter fallback /
JSON-LD (string, list, object, @graph, arrays) / no-image page / candidate
rejected because it serves text/html / logo-like demotion / timeout /
http_error / not_html / login-gated hosts / SSRF (loopback, localhost,
private, link-local metadata, public→private redirect) / 4 candidate cap /
dedup / 401 without an admin token / 422 for a malformed body / always-200
suggestion outcomes / and that the endpoint is suggestion-only (no DB write).
"""

import ipaddress
import os
import socket
import sys
from pathlib import Path

# server.py reads its env at import time — set inert values first.
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "fetch_image_unit_db")
os.environ.setdefault("ADMIN_EMAIL", "admin@clann.com")
os.environ.setdefault("ADMIN_PASSWORD_HASH", "$2b$12$notarealhashnotarealhashnota")
os.environ.setdefault("ADMIN_TOKEN_SECRET", "fetch-image-unit-test-secret-0123456789")

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx
import pytest
from fastapi.testclient import TestClient

import server as app_module

PUBLIC_IP = "93.184.216.34"
PAGE = "https://events.example.com/e/42"

# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class FakeResp:
    def __init__(self, status=200, content_type="text/html; charset=utf-8", body=b"", headers=None):
        self.status_code = status
        self.headers = {"content-type": content_type}
        if headers:
            self.headers.update({k.lower(): v for k, v in headers.items()})
        self._body = body if isinstance(body, bytes) else str(body).encode("utf-8")
        self.encoding = "utf-8"
        self.read_count = 0

    async def aiter_bytes(self):
        self.read_count += 1
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
    """Stand-in for httpx.AsyncClient keyed by exact URL."""

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
    body = "<html><head>" + "".join(tags) + "</head><body><h1>Event</h1></body></html>"
    return FakeResp(body=body)


def image_ok(url):
    return FakeResp(content_type="image/jpeg")


def make_resolver(extra=None):
    table = {
        "events.example.com": [PUBLIC_IP],
        "cdn.example.com": [PUBLIC_IP],
        "img.example.com": [PUBLIC_IP],
        "other.example.com": [PUBLIC_IP],
        "localhost": ["127.0.0.1"],
    }
    if extra:
        table.update(extra)

    def fake_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        try:  # IP literals resolve to themselves
            ipaddress.ip_address(host)
            ips = [host]
        except ValueError:
            ips = table.get(host)
            if ips is None:
                raise socket.gaierror(8, f"fake DNS: no entry for {host}")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in ips]

    return fake_getaddrinfo


@pytest.fixture()
def client():
    # No `with`: startup/lifespan (Mongo seeding) is deliberately never run.
    return TestClient(app_module.app)


@pytest.fixture()
def admin_headers(client):
    return {"X-Admin-Token": app_module.create_admin_token()}


@pytest.fixture()
def net(monkeypatch):
    """Install the fake resolver + fake AsyncClient. Returns the FakeHttp holder."""

    class _Net:
        routes = {}
        fake = None

        def install(self, routes, resolver_extra=None):
            self.routes = routes
            self.fake = FakeHttp(routes)
            monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: self.fake)
            monkeypatch.setattr(socket, "getaddrinfo", make_resolver(resolver_extra))
            return self.fake

    return _Net()


def post_lookup(client, admin_headers, url, **body_overrides):
    body = {"url": url}
    body.update(body_overrides)
    return client.post("/api/admin/fetch-image", json=body, headers=admin_headers)


# ---------------------------------------------------------------------------
# Candidate extraction & verification
# ---------------------------------------------------------------------------


def test_og_image_present(client, admin_headers, net):
    poster = "https://cdn.example.com/poster.jpg"
    net.install({PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'), poster: image_ok(poster)})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == poster
    assert out["alternatives"] == [poster]
    assert out["source"] == "og:image"
    assert out["page_url"] == PAGE
    assert out["reason"] is None


def test_og_image_secure_url_wins_over_og_image(client, admin_headers, net):
    secure = "https://cdn.example.com/secure.jpg"
    plain = "https://cdn.example.com/plain.jpg"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{plain}"/>',
            f'<meta property="og:image:secure_url" content="{secure}"/>',
        ),
        secure: image_ok(secure),
        plain: image_ok(plain),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == secure
    assert out["alternatives"] == [secure, plain]


def test_meta_attribute_order_swapped(client, admin_headers, net):
    poster = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(f'<meta content="{poster}" property="og:image"/>'),  # content before property
        poster: image_ok(poster),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == poster
    assert out["source"] == "og:image"


def test_relative_image_url_resolved_against_page(client, admin_headers, net):
    poster = "https://events.example.com/img/poster.jpg"
    net.install({PAGE: html_page('<meta name="og:image" content="/img/poster.jpg"/>'), poster: image_ok(poster)})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == poster
    assert poster in net.fake.seen  # verified at the RESOLVED url


def test_twitter_image_fallback(client, admin_headers, net):
    poster = "https://img.example.com/tw.jpg"
    net.install({PAGE: html_page(f'<meta name="twitter:image" content="{poster}"/>'), poster: image_ok(poster)})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == poster
    assert out["source"] == "twitter:image"


def test_twitter_image_src_fallback(client, admin_headers, net):
    poster = "https://img.example.com/tw2.jpg"
    net.install({PAGE: html_page(f'<meta name="twitter:image:src" content="{poster}"/>'), poster: image_ok(poster)})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["source"] == "twitter:image"
    assert out["image_url"] == poster


@pytest.mark.parametrize(
    "ld_json",
    [
        # image as a plain string
        '{"@type":"Event","name":"X","image":"https://cdn.example.com/a.jpg"}',
        # image as a list (second entry unreachable in routes, first wins)
        '{"@type":"Event","image":["https://cdn.example.com/a.jpg","https://cdn.example.com/b.jpg"]}',
        # image as an object with url
        '{"@type":"Event","image":{"@type":"ImageObject","url":"https://cdn.example.com/a.jpg"}}',
        # inside @graph, @type as full URL, image as list of objects
        (
            '{"@context":"https://schema.org","@graph":['
            '{"@type":"Place","image":"https://cdn.example.com/place.png"},'
            '{"@type":"https://schema.org/Event","image":[{"url":"https://cdn.example.com/a.jpg"}]}]}'
        ),
        # array root of Event objects
        '[{"@type":["Event","SocialEvent"],"image":"https://cdn.example.com/a.jpg"}]',
    ],
    ids=["string", "list", "object-url", "graph", "array-root"],
)
def test_jsonld_event_image_variants(client, admin_headers, net, ld_json):
    poster = "https://cdn.example.com/a.jpg"
    place = "https://cdn.example.com/place.png"
    net.install({
        PAGE: html_page(f'<script type="application/ld+json">{ld_json}</script>'),
        poster: image_ok(poster),
        place: image_ok(place),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["source"] == "json-ld"
    # a non-Event "image" (the Place above) must never be collected
    assert "place.png" not in str(out)
    assert out["image_url"] == poster


def test_page_with_no_image(client, admin_headers, net):
    net.install({PAGE: html_page('<meta property="og:title" content="Nice event"/>')})
    resp = post_lookup(client, admin_headers, PAGE)
    assert resp.status_code == 200
    out = resp.json()
    assert out == {
        "image_url": None,
        "alternatives": [],
        "source": None,
        "page_url": PAGE,
        "reason": "no_image_found",
    }


def test_image_url_returning_html_is_rejected_and_next_candidate_tried(client, admin_headers, net):
    bad = "https://cdn.example.com/not-an-image"
    good = "https://img.example.com/poster.jpg"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{bad}"/>',
            f'<meta name="twitter:image" content="{good}"/>',
        ),
        bad: FakeResp(content_type="text/html; charset=utf-8", body=b"<html>nope</html>"),
        good: image_ok(good),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == good  # first candidate rejected, second kept
    assert out["source"] == "twitter:image"
    assert net.fake.seen.index(bad) < net.fake.seen.index(good)  # both were tried, in order
    # headers only — the rejected HTML body must never have been iterated
    assert net.fake.routes[bad].read_count == 0


def test_all_candidates_unreachable_means_no_image_found(client, admin_headers, net):
    poster = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'),
        poster: FakeResp(status=404, content_type="image/png"),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] is None
    assert out["alternatives"] == []
    assert out["reason"] == "no_image_found"


def test_logo_like_candidate_moved_to_end_not_dropped(client, admin_headers, net):
    logo = "https://cdn.example.com/assets/logo.png"
    poster = "https://cdn.example.com/promo.jpg"
    favicon = "https://cdn.example.com/favicon.ico"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{logo}"/>',
            f'<meta name="twitter:image" content="{poster}"/>',
            f'<link rel="image_src" href="{favicon}"/>',
        ),
        logo: image_ok(logo),
        poster: image_ok(poster),
        favicon: image_ok(favicon),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == poster  # clean candidate first despite og:image priority
    assert out["source"] == "twitter:image"
    # demoted candidates survive, in their original relative order, at the END
    assert out["alternatives"] == [poster, logo, favicon]


def test_svg_gif_demoted_but_kept(client, admin_headers, net):
    anim = "https://cdn.example.com/poster.gif"
    still = "https://cdn.example.com/poster.jpg"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{anim}"/>',
            f'<meta name="twitter:image" content="{still}"/>',
        ),
        anim: image_ok(anim),
        still: image_ok(still),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == still
    assert out["alternatives"] == [still, anim]


def test_duplicates_are_collapsed(client, admin_headers, net):
    same = "https://cdn.example.com/same.jpg"
    net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{same}"/>',
            f'<meta name="twitter:image" content="{same}"/>',
            f'<link rel="image_src" href="{same}"/>',
        ),
        same: image_ok(same),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["alternatives"] == [same]
    assert net.fake.seen.count(same) == 1  # verified once


def test_at_most_four_candidates_verified(client, admin_headers, net):
    urls = [f"https://cdn.example.com/c{i}.jpg" for i in range(6)]
    routes = {
        PAGE: html_page(*[f'<link rel="image_src" href="{u}"/>' for u in urls]),
    }
    for u in urls:
        routes[u] = image_ok(u)
    net.install(routes)
    out = post_lookup(client, admin_headers, PAGE).json()
    probed = [u for u in net.fake.seen if u != PAGE]
    assert len(probed) == 4
    assert out["alternatives"] == urls[:4]  # 5th and 6th never tried


def test_link_image_src_source(client, admin_headers, net):
    poster = "https://cdn.example.com/legacy.jpg"
    net.install({PAGE: html_page(f'<link rel="image_src" href="{poster}"/>'), poster: image_ok(poster)})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["source"] == "image_src"
    assert out["image_url"] == poster


# ---------------------------------------------------------------------------
# Fetch failures & reasons (always HTTP 200)
# ---------------------------------------------------------------------------


def test_timeout_reason(client, admin_headers, net):
    net.install({PAGE: httpx.ConnectTimeout("8 seconds, no answer")})
    resp = post_lookup(client, admin_headers, PAGE)
    assert resp.status_code == 200
    assert resp.json()["reason"] == "timeout"
    assert resp.json()["image_url"] is None


def test_http_error_reason(client, admin_headers, net):
    net.install({PAGE: FakeResp(status=503, content_type="text/html", body=b"down")})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["reason"] == "http_error"


def test_not_html_reason(client, admin_headers, net):
    net.install({PAGE: FakeResp(content_type="application/json", body=b"{}")})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["reason"] == "not_html"


def test_unreachable_reason(client, admin_headers, net):
    net.install({})  # no routes + unknown host -> ConnectError from the fake / gaierror from resolver
    out = post_lookup(client, admin_headers, "https://does-not-exist.example.org/").json()
    assert out["reason"] == "unreachable"


@pytest.mark.parametrize(
    "url",
    [
        "https://instagram.com/p/abc123/",
        "https://www.instagram.com/p/abc123/",
        "https://m.facebook.com/events/12345",
        "https://fb.com/events/12345",
        "https://linkedin.com/events/9",
        "https://x.com/i/events/9",
        "https://twitter.com/i/events/9",
    ],
)
def test_login_gated_hosts_short_circuit(client, admin_headers, net, url):
    fake = net.install({})  # ANY request would be recorded — none may happen
    resp = post_lookup(client, admin_headers, url)
    assert resp.status_code == 200
    out = resp.json()
    assert out["image_url"] is None
    assert out["alternatives"] == []
    assert out["reason"] == "login_gated"
    assert fake.seen == []


# ---------------------------------------------------------------------------
# SSRF protection
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("url", "resolver_extra"),
    [
        ("http://127.0.0.1:8000/admin", None),
        ("http://localhost/event", None),
        ("http://10.0.0.5/register", None),
        ("http://169.254.169.254/latest/meta-data/", None),
        ("http://192.168.1.1/", None),
        ("http://[::1]/", None),
        ("http://0.0.0.0/", None),
        ("http://dual.example.com/", {"dual.example.com": [PUBLIC_IP, "10.0.0.9"]}),  # mixed A/AAAA
    ],
    ids=["loopback-ip", "localhost", "private-10", "metadata-ip", "private-192", "ipv6-loopback", "unspecified", "one-private-record"],
)
def test_ssrf_blocked_before_any_request(client, admin_headers, net, url, resolver_extra):
    fake = net.install({}, resolver_extra=resolver_extra)
    resp = post_lookup(client, admin_headers, url)
    assert resp.status_code == 200
    assert resp.json()["reason"] == "blocked_url"
    assert fake.seen == []  # the address was never contacted


def test_ssrf_public_page_redirecting_to_private_is_blocked(client, admin_headers, net):
    fake = net.install({PAGE: FakeResp(status=302, content_type="text/html", headers={"location": "http://10.0.0.5/internal"})})
    resp = post_lookup(client, admin_headers, PAGE)
    out = resp.json()
    assert out["reason"] == "blocked_url"
    assert fake.seen == [PAGE]  # stopped at the hop — the private host was never fetched
    assert out["page_url"] == "http://10.0.0.5/internal"


def test_image_candidate_pointing_at_metadata_ip_is_blocked(client, admin_headers, net):
    meta = "http://169.254.169.254/user-data"
    good = "https://cdn.example.com/real.jpg"
    fake = net.install({
        PAGE: html_page(
            f'<meta property="og:image" content="{meta}"/>',
            f'<meta name="twitter:image" content="{good}"/>',
        ),
        good: image_ok(good),
    })
    out = post_lookup(client, admin_headers, PAGE).json()
    assert meta not in out["alternatives"]
    assert meta not in fake.seen
    assert out["image_url"] == good


def test_non_http_scheme_rejected(client, admin_headers, net):
    fake = net.install({})
    out = post_lookup(client, admin_headers, "file:///etc/passwd").json()
    assert out["reason"] == "blocked_url"
    out = post_lookup(client, admin_headers, "javascript:alert(1)").json()
    assert out["reason"] == "blocked_url"
    assert fake.seen == []


def test_too_many_redirects_is_http_error(client, admin_headers, net):
    hop = {
        PAGE: FakeResp(status=302, content_type="text/html", headers={"location": "https://events.example.com/h1"}),
        "https://events.example.com/h1": FakeResp(status=302, content_type="text/html", headers={"location": "https://events.example.com/h2"}),
        "https://events.example.com/h2": FakeResp(status=302, content_type="text/html", headers={"location": "https://events.example.com/h3"}),
        "https://events.example.com/h3": FakeResp(status=302, content_type="text/html", headers={"location": "https://events.example.com/h4"}),
    }
    net.install(hop)
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["reason"] == "http_error"


def test_client_timeouts_are_page_8s_and_image_5s(client, admin_headers, net, monkeypatch):
    """DESIGN: 8s total for the page, 5s per candidate probe — captured from the
    AsyncClient constructor args the endpoint passes."""
    kwargs_seen = []

    class SpyHttp(FakeHttp):
        pass

    def spy_factory(*args, **kwargs):
        kwargs_seen.append(kwargs)
        return FakeHttp(net_holder["routes"])

    net_holder = {"routes": {}}
    monkeypatch.setattr(httpx, "AsyncClient", spy_factory)
    monkeypatch.setattr(socket, "getaddrinfo", make_resolver())
    fake = SpyHttp({})
    net_holder["routes"] = fake.routes
    # Page fetch immediately connection-errors — enough to read both clients' kwargs.
    r = post_lookup(client, admin_headers, PAGE)
    assert r.status_code == 200
    assert r.json()["reason"] == "unreachable"
    assert len(kwargs_seen) == 2  # page client + image client
    page_timeout, image_timeout = kwargs_seen[0]["timeout"], kwargs_seen[1]["timeout"]
    assert (page_timeout.connect, page_timeout.read) == (8.0, 8.0)
    assert (image_timeout.connect, image_timeout.read) == (5.0, 5.0)
    assert kwargs_seen[0]["follow_redirects"] is False  # redirects are manual


# ---------------------------------------------------------------------------
# Auth & request validation
# ---------------------------------------------------------------------------


def test_401_without_token(client):
    r = client.post("/api/admin/fetch-image", json={"url": PAGE})
    assert r.status_code == 401


def test_401_with_invalid_token(client):
    r = client.post("/api/admin/fetch-image", json={"url": PAGE}, headers={"X-Admin-Token": "garbage"})
    assert r.status_code == 401


@pytest.mark.parametrize("body", [{}, {"url": 123}, {"url": None}, {"nope": "x"}, [1, 2]])
def test_422_malformed_body(client, admin_headers, body):
    r = client.post("/api/admin/fetch-image", json=body, headers=admin_headers)
    assert r.status_code == 422


def test_empty_string_url_is_blocked_not_500(client, admin_headers, net):
    net.install({})
    r = post_lookup(client, admin_headers, "")
    assert r.status_code == 200
    assert r.json()["reason"] == "blocked_url"


def test_endpoint_is_suggestion_only_no_db_write(client, admin_headers, net, monkeypatch):
    """admin_fetch_image must never touch the database — assert any db access explodes."""

    class ExplodingDB:
        def __getattr__(self, name):
            raise AssertionError("the lookup endpoint must not touch the database")

    monkeypatch.setattr(app_module, "db", ExplodingDB())
    poster = "https://cdn.example.com/poster.jpg"
    net.install({PAGE: html_page(f'<meta property="og:image" content="{poster}"/>'), poster: image_ok(poster)})
    r = post_lookup(client, admin_headers, PAGE)
    assert r.status_code == 200
    assert r.json()["image_url"] == poster


def test_page_body_is_capped_at_1_5mb(client, admin_headers, net):
    big = b'<meta property="og:image" content="https://cdn.example.com/p.jpg"/>' + b"x" * (2 * 1024 * 1024)
    poster = "https://cdn.example.com/p.jpg"
    net.install({PAGE: FakeResp(body=big), poster: image_ok(poster)})
    out = post_lookup(client, admin_headers, PAGE).json()
    assert out["image_url"] == poster  # meta tag at the start is still found in a truncated read
