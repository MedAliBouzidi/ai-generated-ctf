import os
from pathlib import Path
from fastapi import Request

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
FLAGS_DIR = BASE_DIR / "flags"
PLUGINS_DIR = BASE_DIR / "plugins"

# Ensure runtime directories exist
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
FLAGS_DIR.mkdir(parents=True, exist_ok=True)
PLUGINS_DIR.mkdir(parents=True, exist_ok=True)

# Flags from environment variables with fallback defaults
FLAGS = {
    "traversal_easy": os.environ.get("FLAG_FILE_SHARE_TRAVERSAL_EASY", "VULNLAB{30000000000000000000000000000001}"),
    "traversal_medium": os.environ.get("FLAG_FILE_SHARE_TRAVERSAL_MEDIUM", "VULNLAB{30000000000000000000000000000002}"),
    "traversal_hard": os.environ.get("FLAG_FILE_SHARE_TRAVERSAL_HARD", "VULNLAB{30000000000000000000000000000003}"),
    "upload_easy": os.environ.get("FLAG_FILE_SHARE_UPLOAD_EASY", "VULNLAB{30000000000000000000000000000004}"),
    "upload_medium": os.environ.get("FLAG_FILE_SHARE_UPLOAD_MEDIUM", "VULNLAB{30000000000000000000000000000005}"),
    "upload_hard": os.environ.get("FLAG_FILE_SHARE_UPLOAD_HARD", "VULNLAB{30000000000000000000000000000006}"),
    "mime_easy": os.environ.get("FLAG_FILE_SHARE_MIME_EASY", "VULNLAB{30000000000000000000000000000007}"),
    "mime_medium": os.environ.get("FLAG_FILE_SHARE_MIME_MEDIUM", "VULNLAB{30000000000000000000000000000008}"),
    "mime_hard": os.environ.get("FLAG_FILE_SHARE_MIME_HARD", "VULNLAB{30000000000000000000000000000009}"),
}

DEFAULT_DIFFICULTY = (
    os.environ.get("FILE_SHARE_DIFFICULTY")
    or os.environ.get("DIFFICULTY")
    or "easy"
).lower()
if DEFAULT_DIFFICULTY not in ["easy", "medium", "hard"]:
    DEFAULT_DIFFICULTY = "easy"


def get_difficulty(request: Request) -> str:
    """
    Resolve active difficulty in order:
    1. Query param ?difficulty=...
    2. Header X-Difficulty
    3. Cookie 'difficulty'
    4. Environment variable default
    """
    param = request.query_params.get("difficulty")
    if param and param.lower() in ["easy", "medium", "hard"]:
        return param.lower()

    header = request.headers.get("X-Difficulty")
    if header and header.lower() in ["easy", "medium", "hard"]:
        return header.lower()

    cookie = request.cookies.get("difficulty")
    if cookie and cookie.lower() in ["easy", "medium", "hard"]:
        return cookie.lower()

    return DEFAULT_DIFFICULTY


def sync_flag_files(difficulty: str):
    """
    Populate flag files on disk so path traversal and XXE can read them.
    Writes:
      - /app/flags/traversal_easy.txt
      - /app/flags/traversal_medium.txt
      - /app/flags/traversal_hard.txt
      - /app/flag_traversal.txt (active traversal flag)
      - /flag_traversal.txt (symlink or copy if writable)
      - /app/flag_mime_hard.txt & /app/flags/mime_hard.txt
      - /app/flag_upload_hard.txt & /app/flags/upload_hard.txt
    """
    # Specific per-level files
    (FLAGS_DIR / "traversal_easy.txt").write_text(FLAGS["traversal_easy"] + "\n")
    (FLAGS_DIR / "traversal_medium.txt").write_text(FLAGS["traversal_medium"] + "\n")
    (FLAGS_DIR / "traversal_hard.txt").write_text(FLAGS["traversal_hard"] + "\n")
    (FLAGS_DIR / "mime_hard.txt").write_text(FLAGS["mime_hard"] + "\n")
    (FLAGS_DIR / "upload_hard.txt").write_text(FLAGS["upload_hard"] + "\n")

    # Hard flag accessible for XXE
    (BASE_DIR / "flag_mime_hard.txt").write_text(FLAGS["mime_hard"] + "\n")
    (BASE_DIR / "flag_upload_hard.txt").write_text(FLAGS["upload_hard"] + "\n")

    # Traversal active flag
    active_traversal_flag = FLAGS.get(f"traversal_{difficulty}", FLAGS["traversal_easy"])
    (BASE_DIR / "flag_traversal.txt").write_text(active_traversal_flag + "\n")

    # Also attempt writing to container root /flag_traversal.txt if permissions allow
    root_flag = Path("/flag_traversal.txt")
    try:
        root_flag.write_text(active_traversal_flag + "\n")
    except Exception:
        pass


# Run initial sync at import time
sync_flag_files(DEFAULT_DIFFICULTY)
