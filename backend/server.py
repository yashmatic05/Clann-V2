from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import asyncio
import secrets
import socket
import ipaddress
import string
import logging
import uuid
import httpx
import jwt
import bcrypt
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL')
ADMIN_PASSWORD_HASH = os.environ.get('ADMIN_PASSWORD_HASH')
ADMIN_TOKEN_SECRET = os.environ.get('ADMIN_TOKEN_SECRET')
ADMIN_TOKEN_TTL_HOURS = int(os.environ.get('ADMIN_TOKEN_TTL_HOURS', '8'))

if not ADMIN_EMAIL or not ADMIN_PASSWORD_HASH or not ADMIN_TOKEN_SECRET:
    raise RuntimeError(
        'ADMIN_EMAIL, ADMIN_PASSWORD_HASH, and ADMIN_TOKEN_SECRET must be set.'
    )
if ADMIN_TOKEN_TTL_HOURS <= 0:
    raise RuntimeError('ADMIN_TOKEN_TTL_HOURS must be a positive integer.')
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:3000,https://clann-upskill.preview.emergentagent.com',
    ).split(',')
    if origin.strip()
]

app = FastAPI(title="Clann API")
api_router = APIRouter(prefix="/api")

# -----------------------------
# Models
# -----------------------------
class EventCreate(BaseModel):
    title: str
    category: str  # Workshop, Meetup, Hackathon, Conference, Walk, Art & Sketch
    mode: str  # Online / Offline / Both
    short_description: str
    full_description: str
    # image_url is OPTIONAL: store "" when there is no real event image. The
    # frontend shows a render-time stock fallback. Never auto-fill a stock URL.
    image_url: Optional[str] = None
    location: str
    city: str
    event_date: str  # ISO string date
    start_time: str
    end_time: str
    registration_deadline: str
    is_paid: bool = False
    price: Optional[str] = None
    total_seats: int = 0
    seats_left: Optional[int] = None
    external_link: str
    skills: List[str] = []
    recommended_for: List[str] = []
    featured: bool = False
    is_government: bool = False
    homepage_category: Optional[str] = None

class EventUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    mode: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    image_url: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    registration_deadline: Optional[str] = None
    is_paid: Optional[bool] = None
    price: Optional[str] = None
    total_seats: Optional[int] = None
    seats_left: Optional[int] = None
    external_link: Optional[str] = None
    skills: Optional[List[str]] = None
    recommended_for: Optional[List[str]] = None
    featured: Optional[bool] = None
    is_government: Optional[bool] = None
    homepage_category: Optional[str] = None

class AdminLogin(BaseModel):
    email: str
    password: str

class CategoryRename(BaseModel):
    old_name: str
    new_name: str

class ProfileComplete(BaseModel):
    phone: str
    city: Optional[str] = "Delhi"
    role: str = "attendee"  # attendee or organizer
    org_name: Optional[str] = ""
    event_types: Optional[List[str]] = []
    instagram: Optional[str] = ""
    whatsapp_reminder_enabled: Optional[bool] = True

class WhatsAppReminder(BaseModel):
    phone: str

class WhatsAppToggle(BaseModel):
    enabled: bool

class EventReminderToggle(BaseModel):
    enabled: bool

class FeedbackCreate(BaseModel):
    star_rating: int
    feedback_text: str

class OrganizerSubmissionCreate(BaseModel):
    organizer_name: str = Field(min_length=1)
    organizer_email: EmailStr
    organizer_phone: Optional[str] = ""
    title: str = Field(min_length=1)
    category: str = "Workshop"  # Workshop, Meetup, Hackathon, Conference, Walk, Art & Sketch
    mode: str = "Offline"  # Online / Offline / Both
    short_description: str = Field(min_length=1)
    full_description: str = ""
    # image_url is OPTIONAL: no real event image -> store empty string and let
    # the frontend show a stock fallback. Never auto-fill a stock URL here.
    image_url: Optional[str] = ""
    location: str = ""
    city: str = "Delhi"
    event_date: str = Field(min_length=1)  # ISO string date YYYY-MM-DD
    start_time: str = "10:00"
    end_time: str = "13:00"
    registration_deadline: Optional[str] = ""
    is_paid: bool = False
    price: Optional[str] = None
    total_seats: int = 0
    external_link: str = ""
    notes: Optional[str] = ""

class SubmissionReject(BaseModel):
    reason: Optional[str] = ""

class ImageLookupRequest(BaseModel):
    url: str

# -----------------------------
# Helpers
# -----------------------------
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
):
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user

