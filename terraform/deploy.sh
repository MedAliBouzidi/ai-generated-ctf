#!/usr/bin/env bash
# ==============================================================================
# VulnLab CTF - Automated AWS Terraform Deployment Script
# ==============================================================================
# Provisions the AWS architecture, launches VulnLab CTF, and outputs all URLs.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo "======================================================================"
echo "  VULNLAB CTF - AWS Infrastructure Deployment"
echo "======================================================================"

# 1. Prerequisite checks
if ! command -v terraform >/dev/null 2>&1; then
    echo "[!] Error: 'terraform' CLI is not installed or not in PATH." >&2
    echo "    Please install Terraform from https://developer.hashicorp.com/terraform/downloads" >&2
    exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
    echo "[!] Warning: 'aws' CLI is not installed. Ensure AWS credentials are configured via environment variables."
fi

# Verify AWS credentials
echo "[*] Checking AWS authentication..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "[!] Warning: Unable to verify AWS credentials using 'aws sts get-caller-identity'."
    echo "    Make sure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (and optionally AWS_SESSION_TOKEN / AWS_REGION)"
    echo "    are exported or configured in ~/.aws/credentials."
    read -r -p "    Do you want to continue anyway? [y/N] " confirm
    if [[ ! "${confirm}" =~ ^[Yy]$ ]]; then
        echo "Aborting deployment."
        exit 1
    fi
else
    CALLER_ARN=$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null || echo "Authenticated")
    echo "[✓] AWS Authentication verified: ${CALLER_ARN}"
fi

# 2. Check for terraform.tfvars
if [[ ! -f "terraform.tfvars" ]]; then
    if [[ -f "terraform.tfvars.example" ]]; then
        echo "[*] No 'terraform.tfvars' found. Copying defaults from 'terraform.tfvars.example'..."
        cp terraform.tfvars.example terraform.tfvars
        echo "[*] Created terraform.tfvars. You can edit this file to customize region, instance type, or IP allowlists."
    fi
fi

# 3. Terraform Init
echo ""
echo "[*] Initializing Terraform..."
terraform init

# 4. Terraform Validate
echo "[*] Validating Terraform configuration..."
terraform validate

# 5. Terraform Plan
echo ""
echo "[*] Generating deployment execution plan..."
terraform plan -out=tfplan

# 6. User confirmation & Apply
echo ""
read -r -p "Do you want to apply this Terraform plan to provision AWS infrastructure? [y/N] " apply_confirm
if [[ ! "${apply_confirm}" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled by user. Exiting."
    rm -f tfplan
    exit 0
fi

echo ""
echo "[*] Applying plan (provisioning VPC, Security Group, and EC2 instance)..."
terraform apply tfplan
rm -f tfplan

# 7. Extract Outputs & URLs
echo ""
echo "======================================================================"
echo "  PROVISIONING SUCCESSFUL - DEPLOYMENT DETAILS & ACCESS URLS"
echo "======================================================================"

PUBLIC_IP=$(terraform output -raw public_ip 2>/dev/null || echo "")
SCOREBOARD_URL=$(terraform output -raw scoreboard_url 2>/dev/null || echo "")
PORTAL_URL=$(terraform output -raw portal_url 2>/dev/null || echo "")

if [[ -z "${PUBLIC_IP}" ]]; then
    echo "[!] Could not retrieve public IP from terraform outputs."
    exit 1
fi

terraform output deployment_summary

echo ""
echo "======================================================================"
echo "  HEALTH & READINESS CHECK"
echo "======================================================================"
echo "[*] The EC2 instance is currently booting and executing cloud-init."
echo "[*] Docker images are being built and containers launched."
echo "[*] This process typically takes ~2 to 3 minutes."
echo ""

read -r -p "Would you like to poll the instance until all services are healthy? [Y/n] " poll_confirm
poll_confirm=${poll_confirm:-Y}

if [[ "${poll_confirm}" =~ ^[Yy]$ ]]; then
    echo "[*] Polling Scoreboard healthcheck at ${PORTAL_URL}/health ..."
    MAX_ATTEMPTS=60
    ATTEMPT=1
    while [[ ${ATTEMPT} -le ${MAX_ATTEMPTS} ]]; do
        if curl -s -f -m 3 "${PORTAL_URL}/health" >/dev/null 2>&1 || curl -s -f -m 3 "http://${PUBLIC_IP}:8000/health" >/dev/null 2>&1; then
            echo ""
            echo "[✓] Scoreboard is healthy and all containers are running!"
            echo "======================================================================"
            echo "  OPEN IN BROWSER TO START PLAYING:"
            echo "  👉 Main Portal: ${PORTAL_URL}"
            echo "  👉 Scoreboard : ${SCOREBOARD_URL}"
            echo "======================================================================"
            exit 0
        fi
        echo -n "."
        sleep 5
        ATTEMPT=$((ATTEMPT + 1))
    done
    echo ""
    echo "[!] Timeout reached while waiting for healthcheck."
    echo "    The instance might still be building Docker images."
    echo "    Check logs via SSH: ssh ubuntu@${PUBLIC_IP} 'tail -f /var/log/vulnlab-user-data.log'"
fi
