import os
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Request, Response, Depends, HTTPException, Header, Query, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from src.config import SCOREBOARD_SECRET, STATIC_DIR, HINT_COST_PERCENTAGE
from src.database import (
    init_db,
    get_or_create_player,
    get_player_by_id,
    is_challenge_solved,
    is_first_blood_available,
    unlock_hint,
    get_player_unlocked_hints,
    get_hint_deductions_for_challenge,
    record_solve,
    get_player_solves,
    get_all_solves_summary,
    get_leaderboard,
    reset_scoreboard
)
from src.flag_manager import (
    initialize_flags_and_challenges,
    get_all_challenges,
    get_challenge_by_id,
    verify_flag_submission
)
from src.rate_limiter import flag_rate_limiter
from src.auth import generate_player_token, get_current_player, get_current_player_optional


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    init_db()
    # Load challenges and compute HMAC-SHA256 hashes
    initialize_flags_and_challenges()
    yield


app = FastAPI(
    title="VulnLab CTF Scoreboard",
    description="Centralized scoreboard for VulnLab CTF practice lab",
    version="1.0.0",
    lifespan=lifespan
)


# ============================================================================
# Request / Response Schemas
# ============================================================================

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=30, description="Player handle")


class SubmitRequest(BaseModel):
    challenge_id: str = Field(..., description="Challenge identifier")
    flag: str = Field(..., description="Submitted flag string (VULNLAB{...})")


class HintRequest(BaseModel):
    challenge_id: str = Field(..., description="Challenge identifier")
    hint_index: int = Field(..., ge=0, le=1, description="Hint index (0 or 1)")


class AdminResetRequest(BaseModel):
    token: Optional[str] = None
    reset_players: Optional[bool] = False


# ============================================================================
# Health Check Endpoints
# ============================================================================

@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok"}


# ============================================================================
# Player Registration & Profile
# ============================================================================

@app.post("/api/register")
def register(req: RegisterRequest, response: Response):
    username = req.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    
    # Simple characters validation
    if not all(c.isalnum() or c in ("_", "-", ".") for c in username):
        raise HTTPException(status_code=400, detail="Username may only contain letters, numbers, hyphens, and underscores.")

    player = get_or_create_player(username)
    token = generate_player_token(player["id"], player["username"])

    # Set player session cookie
    response.set_cookie(
        key="player_session",
        value=token,
        max_age=86400 * 30,  # 30 days
        httponly=False,       # Readable by client JS for sync
        samesite="lax",
        path="/"
    )

    return {
        "id": player["id"],
        "username": player["username"],
        "token": token,
        "message": f"Welcome, {player['username']}!"
    }


@app.get("/api/me")
async def get_me(player: Dict[str, Any] = Depends(get_current_player)):
    solves = get_player_solves(player["id"])
    hints = get_player_unlocked_hints(player["id"])
    leaderboard = get_leaderboard()
    
    # Calculate player rank and score
    rank = None
    total_score = sum(s["points_awarded"] for s in solves)
    first_bloods = sum(1 for s in solves if s["is_first_blood"])

    for item in leaderboard:
        if item["player_id"] == player["id"]:
            rank = item["rank"]
            break

    return {
        "id": player["id"],
        "username": player["username"],
        "score": total_score,
        "rank": rank,
        "solves_count": len(solves),
        "first_bloods_count": first_bloods,
        "solves": solves,
        "unlocked_hints": hints
    }


# ============================================================================
# Challenges Listing
# ============================================================================

@app.get("/api/challenges")
async def list_challenges(player: Optional[Dict[str, Any]] = Depends(get_current_player_optional)):
    challenges = get_all_challenges()
    solves_summary = get_all_solves_summary()

    player_solves: Dict[str, Dict[str, Any]] = {}
    player_hints: Dict[str, List[int]] = {}

    if player:
        for s in get_player_solves(player["id"]):
            player_solves[s["challenge_id"]] = s
        for h in get_player_unlocked_hints(player["id"]):
            player_hints.setdefault(h["challenge_id"], []).append(h["hint_index"])

    result = []
    for c in challenges:
        c_id = c["id"]
        points = c["points"]
        stats = solves_summary.get(c_id, {"solve_count": 0, "first_blood_player": None, "first_blood_time": None})
        
        # Calculate hint costs (25% per hint)
        hint_cost = int(points * HINT_COST_PERCENTAGE)

        # Build available hints structure
        available_hints = []
        raw_hints = c.get("hints", [])
        unlocked_indices = player_hints.get(c_id, [])
        is_solved = c_id in player_solves

        for idx, hint_text in enumerate(raw_hints):
            is_unlocked = (idx in unlocked_indices) or is_solved
            available_hints.append({
                "index": idx,
                "cost": hint_cost,
                "unlocked": is_unlocked,
                # ONLY expose text if player unlocked it or solved challenge
                "text": hint_text if is_unlocked else None
            })

        challenge_data = {
            "id": c_id,
            "app": c["app"],
            "title": c["title"],
            "difficulty": c["difficulty"],
            "points": points,
            "category": c["category"],
            "owasp": c["owasp"],
            "description": c["description"],
            "solve_count": stats["solve_count"],
            "first_blood_player": stats["first_blood_player"],
            "first_blood_time": stats["first_blood_time"],
            "solved": is_solved,
            "points_awarded": player_solves[c_id]["points_awarded"] if is_solved else None,
            "is_first_blood": bool(player_solves[c_id]["is_first_blood"]) if is_solved else False,
            "hints": available_hints
        }
        result.append(challenge_data)

    return result