async def require_user(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def create_admin_token() -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "admin",
        "email": ADMIN_EMAIL,
        "iss": "clann-api",
        "iat": now,
        "exp": now + timedelta(hours=ADMIN_TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, ADMIN_TOKEN_SECRET, algorithm="HS256")


def verify_admin_token(token: str) -> bool:
    if not token:
        return False
    try:
        payload = jwt.decode(
            token,
            ADMIN_TOKEN_SECRET,
            algorithms=["HS256"],
            issuer="clann-api",
            options={"require": ["exp", "iat", "sub", "email"]},
        )
        return payload.get("sub") == "admin" and payload.get("email") == ADMIN_EMAIL
    except jwt.PyJWTError:
        return False


def verify_admin_password(password: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            ADMIN_PASSWORD_HASH.encode("utf-8"),
        )
    except (ValueError, TypeError):
        logger.error("Invalid ADMIN_PASSWORD_HASH configuration")
        return False


async def require_admin(x_admin_token: Optional[str] = Header(None)):
    if not verify_admin_token(x_admin_token or ""):
        raise HTTPException(status_code=401, detail="Admin auth required")
    return True


def escape_regex(value: str) -> str:
    return re.escape(value.strip())


# Category code mapping used to build Clann event IDs (CLN-<CODE>-<RAND>).
CATEGORY_CODES = {
    "workshop": "WORK",
    "hackathon": "HACK",
    "meetup": "MEET",
    "conference": "CONF",
    "walk": "WALK",
    "walks": "WALK",
    "art & sketch": "ART",
}

EVENT_ID_ALPHABET = string.ascii_uppercase + string.digits  # A-Z, 0-9


def generate_event_id(title: str, category: str) -> str:
    """Generate a unique Clann event ID in the format CLN-[CATEGORY_CODE]-[4 RANDOM].

    The 4 random characters are drawn from uppercase A-Z and digits 0-9.
    Example outputs: CLN-WORK-3M9P, CLN-HACK-8YZK, CLN-CONF-2XPQ.
    """
    code = CATEGORY_CODES.get((category or "").strip().lower(), "EVNT")
    suffix = "".join(secrets.choice(EVENT_ID_ALPHABET) for _ in range(4))
    return f"CLN-{code}-{suffix}"


def excel_serial_to_iso(value: str) -> Optional[str]:
    if not value or not re.fullmatch(r"\d+", str(value).strip()):
        return None
    serial = int(str(value).strip())
    ms = round((serial - 25569) * 86400 * 1000)
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%d")


def event_public(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _contains_any(text: str, keywords) -> bool:
    """Case-insensitive whole-word match for any keyword in `text`."""
    if not text:
        return False
    for kw in keywords:
        # Word-boundary match so "app" doesn't match "apple", etc.
        if re.search(r"\b" + re.escape(kw.strip()) + r"\b", text, re.IGNORECASE):
            return True
    return False


def _dedupe(items) -> list:
    """Case-insensitive deduplication preserving first-seen order."""
    seen = set()
    out = []
    for item in items:
        if item is None:
            continue
        key = str(item).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(str(item).strip())
    return out


def normalize_tag(tag):
    return " ".join(word.capitalize() for word in tag.strip().split())


def generate_event_tags(title: str, category: str, short_description: str):
    """Auto-generate `skills_tags` and `recommended_for_tags` via keyword matching.

    No external API is used. Each returned list is deduplicated and capped at 5.
    """
    title_text = (title or "").strip()
    desc_text = (short_description or "").strip()
    haystack = f"{title_text} {desc_text}".strip()
    cat = (category or "").strip().lower()

    # ---- Skills ----
    skills = []
    if cat == "workshop" or _contains_any(
        haystack, ["design", "figma", "sketch", "illustration", "art"]
    ):
        skills += ["Design Thinking", "Visual Communication", "Creative Skills"]
    if _contains_any(
        title_text,
        ["coding", "python", "javascript", "web", "app", "tech", "ai", "ml"],
    ):
        skills += ["Programming", "Technical Skills", "Problem Solving"]
    if _contains_any(
        title_text, ["public speaking", "communication", "presentation"]
    ):
        skills += ["Communication", "Public Speaking", "Confidence"]
    if _contains_any(
        title_text, ["business", "startup", "entrepreneurship", "marketing"]
    ):
        skills += ["Business Strategy", "Networking", "Leadership"]
    if _contains_any(
        title_text, ["photography", "film", "cinema", "video"]
    ):
        skills += ["Visual Storytelling", "Photography", "Creative Direction"]
    if _contains_any(
        title_text, ["music", "dance", "performance", "theatre", "acting"]
    ):
        skills += ["Performance", "Stage Presence", "Creative Expression"]
    if cat == "hackathon":
        skills += ["Problem Solving", "Teamwork", "Innovation"]
    if cat == "conference":
        skills += ["Industry Knowledge", "Networking", "Professional Development"]
    if cat == "meetup":
        skills += ["Networking", "Community Building", "Communication"]
    if not skills:
        skills = ["Learning", "Networking", "Skill Development"]
    skills_tags = _dedupe(skills)[:5]

    # ---- Recommended For ----
    recs = []
    if _contains_any(title_text, ["student", "college", "university", "campus"]):
        recs.append("Students")
    if _contains_any(title_text, ["beginner", "starter", "introduction", "basics", "101"]):
        recs.append("Beginners")
    if _contains_any(title_text, ["professional", "corporate", "industry", "career"]):
        recs.append("Professionals")
    if _contains_any(title_text, ["designer", "design"]):
        recs.append("Designers")
    if _contains_any(title_text, ["developer", "coder", "programmer"]):
        recs.append("Developers")
    if _contains_any(title_text, ["entrepreneur", "founder", "startup"]):
        recs.append("Entrepreneurs")
    if cat == "hackathon":
        recs += ["Students", "Developers", "Innovators"]
    if cat == "conference":
        recs += ["Professionals", "Industry Experts"]
    if not recs:
        recs = ["All", "Curious Minds"]
    recommended_for_tags = _dedupe(recs)[:5]

    skills_tags = [normalize_tag(tag) for tag in skills_tags]
    recommended_for_tags = [normalize_tag(tag) for tag in recommended_for_tags]
    return skills_tags, recommended_for_tags

# -----------------------------
# Auth Endpoints (Emergent Google)
# -----------------------------
@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data.get("email")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Invalid session")
    name = data.get("name", "")
    picture = data.get("picture", "")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "attendee",
            "phone": "",
            "city": "",
            "org_name": "",
            "event_types": [],
            "instagram": "",
            "whatsapp_reminder_enabled": True,
            "profile_complete": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600,
    )
    # Return the full user document so client hydrates with phone/city/etc.
    full_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return full_user

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/complete-profile")
async def complete_profile(payload: ProfileComplete, user=Depends(require_user)):
    if not payload.phone or not payload.phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")
    update = {
        "phone": payload.phone.strip(),
        "city": payload.city or "Delhi",
        "role": payload.role or "attendee",
        "whatsapp_reminder_enabled": bool(payload.whatsapp_reminder_enabled),
        "profile_complete": True,
    }
    if payload.role == "organizer":
        update.update({
            "org_name": payload.org_name or "",
            "event_types": payload.event_types or [],
            "instagram": payload.instagram or "",
        })
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"ok": True}

@api_router.post("/auth/whatsapp-toggle")
async def whatsapp_toggle(payload: WhatsAppToggle, user=Depends(require_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"whatsapp_reminder_enabled": bool(payload.enabled)}},
    )
    return {"ok": True, "enabled": payload.enabled}

@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# -----------------------------
# Admin
# -----------------------------
@api_router.post("/admin/login")
async def admin_login(payload: AdminLogin):
    valid_email = secrets.compare_digest(payload.email.strip().lower(), ADMIN_EMAIL.strip().lower())
    valid_password = verify_admin_password(payload.password)
    if valid_email and valid_password:
        return {"token": create_admin_token(), "email": ADMIN_EMAIL}
    raise HTTPException(status_code=401, detail="Invalid admin credentials")

