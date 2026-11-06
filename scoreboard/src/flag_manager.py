import os
import json
import hmac
import hashlib
import glob
from pathlib import Path
from typing import Dict, List, Any, Optional
from src.config import SCOREBOARD_SECRET, CHALLENGES_FILE, APPS_DIR
from src.database import save_challenge_hash, get_challenge_hash

# In-memory challenge definition registry and hash store
_CHALLENGES: Dict[str, Dict[str, Any]] = {}
_CHALLENGE_HASHES: Dict[str, str] = {}


def compute_hmac_sha256(secret: str, data: str) -> str:
    """Calculate HMAC-SHA256 hex digest for flag verification."""
    return hmac.new(
        secret.encode("utf-8"),
        data.strip().encode("utf-8"),
        hashlib.sha256
    ).hexdigest().lower()


def load_challenges_from_disk() -> List[Dict[str, Any]]:
    """
    Load challenge definitions from challenges.json and optionally apps/*/challenges.json.
    Merges challenges with priority given to app-specific files if they exist.
    """
    challenges_by_id: Dict[str, Dict[str, Any]] = {}

    # 1. Load baseline from combined challenges.json
    base_file = Path(CHALLENGES_FILE)
    if base_file.exists():
        try:
            with open(base_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    challenges_by_id[item["id"]] = item
        except Exception as e:
            print(f"[Scoreboard Warning] Failed to read {base_file}: {e}")

    # 2. Check apps directory for apps/*/challenges.json
    apps_path = Path(APPS_DIR)
    if apps_path.exists():
        app_json_files = glob.glob(str(apps_path / "*" / "challenges.json"))
        for ajf in app_json_files:
            try:
                with open(ajf, "r", encoding="utf-8") as f:
                    app_data = json.load(f)
                    for item in app_data:
                        challenges_by_id[item["id"]] = item
            except Exception as e:
                print(f"[Scoreboard Warning] Failed to read app challenge file {ajf}: {e}")

    return list(challenges_by_id.values())


def initialize_flags_and_challenges():
    """
    Initializes challenge registry and stores ONLY HMAC-SHA256 hashes.
    Plaintext flags are NEVER persisted to SQLite, log files, or responses.
    """
    global _CHALLENGES, _CHALLENGE_HASHES
    _CHALLENGES.clear()
    _CHALLENGE_HASHES.clear()

    challenge_list = load_challenges_from_disk()
    if not challenge_list:
        print("[Scoreboard Warning] No challenges found in challenges.json or apps directory.")

    secret = SCOREBOARD_SECRET

    for item in challenge_list:
        c_id = item["id"]
        _CHALLENGES[c_id] = item
        flag_env = item.get("flag_env", "")

        flag_hash = None

        # Check 1: Pre-computed hash in environment
        # e.g., HMAC_<FLAG_ENV>, <FLAG_ENV>_HMAC, FLAG_HASH_<FLAG_ENV>
        if flag_env:
            for env_key in [
                f"HMAC_{flag_env}",
                f"{flag_env}_HMAC",
                f"FLAG_HASH_{flag_env}",
                f"FLAG_HASH_{flag_env.removeprefix('FLAG_')}"
            ]:
                if env_key in os.environ and os.environ[env_key].strip():
                    flag_hash = os.environ[env_key].strip().lower()
                    break

        # Check 2: Plaintext flag in environment -> immediately hash and purge
        if not flag_hash and flag_env and flag_env in os.environ:
            plaintext = os.environ[flag_env].strip()
            if plaintext:
                flag_hash = compute_hmac_sha256(secret, plaintext)
                del plaintext

        # Check 3: Previously stored hash in database
        if not flag_hash:
            db_hash = get_challenge_hash(c_id)
            if db_hash:
                flag_hash = db_hash

        # Check 4: Deterministic fallback hash for standalone / preview runs
        if not flag_hash:
            placeholder_flag = f"VULNLAB{{placeholder_{c_id}}}"
            flag_hash = compute_hmac_sha256(secret, placeholder_flag)
            del placeholder_flag

        # Store HMAC hash into database and in-memory cache
        save_challenge_hash(c_id, flag_hash)
        _CHALLENGE_HASHES[c_id] = flag_hash

    print(f"[Scoreboard] Initialized {len(_CHALLENGES)} challenges with secure HMAC-SHA256 hashes.")


def get_all_challenges() -> List[Dict[str, Any]]:
    """Return all challenge metadata (without internal secrets)."""
    return list(_CHALLENGES.values())


def get_challenge_by_id(challenge_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve challenge metadata by id."""
    return _CHALLENGES.get(challenge_id)


def verify_flag_submission(challenge_id: str, submitted_flag: str) -> bool:
    """
    Verify flag using constant-time comparison of HMAC-SHA256 hex digests.
    Returns True if the submitted flag matches.
    """
    if not submitted_flag or not submitted_flag.strip():
        return False

    stored_hash = _CHALLENGE_HASHES.get(challenge_id) or get_challenge_hash(challenge_id)
    if not stored_hash:
        return False

    submitted_hash = compute_hmac_sha256(SCOREBOARD_SECRET, submitted_flag.strip())
    return hmac.compare_digest(submitted_hash, stored_hash.lower())
