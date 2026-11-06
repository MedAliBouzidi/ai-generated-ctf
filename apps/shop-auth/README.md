# VulnShop - E-Commerce Authentication Lab (`shop-auth`)

## Overview
**VulnShop** is an intentionally vulnerable e-commerce and red team hardware shop built for the **VulnLab CTF** platform. It provides hands-on practice identifying, exploiting, and remediating real-world authentication vulnerabilities, focusing on JSON Web Tokens (JWT), credential brute-forcing with rate-limiting bypasses, and insecure password reset workflows.

## Service Details
- **Port**: `8004` (Container: `8004`, Host: `127.0.0.1:8004`)
- **Base URL**: `http://127.0.0.1:8004`
- **Healthcheck**: `GET /health` -> `{"status": "ok"}`
- **Tech Stack**: Node.js 20, Express, Pure CSS / Vanilla JavaScript SPA
- **OWASP Category**: `A07:2021 - Identification and Authentication Failures`

## Architecture & Features
1. **Interactive Shop Catalog**: Hardware pentesting devices (CyberDecks, SDRs, Rubber Duckies, RF tools).
2. **Authentication System**: User registration, login, JWT token issuance, session tracking.
3. **Executive Management Portal**: Restricted `/api/admin/dashboard` protected by JWT verification.
4. **Password Reset Flow**: Request password reset (`/api/forgot-password`) and token redemption (`/api/reset-password`).
5. **Simulated Email Outbox**: Built-in Mailbox inspector (`/api/emails`) simulating a local Mailhog service for inspecting dispatched password reset emails.
6. **Active Difficulty Switcher**: Dynamic runtime mode badge supporting `easy`, `medium`, and `hard` modes with automatic database re-seeding.

## Challenges & Vulnerabilities

| Challenge ID | Difficulty | Points | Vulnerability Description | Flag Environment Variable |
|---|---|---|---|---|
| `shop-auth-jwt-easy` | Easy | 100 | JWT accepts `"alg": "none"` | `FLAG_SHOP_AUTH_JWT_EASY` |
| `shop-auth-jwt-medium` | Medium | 200 | JWT HMAC signed with weak dictionary key (`"secret123"`) | `FLAG_SHOP_AUTH_JWT_MEDIUM` |
| `shop-auth-jwt-hard` | Hard | 300 | JWT Header Parameter Confusion (`kid` path traversal / embedded `jwk`) | `FLAG_SHOP_AUTH_JWT_HARD` |
| `shop-auth-bruteforce-easy` | Easy | 100 | Administrator account has weak password with no login rate limiting | `FLAG_SHOP_AUTH_BRUTEFORCE_EASY` |
| `shop-auth-bruteforce-medium` | Medium | 200 | Rate limiter blocks after 5 attempts, bypassed via client IP headers (`X-Forwarded-For`) | `FLAG_SHOP_AUTH_BRUTEFORCE_MEDIUM` |
| `shop-auth-bruteforce-hard` | Hard | 300 | Staff user enumeration via timing discrepancies on `/api/login` | `FLAG_SHOP_AUTH_BRUTEFORCE_HARD` |
| `shop-auth-reset-easy` | Easy | 100 | Predictable password reset token generated via `md5(username)` | `FLAG_SHOP_AUTH_RESET_EASY` |
| `shop-auth-reset-medium` | Medium | 200 | Predictable timestamp reset token `sha1(username + timestamp)` | `FLAG_SHOP_AUTH_RESET_MEDIUM` |
| `shop-auth-reset-hard` | Hard | 300 | Host Header Poisoning (`Host` / `X-Forwarded-Host`) in reset email generation | `FLAG_SHOP_AUTH_RESET_HARD` |

## Quick Start (Standalone Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Verification Suite
```bash
node test.js
```

### 3. Start Application
```bash
npm start
```
Navigate to `http://127.0.0.1:8004` in your browser.

## Docker Build & Deployment
The application is containerized using `node:20-alpine` and executed under the non-root `node` user:
```bash
docker build -t vulnlab-shop-auth .
docker run -p 127.0.0.1:8004:8004 -e DIFFICULTY=easy vulnlab-shop-auth
```