@api_router.get("/admin/stats")
async def admin_stats(_=Depends(require_admin)):
    total_events = await db.events.count_documents({})
    total_users = await db.users.count_documents({})
    total_organizers = await db.users.count_documents({"role": "organizer"})
    pending_submissions = await db.submissions.count_documents({"status": "pending"})
    return {
        "total_events": total_events,
        "total_users": total_users,
        "total_organizers": total_organizers,
        "pending_submissions": pending_submissions,
    }


@api_router.get("/admin/remove-duplicates")
async def remove_duplicate_events(_=Depends(require_admin)):
    """Remove all but the oldest event for each normalized title."""
    events = []
    async for event in db.events.find({}):
        events.append(event)
    grouped = {}
    for event in events:
        normalized_title = normalize_event_title(event.get("title"))
        grouped.setdefault(normalized_title, []).append(event)

    removed_count = 0
    kept_count = 0
    duplicates_removed = []

    def oldest_key(event):
        created_at = event.get("created_at")
        if isinstance(created_at, datetime):
            timestamp = created_at
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
        elif created_at:
            try:
                timestamp = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                timestamp = datetime.max.replace(tzinfo=timezone.utc)
        else:
            timestamp = datetime.max.replace(tzinfo=timezone.utc)
        # ObjectId values sort by creation order. Stringifying also keeps this
        # fallback safe for databases containing legacy non-ObjectId _ids.
        return timestamp, str(event.get("_id", ""))

    for normalized_title, group in grouped.items():
        if len(group) == 1:
            kept_count += 1
            continue

        group.sort(key=oldest_key)
        kept_count += 1
        duplicates_removed.append(normalized_title)
        for duplicate in group[1:]:
            result = await db.events.delete_one({"_id": duplicate["_id"]})
            removed_count += result.deleted_count

    return {
        "removed_count": removed_count,
        "kept_count": kept_count,
        "duplicates_removed": duplicates_removed,
    }


@api_router.get("/admin/events/export")
async def export_all_events(_=Depends(require_admin)):
    """
    Admin-only export of the complete event collection.
    Returns ALL events without pagination or date filtering.
    READ-ONLY — no modifications, no duplicate cleanup.
    """
    docs = []
    async for doc in db.events.find({}, {"_id": 0}).sort("event_date", 1):
        docs.append(doc)
    return docs


@api_router.get("/admin/backfill-event-ids")
async def backfill_event_ids(_=Depends(require_admin)):
    # Events that were created before clann_event_id existed (field missing or null).
    missing_docs = []
    async for doc in db.events.find(
        {"clann_event_id": None},
        {"_id": 0, "event_id": 1, "title": 1, "category": 1},
    ):
        missing_docs.append(doc)

    # All IDs already in use, so backfilled IDs stay unique.
    used_ids = set()
    async for doc in db.events.find(
        {"clann_event_id": {"$ne": None}},
        {"_id": 0, "clann_event_id": 1},
    ):
        if doc.get("clann_event_id"):
            used_ids.add(doc["clann_event_id"])

    updated = 0
    for doc in missing_docs:
        candidate = generate_event_id(doc.get("title", ""), doc.get("category", ""))
        while candidate in used_ids:
            candidate = generate_event_id(doc.get("title", ""), doc.get("category", ""))
        used_ids.add(candidate)
        await db.events.update_one(
            {"event_id": doc["event_id"]},
            {"$set": {"clann_event_id": candidate}},
        )
        updated += 1

    return {"updated_count": updated, "total_missing": len(missing_docs)}

# -----------------------------
# Admin image lookup (poster finder for the "Image Finder" tool)
# -----------------------------
# Suggestion-only helper: given an event's OWN registration-page URL, look for
# a real poster image the page itself publishes (og:image / twitter:image /
# schema.org Event JSON-LD / <link rel="image_src">), verify each candidate is
# actually a reachable image, and return it for human approval. This NEVER
# writes to the database — approving goes through the normal
# PUT /events/{event_id} flow — and it NEVER invents, guesses or substitutes a
# stock/AI image: if the page has no poster, the answer is an honest reason.

IMAGE_LOOKUP_LOGIN_GATED_HOSTS = (
    "instagram.com",
    "facebook.com",
    "fb.com",
    "linkedin.com",
    "x.com",
    "twitter.com",
)
IMAGE_LOOKUP_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
IMAGE_LOOKUP_PAGE_TIMEOUT = 8.0      # total timeout for opening the page
IMAGE_LOOKUP_IMAGE_TIMEOUT = 5.0     # per candidate verification
IMAGE_LOOKUP_MAX_PAGE_BYTES = 1_500_000  # read at most 1.5 MB of page HTML
IMAGE_LOOKUP_MAX_HOPS = 3            # redirects followed manually
IMAGE_LOOKUP_MAX_CANDIDATES = 4      # candidate image URLs verified at most
IMAGE_LOOKUP_DEMOTE_MARKERS = ("logo", "favicon", "sprite", "placeholder", "default")


def _image_lookup_host_gated(hostname: str) -> bool:
    """Instagram/Facebook/LinkedIn/X pages hide their content behind a login —
    a fetch would only ever see the login wall, never the event poster."""
    host = (hostname or "").lower().rstrip(".")
    return any(
        host == gated or host.endswith("." + gated)
        for gated in IMAGE_LOOKUP_LOGIN_GATED_HOSTS
    )


