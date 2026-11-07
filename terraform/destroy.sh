#!/usr/bin/env bash
# ==============================================================================
# VulnLab CTF - Teardown / Destroy Script
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "======================================================================"
echo "  VULNLAB CTF - Infrastructure Teardown"
echo "======================================================================"
echo "⚠️  WARNING: This will destroy the EC2 instance, VPC, Security Groups,"
echo "   and all data on the remote CTF host."
echo "======================================================================"

read -r -p "Are you sure you want to destroy all AWS resources? [y/N] " confirm
if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
    echo "Destruction aborted."
    exit 0
fi

terraform destroy -auto-approve

echo ""
echo "[✓] All AWS resources have been successfully torn down."
