import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = Path(__file__).resolve().parent
STATIC_DIR = SRC_DIR / "static"

# Scoreboard secret key used for HMAC-SHA256 flag hashing and admin token
SCOREBOARD_SECRET = os.environ.get("SCOREBOARD_SECRET", "vulnlab_scoreboard_secret_key_default_2026")

# Database path (can be overridden via env var)
DATABASE_PATH = os.environ.get("DATABASE_PATH", str(BASE_DIR / "scoreboard.db"))

# Challenges JSON file
CHALLENGES_FILE = os.environ.get("CHALLENGES_FILE", str(BASE_DIR / "challenges.json"))

# Apps root directory to scan for app-specific challenges.json if present
APPS_DIR = os.environ.get("APPS_DIR", str(BASE_DIR.parent / "apps"))

# Rate limiting settings: 10 flag submissions per minute
RATE_LIMIT_MAX_ATTEMPTS = int(os.environ.get("RATE_LIMIT_MAX_ATTEMPTS", "10"))
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))

# Points configuration
POINTS_BY_DIFFICULTY = {
    "easy": 100,
    "medium": 200,
    "hard": 300
}

# Hint cost percentage (25% per hint)
HINT_COST_PERCENTAGE = 0.25