def _image_lookup_blocked_ip(ip_str: str) -> bool:
    """SSRF guard: True when an address must never be fetched from. Covers
    loopback, private (incl. 10/8 and 192.168/16), link-local (incl. the cloud
    metadata IP 169.254.169.254), multicast, reserved and unspecified ranges
    for IPv4 and IPv6; also unwraps v4-mapped and 6to4 IPv6 addresses."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # unparseable -> treat as blocked
    if isinstance(ip, ipaddress.IPv6Address):
        mapped = getattr(ip, "ipv4_mapped", None)
        if mapped is not None:
            return _image_lookup_blocked_ip(str(mapped))
        sixtofour = getattr(ip, "sixtofour", None)
        if sixtofour is not None:
            return _image_lookup_blocked_ip(str(sixtofour))
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


async def _image_lookup_host_is_public(hostname: str, port: int):
    """Resolve the hostname and require EVERY returned address to be public.

    Returns (ok, reason). Known limitation: httpx performs its own resolution
    when it connects, so the validated IP cannot be pinned to the actual
    socket — a DNS-rebinding race is theoretically possible. This endpoint is
    admin-only, which is why that residual risk is accepted and documented.
    """
    try:
        infos = await asyncio.to_thread(
            socket.getaddrinfo, hostname, port, 0, socket.SOCK_STREAM
        )
    except (socket.gaierror, UnicodeError, OverflowError, OSError):
        return False, "unreachable"
    checked = set()
    for info in infos:
        ip_str = str(info[4][0]).split("%", 1)[0]
        if ip_str in checked:
            continue
        checked.add(ip_str)
        if _image_lookup_blocked_ip(ip_str):
            return False, "blocked_url"
    if not checked:
        return False, "unreachable"
    return True, None


async def _image_lookup_get(client, url: str, *, want: str) -> dict:
    """GET with redirects followed MANUALLY (max 3 hops), re-validating the
    scheme and the SSRF rules at every hop. `want` is "html" (read at most
    1.5 MB of the body) or "image" (status + content-type only — the body is
    never read).

    Returns {ok, final_url, reason, body}.
    """
    current = (url or "").strip()
    for hop in range(IMAGE_LOOKUP_MAX_HOPS + 1):
        try:
            parts = urlsplit(current)
            scheme = (parts.scheme or "").lower()
            hostname = parts.hostname
            port = parts.port or (443 if scheme == "https" else 80)
        except ValueError:
            return {"ok": False, "final_url": current, "reason": "blocked_url", "body": None}
        if scheme not in ("http", "https") or not hostname:
            return {"ok": False, "final_url": current, "reason": "blocked_url", "body": None}
        ok, reason = await _image_lookup_host_is_public(hostname, port)
        if not ok:
            return {"ok": False, "final_url": current, "reason": reason, "body": None}
        headers = {"User-Agent": IMAGE_LOOKUP_UA}
        if want == "html":
            headers["Accept"] = "text/html"
        try:
            async with client.stream("GET", current, headers=headers) as resp:
                status = resp.status_code
                ctype = str(resp.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
                if status in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    if not location or hop >= IMAGE_LOOKUP_MAX_HOPS:
                        return {"ok": False, "final_url": current, "reason": "http_error", "body": None}
                    current = urljoin(current, str(location).strip())
                    continue
                if status != 200:
                    return {"ok": False, "final_url": current, "reason": "http_error", "body": None}
                if want == "image":
                    # Headers only: exit the stream context without reading the body.
                    return {"ok": ctype.startswith("image/"), "final_url": current, "reason": None, "body": None}
                if "html" not in ctype:
                    return {"ok": False, "final_url": current, "reason": "not_html", "body": None}
                buf = bytearray()
                async for chunk in resp.aiter_bytes():
                    buf.extend(chunk)
                    if len(buf) >= IMAGE_LOOKUP_MAX_PAGE_BYTES:
                        break
                encoding = getattr(resp, "encoding", None) or "utf-8"
                try:
                    body = bytes(buf).decode(encoding, errors="replace")
                except LookupError:
                    body = bytes(buf).decode("utf-8", errors="replace")
                return {"ok": True, "final_url": current, "reason": None, "body": body}
        except httpx.TimeoutException:
            return {"ok": False, "final_url": current, "reason": "timeout", "body": None}
        except (httpx.HTTPError, OSError, UnicodeError):
            return {"ok": False, "final_url": current, "reason": "unreachable", "body": None}
    return {"ok": False, "final_url": current, "reason": "http_error", "body": None}


class _ImageLookupPageParser(HTMLParser):
    """Collects image signals with the stdlib parser only: og:/twitter: meta
    tags (either `property` or `name`, `content` in any attribute order),
    <link rel="image_src">, and JSON-LD script bodies."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.metas = {}
        self.image_srcs = []
        self.jsonld = []
        self._in_ld = False
        self._ld_buf = []

    def handle_starttag(self, tag, attrs):
        if tag not in ("meta", "link", "script"):
            return
        found = {}
        for key, value in attrs:
            if value is not None:
                found[key.lower()] = value
        if tag == "meta":
            name = (found.get("property") or found.get("name") or "").strip().lower()
            content = found.get("content")
            if name and content and name not in self.metas:
                self.metas[name] = content.strip()
        elif tag == "link":
            rel_tokens = (found.get("rel") or "").strip().lower().split()
            href = (found.get("href") or "").strip()
            if href and "image_src" in rel_tokens:
                self.image_srcs.append(href)
        elif tag == "script":
            if (found.get("type") or "").strip().lower() == "application/ld+json":
                self._in_ld = True
                self._ld_buf = []

    def handle_data(self, data):
        if self._in_ld:
            self._ld_buf.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._in_ld:
            if self._ld_buf:
                self.jsonld.append("".join(self._ld_buf))
            self._in_ld = False
            self._ld_buf = []


def _image_lookup_jsonld_images(blobs) -> list:
    """`image` values of schema.org Event objects inside JSON-LD blocks.

    Handles top-level objects/arrays, `@graph` graphs, `@type` as string or
    list (also in full URL form like "https://schema.org/Event"), and `image`
    as a string, a list of strings/objects, or an object with `url`.
    """
    images = []

    def add(value):
        if isinstance(value, str):
            text = value.strip()
            if text:
                images.append(text)
        elif isinstance(value, list):
            for item in value:
                add(item)
        elif isinstance(value, dict):
            add(value.get("url"))

    def visit(node):
        if isinstance(node, list):
            for item in node:
                visit(item)
            return
        if not isinstance(node, dict):
            return
        raw_type = node.get("@type")
        type_items = raw_type if isinstance(raw_type, list) else [raw_type]
        for item in type_items:
            if item is None:
                continue
            name = str(item).strip().rsplit("/", 1)[-1].rsplit("#", 1)[-1].lower()
            if name == "event" and "image" in node:
                add(node.get("image"))
                break
        for value in node.values():
            if isinstance(value, (dict, list)):
                visit(value)

    for blob in blobs:
        try:
            data = json.loads(blob)
        except (ValueError, TypeError):
            continue
        visit(data)
    return images


def _image_lookup_demote(url: str) -> bool:
    """Site icons and animation placeholders are never posters — but they are
    not dropped either; they are moved to the END of the candidate list."""
    try:
        path = urlsplit(url).path.lower()
    except ValueError:
        path = url.lower()
    if any(marker in path for marker in IMAGE_LOOKUP_DEMOTE_MARKERS):
        return True
    return path.endswith((".svg", ".ico", ".gif"))


