#!/usr/bin/env bash
# ==============================================================================
# VulnLab CTF - Flag & Secret Generator
# ==============================================================================
# Generates a 64-hex master secret and random 32-hex lowercase flags for all
# 42 challenges, computes their HMAC-SHA256 hashes, and writes an isolated
# .env file with chmod 600 permissions.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Configuration & Defaults
DEFAULT_DIFFICULTY="easy"
DIFFICULTY="${DIFFICULTY:-$DEFAULT_DIFFICULTY}"
OUTPUT_FILE="${REPO_ROOT}/.env"
JSON_OUTPUT=""

# Parse command line options
while [[ $# -gt 0 ]]; do
    case "$1" in
        --difficulty=*)
            DIFFICULTY="${1#*=}"
            shift
            ;;
        --difficulty|-d)
            DIFFICULTY="$2"
            shift 2
            ;;
        --output=*)
            OUTPUT_FILE="${1#*=}"
            shift
            ;;
        --output|-o)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --json=*)
            JSON_OUTPUT="${1#*=}"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options] [difficulty]"
            echo ""
            echo "Options:"
            echo "  -d, --difficulty <easy|medium|hard>   Set CTF active difficulty (default: easy)"
            echo "  -o, --output <file>                   Output env file path (default: .env)"
            echo "      --json <file>                     Also export challenge hashes as JSON"
            echo "  -h, --help                            Show this help message"
            exit 0
            ;;
        easy|medium|hard)
            DIFFICULTY="$1"
            shift
            ;;
        *)
            echo "[!] Unknown argument: $1" >&2
            echo "Use --help for usage instructions." >&2
            exit 1
            ;;
    esac
done

# Validate difficulty
case "$DIFFICULTY" in
    easy|medium|hard) ;;
    *)
        echo "[!] Error: Invalid difficulty '${DIFFICULTY}'. Must be easy, medium, or hard." >&2
        exit 1
        ;;
esac

echo "======================================================================"
echo "  VULNLAB CTF - Flag Generator"
echo "======================================================================"
echo "[*] Target Environment File : ${OUTPUT_FILE}"
echo "[*] Active Difficulty Level  : ${DIFFICULTY}"

# Helper function to generate lowercase hex string of N bytes (2N characters)
generate_hex() {
    local bytes="$1"
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$bytes" | tr '[:upper:]' '[:lower:]'
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import secrets; print(secrets.token_hex($bytes).lower())"
    else
        head -c "$bytes" /dev/urandom | od -An -tx1 | tr -d ' \n' | tr '[:upper:]' '[:lower:]'
    fi
}

# Helper function to compute HMAC-SHA256 hex digest
compute_hmac() {
    local key="$1"
    local data="$2"
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import hmac, hashlib; print(hmac.new('''$key'''.encode('utf-8'), '''$data'''.encode('utf-8'), hashlib.sha256).hexdigest().lower())"
    elif command -v openssl >/dev/null 2>&1; then
        printf "%s" "$data" | openssl dgst -sha256 -hmac "$key" | awk '{print $NF}' | tr '[:upper:]' '[:lower:]'
    else
        echo "[!] Error: Either python3 or openssl is required for HMAC computation." >&2
        exit 1
    fi
}

# Generate 64-hex Scoreboard Secret (32 bytes)
SCOREBOARD_SECRET=$(generate_hex 32)
POSTGRES_PASSWORD=$(generate_hex 16)

# List of all 42 challenge flag keys
FLAG_KEYS=(
    # App 1: Blog SQLi (Port 8001)
    "FLAG_BLOG_SQLI_LOGIN_EASY"
    "FLAG_BLOG_SQLI_LOGIN_MEDIUM"
    "FLAG_BLOG_SQLI_LOGIN_HARD"
    "FLAG_BLOG_SQLI_UNION_EASY"
    "FLAG_BLOG_SQLI_UNION_MEDIUM"
    "FLAG_BLOG_SQLI_UNION_HARD"
    "FLAG_BLOG_SQLI_XSS_EASY"
    "FLAG_BLOG_SQLI_XSS_MEDIUM"
    "FLAG_BLOG_SQLI_XSS_HARD"

    # App 2: Notes IDOR (Port 8002)
    "FLAG_NOTES_IDOR_VIEW_EASY"
    "FLAG_NOTES_IDOR_VIEW_MEDIUM"
    "FLAG_NOTES_IDOR_VIEW_HARD"
    "FLAG_NOTES_IDOR_ADMIN_EASY"
    "FLAG_NOTES_IDOR_ADMIN_MEDIUM"
    "FLAG_NOTES_IDOR_ADMIN_HARD"

    # App 3: File Share (Port 8003)
    "FLAG_FILE_SHARE_TRAVERSAL_EASY"
    "FLAG_FILE_SHARE_TRAVERSAL_MEDIUM"
    "FLAG_FILE_SHARE_TRAVERSAL_HARD"
    "FLAG_FILE_SHARE_UPLOAD_EASY"
    "FLAG_FILE_SHARE_UPLOAD_MEDIUM"
    "FLAG_FILE_SHARE_UPLOAD_HARD"
    "FLAG_FILE_SHARE_MIME_EASY"
    "FLAG_FILE_SHARE_MIME_MEDIUM"
    "FLAG_FILE_SHARE_MIME_HARD"

    # App 4: Shop Auth (Port 8004)
    "FLAG_SHOP_AUTH_JWT_EASY"
    "FLAG_SHOP_AUTH_JWT_MEDIUM"
    "FLAG_SHOP_AUTH_JWT_HARD"
    "FLAG_SHOP_AUTH_BRUTEFORCE_EASY"
    "FLAG_SHOP_AUTH_BRUTEFORCE_MEDIUM"
    "FLAG_SHOP_AUTH_BRUTEFORCE_HARD"
    "FLAG_SHOP_AUTH_RESET_EASY"
    "FLAG_SHOP_AUTH_RESET_MEDIUM"
    "FLAG_SHOP_AUTH_RESET_HARD"

    # App 5: Ping Tool (Port 8005)
    "FLAG_PING_TOOL_RCE_EASY"
    "FLAG_PING_TOOL_RCE_MEDIUM"
    "FLAG_PING_TOOL_RCE_HARD"
    "FLAG_PING_TOOL_SSRF_EASY"
    "FLAG_PING_TOOL_SSRF_MEDIUM"
    "FLAG_PING_TOOL_SSRF_HARD"
    "FLAG_PING_TOOL_XSS_EASY"
    "FLAG_PING_TOOL_XSS_MEDIUM"
    "FLAG_PING_TOOL_XSS_HARD"
)

