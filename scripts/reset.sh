#!/usr/bin/env bash
# ==============================================================================
# VulnLab CTF - Complete Environment Reset Script
# ==============================================================================
# 1. Tears down all containers and deletes named volumes (fresh database state).
# 2. Generates new random flags and master secret in .env.
# 3. Builds and starts clean containers, waiting for healthchecks to pass.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "======================================================================"
echo "  VULNLAB CTF - Full Lab Reset"
echo "======================================================================"
echo "[*] Step 1: Tearing down containers and deleting named volumes..."
docker compose -f "${REPO_ROOT}/docker-compose.yml" down -v

echo ""
echo "[*] Step 2: Generating fresh flags and master secret..."
"${SCRIPT_DIR}/gen-flags.sh" "$@"

echo ""
echo "[*] Step 3: Rebuilding and launching clean environment..."
"${SCRIPT_DIR}/start.sh"