def _image_lookup_candidates(html: str, final_url: str) -> list:
    """Ordered, de-duplicated candidates as (resolved_url, source) pairs."""
    parser = _ImageLookupPageParser()
    try:
        parser.feed(html or "")
        parser.close()
    except Exception:
        pass  # a truncated/odd page still yields whatever parsed cleanly

    ordered = []
    seen = set()

    def push(raw, source):
        if not raw:
            return
        resolved = urljoin(final_url, str(raw).strip())
        if not resolved.lower().startswith(("http://", "https://")):
            return
        if resolved in seen:
            return
        seen.add(resolved)
        ordered.append((resolved, source))

    push(parser.metas.get("og:image:secure_url"), "og:image")
    push(parser.metas.get("og:image"), "og:image")
    push(parser.metas.get("twitter:image"), "twitter:image")
    push(parser.metas.get("twitter:image:src"), "twitter:image")
    for value in _image_lookup_jsonld_images(parser.jsonld):
        push(value, "json-ld")
    for value in parser.image_srcs:
        push(value, "image_src")

    keep = [item for item in ordered if not _image_lookup_demote(item[0])]
    demoted = [item for item in ordered if _image_lookup_demote(item[0])]
    return keep + demoted


@api_router.post("/admin/fetch-image")
async def admin_fetch_image(payload: ImageLookupRequest, _=Depends(require_admin)):
    """Find a real poster image on the event's own registration page.

    SUGGESTS ONLY — nothing is ever written to the database from here.
    Outcomes are always HTTP 200 with {image_url, alternatives, source,
    page_url, reason}; 401 is missing admin auth and 422 a malformed body
    (both handled by FastAPI itself).
    """
    url = (payload.url or "").strip()

    def result(image_url=None, alternatives=None, source=None, page_url=url, reason=None):
        return {
            "image_url": image_url,
            "alternatives": alternatives or [],
            "source": source,
            "page_url": page_url,
            "reason": reason,
        }

    try:
        parts = urlsplit(url)
    except ValueError:
        return result(reason="blocked_url")
    host = (parts.hostname or "").lower()
    if (parts.scheme or "").lower() not in ("http", "https") or not host:
        return result(reason="blocked_url")
    if _image_lookup_host_gated(host):
        return result(reason="login_gated")

    verified = []
    final_url = url
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(IMAGE_LOOKUP_PAGE_TIMEOUT),
            follow_redirects=False,
        ) as page_client, httpx.AsyncClient(
            timeout=httpx.Timeout(IMAGE_LOOKUP_IMAGE_TIMEOUT),
            follow_redirects=False,
        ) as image_client:
            page = await _image_lookup_get(page_client, url, want="html")
            if not page["ok"]:
                return result(page_url=page["final_url"], reason=page["reason"])
            final_url = page["final_url"]
            candidates = _image_lookup_candidates(page["body"], final_url)
            for cand_url, cand_source in candidates[:IMAGE_LOOKUP_MAX_CANDIDATES]:
                probe = await _image_lookup_get(image_client, cand_url, want="image")
                if probe["ok"]:
                    verified.append((cand_url, cand_source))
    except httpx.TimeoutException:
        return result(page_url=final_url, reason="timeout")
    except (httpx.HTTPError, OSError):
        return result(page_url=final_url, reason="unreachable")

    if not verified:
        # Nothing published (or nothing reachable) — say so honestly.
        return result(page_url=final_url, reason="no_image_found")

    first_url, first_source = verified[0]
    return result(
        image_url=first_url,
        alternatives=[cand_url for cand_url, _ in verified],
        source=first_source,
        page_url=final_url,
        reason=None,
    )

# -----------------------------
# Homepage Categories
# -----------------------------
@api_router.get("/homepage-categories")
async def get_homepage_categories():
    raw = await db.events.distinct("homepage_category")
    categories = [
        str(c).strip()
        for c in raw
        if c is not None and str(c).strip() != ""
    ]
    unique_cats = list(set(categories))
    unique_cats.sort(key=lambda s: s.lower())
    return unique_cats

@api_router.patch("/homepage-categories/rename")
async def rename_homepage_category(payload: CategoryRename, _=Depends(require_admin)):
    old_name = payload.old_name.strip()
    new_name = payload.new_name.strip()
    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="old_name and new_name are required")
    res = await db.events.update_many(
        {"homepage_category": old_name},
        {"$set": {"homepage_category": new_name}}
    )
    return {"updated_count": res.modified_count, "count": res.modified_count}

@api_router.delete("/homepage-categories/{category_name}")
async def delete_homepage_category(category_name: str, _=Depends(require_admin)):
    res = await db.events.update_many(
        {"homepage_category": category_name},
        {"$set": {"homepage_category": None}}
    )
    return {"updated_count": res.modified_count, "count": res.modified_count}

# -----------------------------
# Events
# -----------------------------
def normalize_clan_id(s):
    if s is None:
        return ""
    return re.sub(r'[^A-Z0-9]', '', str(s).upper())


def normalize_event_title(title) -> str:
    """Return the canonical value used to identify duplicate event titles."""
    return str(title or "").strip().lower()


@api_router.get("/events")
async def list_events(
    category: Optional[str] = None,
    mode: Optional[str] = None,
    city: Optional[str] = None,
    q: Optional[str] = None,
    featured: Optional[bool] = None,
    is_government: Optional[bool] = None,
    x_admin_token: Optional[str] = Header(None),
):
    query: dict = {}
    if category and category.lower() != "all":
        query["category"] = category
    if mode and mode.lower() != "both":
        # Include Both when filtering by Online or Offline
        query["mode"] = {"$in": [mode, "Both"]}
    if city:
        query["city"] = city
    if featured is not None:
        query["featured"] = featured
    if is_government is not None:
        query["is_government"] = is_government

    if not verify_admin_token(x_admin_token or ""):
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        query["event_date"] = {"$gte": today_str}

    if q:
        docs = await db.events.find(query, {"_id": 0}).sort("event_date", 1).to_list(500)
        normalized_q = normalize_clan_id(q)
        safe_q_pat = re.compile(escape_regex(q), re.IGNORECASE)
        
        filtered_docs = []
        for doc in docs:
            title = doc.get("title") or ""
            short_desc = doc.get("short_description") or ""
            full_desc = doc.get("full_description") or ""
            clann_event_id = doc.get("clann_event_id") or ""
            
            normalized_db_id = normalize_clan_id(clann_event_id)
            
            matches_text = (
                safe_q_pat.search(title) or 
                safe_q_pat.search(short_desc) or 
                safe_q_pat.search(full_desc)
            )
            
            matches_clann_id = (
                normalized_q != "" and normalized_db_id != "" and normalized_db_id.startswith(normalized_q)
            )
            
            if matches_text or matches_clann_id:
                filtered_docs.append(doc)
        return filtered_docs
    else:
        docs = await db.events.find(query, {"_id": 0}).sort("event_date", 1).to_list(500)
        return docs