# ============================================================================
# Hints System
# ============================================================================

@app.post("/api/hint")
async def unlock_challenge_hint(req: HintRequest, player: Dict[str, Any] = Depends(get_current_player)):
    challenge = get_challenge_by_id(req.challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    raw_hints = challenge.get("hints", [])
    if req.hint_index < 0 or req.hint_index >= len(raw_hints):
        raise HTTPException(status_code=400, detail=f"Invalid hint index. Challenge has {len(raw_hints)} hints.")

    player_id = player["id"]
    challenge_id = req.challenge_id

    # If hint 1 is requested, require hint 0 to be unlocked first
    if req.hint_index > 0:
        existing_hints = get_player_unlocked_hints(player_id, challenge_id)
        existing_indices = {h["hint_index"] for h in existing_hints}
        if (req.hint_index - 1) not in existing_indices:
            raise HTTPException(
                status_code=400,
                detail=f"You must unlock Hint {req.hint_index} before unlocking Hint {req.hint_index + 1}."
            )

    hint_cost = int(challenge["points"] * HINT_COST_PERCENTAGE)
    unlock_hint(player_id, challenge_id, req.hint_index, hint_cost)

    return {
        "success": True,
        "challenge_id": challenge_id,
        "hint_index": req.hint_index,
        "cost": hint_cost,
        "hint": raw_hints[req.hint_index],
        "message": f"Hint {req.hint_index + 1} unlocked! ({hint_cost} points penalty upon solve)."
    }


# ============================================================================
# Flag Submission
# ============================================================================

@app.post("/api/submit")
async def submit_flag(
    req: SubmitRequest,
    request: Request,
    player: Dict[str, Any] = Depends(get_current_player)
):
    player_id = player["id"]
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{player_id}:{client_ip}"

    # Rate limiting: Max 10 submissions per minute per player / IP
    allowed, retry_after = flag_rate_limiter.check_and_record(rate_key)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum 10 submissions per minute. Please wait {retry_after} seconds."
        )

    challenge = get_challenge_by_id(req.challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found.")

    # Check if user has already solved this challenge
    if is_challenge_solved(player_id, req.challenge_id):
        return {
            "success": False,
            "already_solved": True,
            "points": 0,
            "is_first_blood": False,
            "message": "Challenge already solved by your account!"
        }

    # Verify HMAC hash of submitted flag against stored HMAC hash
    is_correct = verify_flag_submission(req.challenge_id, req.flag)
    if not is_correct:
        return {
            "success": False,
            "already_solved": False,
            "points": 0,
            "is_first_blood": False,
            "message": "Incorrect flag. Keep trying!"
        }

    # Challenge solved! Determine First Blood and Deductions
    first_blood = is_first_blood_available(req.challenge_id)
    hint_deductions = get_hint_deductions_for_challenge(player_id, req.challenge_id)
    points_awarded = max(0, challenge["points"] - hint_deductions)

    # Record solve in database
    solve_record = record_solve(player_id, req.challenge_id, points_awarded, first_blood)

    message = f"🎉 Correct flag! Awarded {points_awarded} points."
    if first_blood:
        message += " 🩸 FIRST BLOOD ACHIEVED!"
    if hint_deductions > 0:
        message += f" ({hint_deductions} pts deducted for unlocked hints)."

    return {
        "success": True,
        "already_solved": False,
        "points": points_awarded,
        "is_first_blood": first_blood,
        "message": message,
        "solve": solve_record
    }


# ============================================================================
# Leaderboard
# ============================================================================

@app.get("/api/leaderboard")
def leaderboard():
    return get_leaderboard()


# ============================================================================
# Admin Reset
# ============================================================================

def verify_admin_token(token: Optional[str], header_token: Optional[str]):
    candidate = header_token or token
    if not candidate or candidate.strip() != SCOREBOARD_SECRET.strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid or missing admin token."
        )


@app.post("/api/admin/reset")
def admin_reset(
    req: Optional[AdminResetRequest] = None,
    x_admin_token: Optional[str] = Header(None, alias="X-Admin-Token"),
    token: Optional[str] = Query(None)
):
    candidate = (req.token if req and req.token else None) or x_admin_token or token
    verify_admin_token(candidate, None)

    reset_players = req.reset_players if req and req.reset_players else False
    reset_scoreboard(reset_players=reset_players)
    flag_rate_limiter.reset_all()

    return {
        "status": "ok",
        "message": "Scoreboard successfully reset. Solves and hints have been wiped.",
        "players_reset": reset_players
    }


# ============================================================================
# Static Files & SPA UI
# ============================================================================

# Mount static assets
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "VulnLab CTF Scoreboard API is running. UI not found."}
