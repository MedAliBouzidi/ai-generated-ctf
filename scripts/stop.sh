#!/usr/bin/env bash
# ==============================================================================
# VulnLab CTF - Teardown Script
# ==============================================================================
# Gracefully stops and removes all VulnLab CTF containers and networks.
# Preserves data volumes unless -v / --volumes is explicitly passed.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================================================"
echo "  VULNLAB CTF - Stopping Containers"
echo "======================================================================"

if docker compose -f "${REPO_ROOT}/docker-compose.yml" down "$@"; then
    echo "[✓] All VulnLab CTF containers and networks stopped successfully."
else
    echo "[!] Error stopping containers." >&2
    exit 1
fi