@api_router.get("/events/{event_id}")
async def get_event(event_id: str):
    doc = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    if "skills" in doc and isinstance(doc["skills"], list):
        doc["skills"] = [normalize_tag(tag) for tag in doc["skills"] if isinstance(tag, str)]
    if "recommended_for" in doc and isinstance(doc["recommended_for"], list):
        doc["recommended_for"] = [normalize_tag(tag) for tag in doc["recommended_for"] if isinstance(tag, str)]
    return doc


@api_router.get("/events/{event_id}/related")
async def related_events(event_id: str, limit: int = 3):
    doc = await db.events.find_one({"event_id": event_id}, {"_id": 0, "category": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    query: dict = {"event_id": {"$ne": event_id}}
    if doc.get("category"):
        query["category"] = doc["category"]
    safe_limit = max(1, min(limit, 12))
    docs = await db.events.find(query, {"_id": 0}).sort("event_date", 1).to_list(safe_limit)
    return docs

async def find_duplicate_event(title: str):
    """Return the first event whose title matches `title` (case/whitespace-insensitive)."""
    normalized_title = normalize_event_title(title)
    return await db.events.find_one(
        {
            "$expr": {
                "$eq": [
                    {
                        "$toLower": {
                            "$trim": {
                                "input": {"$ifNull": ["$title", ""]}
                            }
                        }
                    },
                    normalized_title,
                ]
            }
        },
        {"_id": 0, "event_id": 1},
    )


async def prepare_event_doc(
    *,
    title, category, mode, short_description, full_description, image_url,
    location, city, event_date, start_time, end_time, registration_deadline,
    is_paid=False, price=None, total_seats=0, seats_left=None,
    external_link="", skills=None, recommended_for=None,
    featured=False, is_government=False, homepage_category=None,
):
    """Build (but do NOT insert) a fully-formed event document.

    Shared by the admin create-event endpoint and the approval of a public
    organizer submission, so both paths produce identical event records:
    clann_event_id, auto-generated skills/recommended_for tags, seats_left
    defaulting to total_seats, and a UTC created_at timestamp.
    """
    event_id = f"evt_{uuid.uuid4().hex[:10]}"
    doc = {
        "event_id": event_id,
        "title": title,
        "category": category,
        "mode": mode,
        "short_description": short_description,
        "full_description": full_description,
        "image_url": image_url or "",
        "location": location,
        "city": city,
        "event_date": event_date,
        "start_time": start_time,
        "end_time": end_time,
        "registration_deadline": registration_deadline or event_date,
        "is_paid": bool(is_paid),
        "price": price,
        "total_seats": total_seats or 0,
        "seats_left": seats_left,
        "external_link": external_link,
        "skills": skills or [],
        "recommended_for": recommended_for or [],
        "featured": bool(featured),
        "is_government": bool(is_government),
        "homepage_category": homepage_category,
    }

    # Auto-generate skills / recommended_for tags only when the caller
    # hasn't provided them. Bulk Excel import posts each row through
    # create_event, so imported events get tags on the same path.
    auto_skills, auto_recs = generate_event_tags(title, category, short_description)
    if not doc.get("skills"):
        doc["skills"] = auto_skills
    if not doc.get("recommended_for"):
        doc["recommended_for"] = auto_recs

    clann_event_id = generate_event_id(title, category)
    # Retry on the (rare) chance the random suffix collides with an existing ID.
    while await db.events.find_one(
        {"clann_event_id": clann_event_id}, {"_id": 0, "clann_event_id": 1}
    ):
        clann_event_id = generate_event_id(title, category)
    doc["clann_event_id"] = clann_event_id
    if doc.get("seats_left") is None:
        doc["seats_left"] = doc.get("total_seats", 0)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    return doc


@api_router.post("/events")
async def create_event(payload: EventCreate, _=Depends(require_admin)):
    existing = await find_duplicate_event(payload.title)
    if existing:
        return JSONResponse(
            status_code=409,
            content={
                "error": "duplicate",
                "message": "An event with this title already exists",
                "existing_event_id": existing.get("event_id"),
            },
        )

    doc = await prepare_event_doc(**payload.model_dump())
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, payload: EventUpdate, _=Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.events.update_one({"event_id": event_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    doc = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    return doc

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, _=Depends(require_admin)):
    res = await db.events.delete_one({"event_id": event_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True}

@api_router.delete("/events")
async def delete_all_events(_=Depends(require_admin)):
    # One-click wipe of every event — equivalent to deleting each event
    # individually via DELETE /events/{event_id}. Admin-only.
    res = await db.events.delete_many({})
    return {"ok": True, "deleted": res.deleted_count}


@api_router.post("/admin/events/{event_id}/generate-tags")
async def admin_generate_tags(event_id: str, _=Depends(require_admin)):
    """Regenerate skills + recommended_for tags for an existing event and persist them."""
    doc = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found")
    skills, recs = generate_event_tags(
        doc.get("title", ""), doc.get("category", ""), doc.get("short_description", "")
    )
    await db.events.update_one(
        {"event_id": event_id},
        {"$set": {"skills": skills, "recommended_for": recs}},
    )
    return {"ok": True, "skills": skills, "recommended_for": recs}

# -----------------------------
# Save / Bookmark
# -----------------------------
@api_router.post("/events/{event_id}/save")
async def save_event(event_id: str, user=Depends(require_user)):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.saved_events.update_one(
        {"user_id": user["user_id"], "event_id": event_id},
        {"$set": {"user_id": user["user_id"], "event_id": event_id,
                  "saved_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}

@api_router.delete("/events/{event_id}/save")
async def unsave_event(event_id: str, user=Depends(require_user)):
    await db.saved_events.delete_one({"user_id": user["user_id"], "event_id": event_id})
    return {"ok": True}

@api_router.get("/saved")
async def get_saved(user=Depends(require_user)):
    docs = await db.saved_events.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    ids = [d["event_id"] for d in docs]
    if not ids:
        return []
    events = await db.events.find({"event_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    return events

# -----------------------------
# Registered events (calendar tracking)
# -----------------------------
@api_router.post("/events/{event_id}/register")
async def register_event(event_id: str, user=Depends(require_user)):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.registered_events.update_one(
        {"user_id": user["user_id"], "event_id": event_id},
        {"$set": {
            "user_id": user["user_id"],
            "event_id": event_id,
            "event_date": event["event_date"],
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True}

@api_router.get("/registered")
async def get_registered(user=Depends(require_user)):
    docs = await db.registered_events.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    ids = [d["event_id"] for d in docs]
    if not ids:
        return []
    events = await db.events.find({"event_id": {"$in": ids}}, {"_id": 0}).to_list(500)
    return events

# -----------------------------
# Per-event WhatsApp reminder preference
# -----------------------------
@api_router.post("/events/{event_id}/reminder-toggle")
async def event_reminder_toggle(event_id: str, payload: EventReminderToggle, user=Depends(require_user)):
    if payload.enabled:
        await db.event_reminders.update_one(
            {"user_id": user["user_id"], "event_id": event_id},
            {"$set": {
                "user_id": user["user_id"],
                "event_id": event_id,
                "enabled": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
    else:
        await db.event_reminders.delete_one({"user_id": user["user_id"], "event_id": event_id})
    return {"ok": True, "enabled": payload.enabled}

@api_router.get("/reminder-prefs")
async def reminder_prefs(user=Depends(require_user)):
    docs = await db.event_reminders.find(
        {"user_id": user["user_id"], "enabled": True}, {"_id": 0}
    ).to_list(500)
    return [d["event_id"] for d in docs]

# -----------------------------
# Feedback
# -----------------------------
@api_router.post("/feedback")
async def submit_feedback(payload: FeedbackCreate, user=Depends(require_user)):
    if payload.star_rating < 1 or payload.star_rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    text = (payload.feedback_text or "").strip()[:300]
    doc = {
        "feedback_id": f"fb_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "star_rating": payload.star_rating,
        "feedback_text": text,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedback.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/admin/feedback")
async def admin_feedback(_=Depends(require_admin)):
    docs = await db.feedback.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return docs

# -----------------------------
# Organizer Submissions (public form + admin approval queue)
# -----------------------------
@api_router.post("/submissions")
async def create_organizer_submission(payload: OrganizerSubmissionCreate):
    """Public endpoint — anyone can propose an event for Clann.

    The submission lands in the `submissions` collection with status
    `pending` and is only visible on the site after an admin approves it
    (which creates a real event in the `events` collection).
    """
    if not payload.event_date or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", payload.event_date.strip()):
        raise HTTPException(status_code=400, detail="event_date must be in YYYY-MM-DD format")
    submission_id = f"sub_{uuid.uuid4().hex[:10]}"
    doc = {
        "submission_id": submission_id,
        "status": "pending",
        "organizer_name": payload.organizer_name.strip(),
        "organizer_email": payload.organizer_email.strip().lower(),
        "organizer_phone": (payload.organizer_phone or "").strip(),
        "title": payload.title.strip(),
        "category": payload.category,
        "mode": payload.mode,
        "short_description": payload.short_description.strip(),
        "full_description": (payload.full_description or "").strip(),
        "image_url": (payload.image_url or "").strip(),
        "location": (payload.location or "").strip(),
        "city": (payload.city or "").strip(),
        "event_date": payload.event_date.strip(),
        "start_time": payload.start_time,
        "end_time": payload.end_time,
        "registration_deadline": (payload.registration_deadline or "").strip(),
        "is_paid": bool(payload.is_paid),
        "price": payload.price,
        "total_seats": payload.total_seats or 0,
        "external_link": (payload.external_link or "").strip(),
        "notes": (payload.notes or "").strip(),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.submissions.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/submissions/{submission_id}/status")
async def submission_status(submission_id: str, email: str):
    """Public status lookup — only reveals info when the email matches the submitter."""
    doc = await db.submissions.find_one(
        {"submission_id": submission_id, "organizer_email": email.strip().lower()},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {
        "submission_id": doc["submission_id"],
        "status": doc["status"],
        "title": doc.get("title", ""),
        "reject_reason": doc.get("reject_reason"),
        "admin_note": doc.get("admin_note"),
        "created_event_id": doc.get("created_event_id"),
        "submitted_at": doc.get("submitted_at"),
    }

@api_router.get("/submissions/mine")
async def my_submissions(user=Depends(require_user)):
    email = (user.get("email") or "").strip().lower()
    if not email:
        return []
    docs = await db.submissions.find({"organizer_email": email}, {"_id": 0}).sort("submitted_at", -1).to_list(100)
    return docs

@api_router.get("/admin/submissions")
async def admin_list_submissions(status: Optional[str] = None, _=Depends(require_admin)):
    query = {}
    if status in ("pending", "approved", "rejected"):
        query["status"] = status
    docs = await db.submissions.find(query, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return docs

@api_router.post("/admin/submissions/{submission_id}/approve")
async def approve_submission(submission_id: str, _=Depends(require_admin)):
    """Approve a pending submission — creates a live event exactly like the admin form would."""
    sub = await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Submission already processed")
    duplicate = await find_duplicate_event(sub.get("title", ""))
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                "An event with this title already exists "
                f"(event_id {duplicate.get('event_id')}). "
                "Reject the submission or rename the event first."
            ),
        )
    event = await prepare_event_doc(
        title=sub["title"],
        category=sub["category"],
        mode=sub["mode"],
        short_description=sub["short_description"],
        full_description=sub.get("full_description", ""),
        image_url=sub["image_url"],
        location=sub.get("location", ""),
        city=sub.get("city", ""),
        event_date=sub["event_date"],
        start_time=sub["start_time"],
        end_time=sub["end_time"],
        registration_deadline=sub.get("registration_deadline") or sub["event_date"],
        is_paid=bool(sub.get("is_paid")),
        price=sub.get("price"),
        total_seats=sub.get("total_seats") or 0,
        external_link=sub.get("external_link", ""),
    )
    await db.events.insert_one(event)
    event.pop("_id", None)
    await db.submissions.update_one(
        {"submission_id": submission_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "created_event_id": event["event_id"],
        }},
    )
    return {
        "ok": True,
        "status": "approved",
        "submission_id": submission_id,
        "event": event,
    }

@api_router.post("/admin/submissions/{submission_id}/reject")
async def reject_submission(submission_id: str, payload: SubmissionReject, _=Depends(require_admin)):
    sub = await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.get("status") != "pending":
        raise HTTPException(status_code=409, detail="Submission already processed")
    reason = (payload.reason or "").strip()
    await db.submissions.update_one(
        {"submission_id": submission_id},
        {"$set": {
            "status": "rejected",
            "reject_reason": reason,
            "rejected_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "status": "rejected", "submission_id": submission_id, "reason": reason}

@api_router.post("/admin/submissions/{submission_id}/note")
async def note_submission(submission_id: str, payload: SubmissionReject, _=Depends(require_admin)):
    sub = await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    note = (payload.reason or "").strip()
    await db.submissions.update_one(
        {"submission_id": submission_id},
        {"$set": {"admin_note": note}},
    )
    return {"ok": True, "admin_note": note}

@api_router.delete("/admin/submissions/{submission_id}")
async def delete_submission(submission_id: str, _=Depends(require_admin)):
    res = await db.submissions.delete_one({"submission_id": submission_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"ok": True}

# -----------------------------
# WhatsApp Reminder (collect only)
# -----------------------------
@api_router.post("/events/{event_id}/whatsapp-remind")
async def whatsapp_remind(event_id: str, payload: WhatsAppReminder, user=Depends(require_user)):
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.reminders.insert_one({
        "event_id": event_id,
        "phone": payload.phone,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}

# -----------------------------
# Seed
# -----------------------------
# NOTE: seed demo events deliberately store image_url as "" — stock/Unsplash
# URLs must NEVER be persisted as an event's primary image. The frontend
# fallback pool (frontend/src/lib/image-fallback.js) provides render-time
# imagery when image_url is empty.
SEED_EVENTS = [
    {
        "title": "Graphic Design Workshop",
        "category": "Workshop",
        "mode": "Offline",
        "short_description": "Hands-on session covering Graphic Design fundamentals, Color Theory & Communication.",
        "full_description": "Learn how every business communicates visually. This hands-on workshop covers Graphic Design fundamentals, Color Theory, and Communication design. You'll leave with a portfolio-ready project.",
        "image_url": "",
        "location": "Indiranagar, Bengaluru",
        "city": "Bangalore",
        "event_date": "2026-05-25",
        "start_time": "12:00",
        "end_time": "16:00",
        "registration_deadline": "2026-04-29",
        "is_paid": False,
        "price": None,
        "total_seats": 40,
        "seats_left": 40,
        "external_link": "https://example.com/register/graphic-design",
        "skills": ["Graphic Design", "Color Theory", "Communication"],
        "recommended_for": ["Students", "Beginner Designers"],
        "featured": True,
    },
    {
        "title": "The Social UX Hackathon",
        "category": "Hackathon",
        "mode": "Offline",
        "short_description": "Brainstorm innovative UX solutions to real social problems. Team-based, open to all levels.",
        "full_description": "Brainstorm innovative UX solutions to tackle real social problems. Team-based, open to all skill levels. Mentors from top design studios will be present.",
        "image_url": "",
        "location": "Rohini, Delhi",
        "city": "Delhi",
        "event_date": "2026-04-29",
        "start_time": "10:00",
        "end_time": "18:00",
        "registration_deadline": "2026-04-25",
        "is_paid": False,
        "price": None,
        "total_seats": 32,
        "seats_left": 32,
        "external_link": "https://example.com/register/social-ux",
        "skills": ["UX Research", "Prototyping", "Problem Solving"],
        "recommended_for": ["Students", "Designers", "Developers"],
        "featured": True,
    },
    {
        "title": "Jewelry Making Workshop",
        "category": "Workshop",
        "mode": "Offline",
        "short_description": "A hands-on session exploring traditional and contemporary jewelry design techniques.",
        "full_description": "A hands-on session exploring traditional and contemporary jewelry design techniques. All materials are provided, take home your very own piece.",
        "image_url": "",
        "location": "Rohini, Delhi",
        "city": "Delhi",
        "event_date": "2026-05-02",
        "start_time": "11:00",
        "end_time": "15:00",
        "registration_deadline": "2026-04-29",
        "is_paid": False,
        "price": None,
        "total_seats": 21,
        "seats_left": 21,
        "external_link": "https://example.com/register/jewelry",
        "skills": ["Craft", "Design Thinking", "Handwork"],
        "recommended_for": ["All"],
        "featured": False,
    },
]

@app.on_event("startup")
async def seed_events():
    await repair_excel_event_dates()
    count = await db.events.count_documents({})
    if count == 0:
        for ev in SEED_EVENTS:
            ev = dict(ev)
            ev["event_id"] = f"evt_{uuid.uuid4().hex[:10]}"
            ev["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.events.insert_one(ev)
        logger.info("Seeded %d events", len(SEED_EVENTS))


async def repair_excel_event_dates():
    cursor = db.events.find({"event_date": {"$regex": r"^\d+$"}}, {"_id": 0, "event_id": 1, "event_date": 1, "registration_deadline": 1})
    async for doc in cursor:
        fixed_date = excel_serial_to_iso(doc.get("event_date", ""))
        if not fixed_date:
            continue
        update = {"event_date": fixed_date}
        deadline = doc.get("registration_deadline")
        if deadline and re.fullmatch(r"\d+", str(deadline).strip()):
            fixed_deadline = excel_serial_to_iso(str(deadline))
            if fixed_deadline:
                update["registration_deadline"] = fixed_deadline
        await db.events.update_one({"event_id": doc["event_id"]}, {"$set": update})
        logger.info("Repaired Excel-serial dates for event %s", doc["event_id"])

@api_router.get("/")
async def root():
    return {"message": "Clann API is running"}


@api_router.get("/health")
async def health():
    return {"status": "ok"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