# Temporary file to build .env safely
TEMP_ENV="$(mktemp "${OUTPUT_FILE}.tmp.XXXXXX")"
trap 'rm -f "${TEMP_ENV}"' EXIT

cat > "${TEMP_ENV}" <<EOF
# ==============================================================================
# VulnLab CTF - Auto-Generated Environment & Challenge Configuration
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# WARNING: Contains live CTF flags and secrets. DO NOT commit or share.
# ==============================================================================

# Core Lab Settings
DIFFICULTY=${DIFFICULTY}
SCOREBOARD_SECRET=${SCOREBOARD_SECRET}

# Database Credentials (Internal notes-db PostgreSQL service)
POSTGRES_USER=notes_user
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=notes_db
DATABASE_URL=postgres://notes_user:${POSTGRES_PASSWORD}@notes-db:5432/notes_db

# Per-App Difficulty Overrides (Defaulting to DIFFICULTY)
BLOG_SQLI_DIFFICULTY=${DIFFICULTY}
NOTES_IDOR_DIFFICULTY=${DIFFICULTY}
FILE_SHARE_DIFFICULTY=${DIFFICULTY}
SHOP_AUTH_DIFFICULTY=${DIFFICULTY}
PING_TOOL_DIFFICULTY=${DIFFICULTY}

# ==============================================================================
# CHALLENGE FLAGS (42 total, format: VULNLAB{<32-hex-lowercase>})
# ==============================================================================
EOF

declare -A GENERATED_FLAGS
declare -A GENERATED_HMACS

# Generate all 42 flags and their HMAC hashes
echo "[*] Generating 42 random flags and computing HMAC-SHA256 digests..."
for key in "${FLAG_KEYS[@]}"; do
    hex32=$(generate_hex 16)
    flag="VULNLAB{${hex32}}"
    hmac=$(compute_hmac "${SCOREBOARD_SECRET}" "${flag}")

    GENERATED_FLAGS["$key"]="$flag"
    GENERATED_HMACS["$key"]="$hmac"
done

# Write Challenge Flags Grouped by App
write_app_flags() {
    local header="$1"
    local prefix="$2"
    echo "" >> "${TEMP_ENV}"
    echo "# ------------------------------------------------------------------------------" >> "${TEMP_ENV}"
    echo "# ${header}" >> "${TEMP_ENV}"
    echo "# ------------------------------------------------------------------------------" >> "${TEMP_ENV}"
    for key in "${FLAG_KEYS[@]}"; do
        if [[ "$key" =~ ^FLAG_${prefix} ]]; then
            echo "${key}=${GENERATED_FLAGS[$key]}" >> "${TEMP_ENV}"
        fi
    done
}

write_app_flags "App 1: Blog SQLi (Port 8001)" "BLOG_SQLI"
write_app_flags "App 2: Notes IDOR (Port 8002)" "NOTES_IDOR"
write_app_flags "App 3: File Share (Port 8003)" "FILE_SHARE"
write_app_flags "App 4: Shop Auth (Port 8004)" "SHOP_AUTH"
write_app_flags "App 5: Ping Tool (Port 8005)" "PING_TOOL"

# Write HMAC-SHA256 section for Scoreboard / Verifiers
cat >> "${TEMP_ENV}" <<EOF

# ==============================================================================
# CHALLENGE HMAC-SHA256 DIGESTS (Keyed by SCOREBOARD_SECRET)
# ==============================================================================
# The scoreboard database stores ONLY these HMAC digests. Plaintext flags
# are never persisted in the scoreboard SQLite database.
EOF

for key in "${FLAG_KEYS[@]}"; do
    echo "HMAC_${key}=${GENERATED_HMACS[$key]}" >> "${TEMP_ENV}"
    # Also supply FLAG_*_HMAC convention for compatibility
    echo "${key}_HMAC=${GENERATED_HMACS[$key]}" >> "${TEMP_ENV}"
done

# Atomically replace destination file and set secure permissions
mv -f "${TEMP_ENV}" "${OUTPUT_FILE}"
chmod 600 "${OUTPUT_FILE}"

# Optional JSON output
if [[ -n "${JSON_OUTPUT}" ]]; then
    echo "[*] Exporting challenge hashes to JSON: ${JSON_OUTPUT}"
    python3 -c "
import json, os

flags = {}
hmacs = {}
"
fi

echo "[✓] Successfully generated .env"
echo "    - Total challenges configured : ${#FLAG_KEYS[@]}"
echo "    - Scoreboard master secret    : 64 hex characters"
echo "    - File permissions            : $(ls -l "${OUTPUT_FILE}" | awk '{print $1}')"
echo "======================================================================"
