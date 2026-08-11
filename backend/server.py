from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import secrets
import string
import logging
import uuid
import httpx
import jwt
import bcrypt
from pathlib import Path
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
    image_url: str
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
    return {
        "total_events": total_events,
        "total_users": total_users,
        "total_organizers": total_organizers,
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

@api_router.post("/events")
async def create_event(payload: EventCreate, _=Depends(require_admin)):
    normalized_title = normalize_event_title(payload.title)
    existing = await db.events.find_one(
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
    if existing:
        return JSONResponse(
            status_code=409,
            content={
                "error": "duplicate",
                "message": "An event with this title already exists",
                "existing_event_id": existing.get("event_id"),
            },
        )

    event_id = f"evt_{uuid.uuid4().hex[:10]}"
    doc = payload.model_dump()
    doc["event_id"] = event_id

    # Auto-generate skills / recommended_for tags only when the admin
    # hasn't provided them. Bulk Excel import posts each row here too, so
    # imported events get tags on the same path.
    auto_skills, auto_recs = generate_event_tags(
        payload.title, payload.category, payload.short_description
    )
    if not doc.get("skills"):
        doc["skills"] = auto_skills
    if not doc.get("recommended_for"):
        doc["recommended_for"] = auto_recs

    clann_event_id = generate_event_id(payload.title, payload.category)
    # Retry on the (rare) chance the random suffix collides with an existing ID.
    while await db.events.find_one(
        {"clann_event_id": clann_event_id}, {"_id": 0, "clann_event_id": 1}
    ):
        clann_event_id = generate_event_id(payload.title, payload.category)
    doc["clann_event_id"] = clann_event_id
    if doc.get("seats_left") is None:
        doc["seats_left"] = doc.get("total_seats", 0)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
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
SEED_EVENTS = [
    {
        "title": "Graphic Design Workshop",
        "category": "Workshop",
        "mode": "Offline",
        "short_description": "Hands-on session covering Graphic Design fundamentals, Color Theory & Communication.",
        "full_description": "Learn how every business communicates visually. This hands-on workshop covers Graphic Design fundamentals, Color Theory, and Communication design. You'll leave with a portfolio-ready project.",
        "image_url": "https://images.unsplash.com/photo-1498075702571-ecb018f3752d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwyfHxhcnQlMjBza2V0Y2glMjB3b3Jrc2hvcCUyMGdyb3VwfGVufDB8fHx8MTc4NDE4MzIwOHww&ixlib=rb-4.1.0&q=85",
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
        "image_url": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwzfHxwZW9wbGUlMjBjb2RpbmclMjB0b2dldGhlcnxlbnwwfHx8fDE3ODQxODMyMTN8MA&ixlib=rb-4.1.0&q=85",
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
        "image_url": "https://images.unsplash.com/photo-1515187029135-18ee286d815b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwyfHxjcmVhdGl2ZSUyMGRlc2lnbiUyMG1lZXR1cHxlbnwwfHx8fDE3ODQxODMyMDh8MA&ixlib=rb-4.1.0&q=85",
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
