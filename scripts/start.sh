#!/usr/bin/env bash
# ==============================================================================
# VulnLab CTF - Startup and Healthcheck Orchestrator
# ==============================================================================
# Initializes environment, builds images, launches isolated containers,
# and verifies health endpoints for all services.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Ensure all scripts are executable
chmod +x "${SCRIPT_DIR}/"*.sh

# 1. Verify or generate .env file
if [[ ! -f "${REPO_ROOT}/.env" ]]; then
    echo "[*] No .env file found. Running flag & secret generator..."
    "${SCRIPT_DIR}/gen-flags.sh"
fi

# Load active difficulty for display
DIFFICULTY=$(grep -E '^DIFFICULTY=' "${REPO_ROOT}/.env" | cut -d '=' -f2 || echo "easy")

echo "======================================================================"
echo "  VULNLAB CTF - Starting Environment"
echo "======================================================================"
echo "[*] Workspace Directory : ${REPO_ROOT}"
echo "[*] Active Difficulty   : ${DIFFICULTY}"

# 2. Build Docker images
echo "[*] Building Docker containers (docker compose build)..."
docker compose -f "${REPO_ROOT}/docker-compose.yml" build "$@"

# 3. Start services in background
echo "[*] Launching containers in detached mode (docker compose up -d)..."
docker compose -f "${REPO_ROOT}/docker-compose.yml" up -d

# 4. Healthcheck Polling
echo "[*] Waiting for all CTF services to become healthy..."
TIMEOUT=${HEALTH_TIMEOUT:-90}
START_TIME=$(date +%s)

declare -A SERVICES=(
    ["Scoreboard"]="http://127.0.0.1:8000/health"
    ["Blog SQLi"]="http://127.0.0.1:8001/health"
    ["Notes IDOR"]="http://127.0.0.1:8002/health"
    ["File Share"]="http://127.0.0.1:8003/health"
    ["Shop Auth"]="http://127.0.0.1:8004/health"
    ["Ping Tool"]="http://127.0.0.1:8005/health"
)

# Ordered keys for consistent display
ORDERED_SERVICES=("Scoreboard" "Blog SQLi" "Notes IDOR" "File Share" "Shop Auth" "Ping Tool")

check_endpoint() {
    local url="$1"
    if command -v curl >/dev/null 2>&1; then
        curl -s -f -m 2 "$url" >/dev/null 2>&1
    elif command -v python3 >/dev/null 2>&1; then
        python3 -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('$url', timeout=2).getcode() == 200 else 1)" >/dev/null 2>&1
    else
        wget -q -O - --timeout=2 "$url" >/dev/null 2>&1
    fi
}

ALL_HEALTHY=0
while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [[ $ELAPSED -ge $TIMEOUT ]]; then
        break
    fi

    HEALTHY_COUNT=0
    for name in "${ORDERED_SERVICES[@]}"; do
        url="${SERVICES[$name]}"
        if check_endpoint "$url"; then
            HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
        fi
    done

    if [[ $HEALTHY_COUNT -eq ${#ORDERED_SERVICES[@]} ]]; then
        ALL_HEALTHY=1
        break
    fi

    # Check if any container exited unexpectedly
    EXITED=$(docker compose -f "${REPO_ROOT}/docker-compose.yml" ps --status exited -q)
    if [[ -n "$EXITED" ]]; then
        echo ""
        echo "[!] Warning: One or more containers exited unexpectedly during startup:"
        docker compose -f "${REPO_ROOT}/docker-compose.yml" ps --status exited
    fi

    sleep 2
done

if [[ $ALL_HEALTHY -ne 1 ]]; then
    echo ""
    echo "[!] Health check timed out after ${TIMEOUT}s. Diagnostic details:"
    echo "----------------------------------------------------------------------"
    docker compose -f "${REPO_ROOT}/docker-compose.yml" ps
    echo "----------------------------------------------------------------------"
    for name in "${ORDERED_SERVICES[@]}"; do
        url="${SERVICES[$name]}"
        if check_endpoint "$url"; then
            echo "  [✓] ${name} (${url}) is responding"
        else
            echo "  [✗] ${name} (${url}) FAILED to respond"
        fi
    done
    echo "----------------------------------------------------------------------"
    echo "Recent container logs:"
    docker compose -f "${REPO_ROOT}/docker-compose.yml" logs --tail=25
    echo ""
    echo "[!] Exiting due to unhealthy services. Run './scripts/stop.sh' to tear down." >&2
    exit 1
fi

# 5. Success Banner & Service Summary
cat << 'EOF'

 __      __     _       _               _       _____ _____ ______ 
 \ \    / /    | |     | |             | |     / ____|_   _|  ____|
  \ \  / /_   _| |_ __ | |     __ _   _| |__  | |      | | | |__   
   \ \/ /| | | | | '_ \| |    / _` | '_ \ '_ \ | |      | | |  __|  
    \  / | |_| | | | | | |___| (_| | |_) | |_) | |____ _| |_| |     
     \/   \__,_|_|_| |_|______\__,_| .__/|_.__/ \_____|_____|_|     
                                   | |                              
                                   |_|                              

======================================================================
  VULNLAB CTF IS READY FOR ACTION!
======================================================================
  ⚠️  SAFETY WARNING:
  These applications are intentionally vulnerable for educational use.
  All container ports are bound strictly to 127.0.0.1 (localhost).
  NEVER reconfigure ports to 0.0.0.0 or expose them to public networks.
----------------------------------------------------------------------
  SERVICE        PORT   URL                     FOCUS AREA
----------------------------------------------------------------------
  Scoreboard     8000   http://127.0.0.1:8000   Scoreboard & Hint System
  Blog SQLi      8001   http://127.0.0.1:8001   SQLi & Stored XSS
  Notes IDOR     8002   http://127.0.0.1:8002   IDOR & Priv Escalation
  File Share     8003   http://127.0.0.1:8003   Path Traversal & Upload
  Shop Auth      8004   http://127.0.0.1:8004   Broken JWT & Brute Force
  Ping Tool      8005   http://127.0.0.1:8005   Command Injection & SSRF
----------------------------------------------------------------------
EOF
echo "  Active Difficulty : ${DIFFICULTY}"
echo "  To view logs      : docker compose logs -f [service]"
echo "  To stop the lab   : ./scripts/stop.sh"
echo "  To reset lab/flags: ./scripts/reset.sh"
echo "======================================================================"
