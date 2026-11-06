import base64
import hmac
import hashlib
import time
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, status
from src.config import SCOREBOARD_SECRET
from src.database import get_player_by_id


def generate_player_token(player_id: int, username: str) -> str:
    """Generate a tamper-proof HMAC-signed token for a player."""
    timestamp = int(time.time())
    payload = f"{player_id}:{username}:{timestamp}"
    signature = hmac.new(
        SCOREBOARD_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    raw = f"{payload}:{signature}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8")


def parse_player_token(token_str: str) -> Optional[int]:
    """Verify player token signature and return player_id if valid."""
    try:
        raw = base64.urlsafe_b64decode(token_str.encode("utf-8")).decode("utf-8")
        parts = raw.split(":")
        if len(parts) != 4:
            return None
        
        player_id_str, username, timestamp_str, sig = parts
        player_id = int(player_id_str)
        payload = f"{player_id_str}:{username}:{timestamp_str}"
        expected_sig = hmac.new(
            SCOREBOARD_SECRET.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        if hmac.compare_digest(sig, expected_sig):
            return player_id
        return None
    except Exception:
        return None


async def get_current_player_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Extract and authenticate current player from headers or cookies (optional)."""
    token = None
    
    # 1. Header X-Player-Token
    if "X-Player-Token" in request.headers:
        token = request.headers["X-Player-Token"].strip()
    
    # 2. Authorization header: Bearer <token>
    elif "Authorization" in request.headers:
        auth_header = request.headers["Authorization"].strip()
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            
    # 3. Cookie fallback
    elif "player_session" in request.cookies:
        token = request.cookies["player_session"].strip()
    elif "player_token" in request.cookies:
        token = request.cookies["player_token"].strip()

    if not token:
        return None

    player_id = parse_player_token(token)
    if player_id is None:
        return None

    return get_player_by_id(player_id)


async def get_current_player(request: Request) -> Dict[str, Any]:
    """Extract and authenticate current player (raises 401 if not authenticated)."""
    player = await get_current_player_optional(request)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Player registration or login required. Please register your handle first."
        )
    return player
