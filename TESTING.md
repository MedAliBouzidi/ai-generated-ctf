# VulnLab CTF - Quality Assurance & Verification Report (`TESTING.md`)

**Date of Execution**: November 7, 2026  
**Environment**: Localhost Linux (Docker Engine 29.9.2, Docker Compose 5.6.0)  
**Lead & QA Agents**: Antigravity Automated Verification Suite  

---

## 1. Executive Summary

All 6 services comprising VulnLab CTF (5 intentionally vulnerable applications plus the centralized Scoreboard) have been deployed, hardened, and verified under real-world exploitation conditions.

- **Services Tested**: 6 (`scoreboard`, `blog-sqli`, `notes-idor`, `file-share`, `shop-auth`, `ping-tool`)
- **Total Registered Challenges**: 42
- **Exploited & Captured Flags**: 42 / 42 (100% success rate)
- **Scoreboard Submissions**: 42 / 42 successfully verified and scored
- **Flag Storage Security**: Confirmed zero plaintext flags stored in Scoreboard (HMAC-SHA256 digests only)
- **Host Network Safety**: All services bound exclusively to `127.0.0.1`
- **Container Isolation**: 6 distinct bridge networks; Scoreboard has zero network connectivity to vulnerable apps
- **Privilege Separation**: All app containers run as unprivileged non-root users (`UID 1000`) with memory limits enforced

---

## 2. Complete Challenge Verification Table (42 / 42 Solved)

| App | Challenge ID | Difficulty | Pts | OWASP Mapping | Exploit Methodology | Flag Captured & Verified | Scoreboard Result |
|---|---|---|---|---|---|---|---|
| **blog-sqli** | `blog-sqli-login-easy` | Easy | 100 | `A03:2021-Injection` | SQLi auth bypass: `' OR 1=1--` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **blog-sqli** | `blog-sqli-login-medium` | Medium | 200 | `A03:2021-Injection` | Keyword filter bypass: `admin'/*` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **blog-sqli** | `blog-sqli-login-hard` | Hard | 300 | `A03:2021-Injection` | Space filter bypass: `admin'OR('1'='1')OR''='` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **blog-sqli** | `blog-sqli-union-easy` | Easy | 100 | `A03:2021-Injection` | Direct UNION SELECT extraction from `flags` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **blog-sqli** | `blog-sqli-union-medium` | Medium | 200 | `A03:2021-Injection` | Single-pass keyword strip bypass: `UNUNIONION SELSELECTECT` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **blog-sqli** | `blog-sqli-union-hard` | Hard | 300 | `A03:2021-Injection` | Comment-delimited whitespace bypass: `UNION/**/SELECT` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **blog-sqli** | `blog-sqli-xss-easy` | Easy | 100 | `A03:2021-Injection` | Stored XSS raw injection `<script>` into comments | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **blog-sqli** | `blog-sqli-xss-medium` | Medium | 200 | `A03:2021-Injection` | Tag filter bypass with `<img src=x onerror=...>` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **blog-sqli** | `blog-sqli-xss-hard` | Hard | 300 | `A03:2021-Injection` | Event attribute filter bypass with `<svg/onload=...>` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **notes-idor** | `notes-idor-view-easy` | Easy | 100 | `A01:2021-Broken Access Control` | Sequential numeric IDOR: `GET /api/notes/1` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **notes-idor** | `notes-idor-view-medium` | Medium | 200 | `A01:2021-Broken Access Control` | Base64 IDOR `GET /api/notes/MQ==` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **notes-idor** | `notes-idor-view-hard` | Hard | 300 | `A01:2021-Broken Access Control` | UUID discovery from `/api/activity` & `/api/notes/:uuid` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **notes-idor** | `notes-idor-admin-easy` | Easy | 100 | `A01:2021-Broken Access Control` | Mass Assignment on `PUT /api/users/profile` (`role: admin`) | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **notes-idor** | `notes-idor-admin-medium` | Medium | 200 | `A01:2021-Broken Access Control` | Role header spoofing `X-Role: admin` on `/api/admin/flag` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **notes-idor** | `notes-idor-admin-hard` | Hard | 300 | `A01:2021-Broken Access Control` | Nested metadata assignment `{"metadata": {"role": "admin"}}` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **file-share** | `file-share-traversal-easy` | Easy | 100 | `A01:2021-Broken Access Control` | Path traversal `../../../../app/flag_traversal.txt` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **file-share** | `file-share-traversal-medium` | Medium | 200 | `A01:2021-Broken Access Control` | Non-recursive strip bypass `....//....//app/flag_traversal.txt` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **file-share** | `file-share-traversal-hard` | Hard | 300 | `A01:2021-Broken Access Control` | Prefix escape `uploads/../../app/flag_traversal.txt` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **file-share** | `file-share-upload-easy` | Easy | 100 | `A03:2021-Injection` | Direct `.py` file upload and trigger via `/api/execute` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **file-share** | `file-share-upload-medium` | Medium | 200 | `A03:2021-Injection` | Extension blacklist bypass via uppercase `.PY` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **file-share** | `file-share-upload-hard` | Hard | 300 | `A03:2021-Injection` | Path traversal upload into plugins directory (`/api/plugins/run`) | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **file-share** | `file-share-mime-easy` | Easy | 100 | `A04:2021-Insecure Design` | Client header spoofing: `Content-Type: image/png` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **file-share** | `file-share-mime-medium` | Medium | 200 | `A04:2021-Insecure Design` | Magic byte polyglot: `GIF89a;` header with Python script | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **file-share** | `file-share-mime-hard` | Hard | 300 | `A04:2021-Insecure Design` | XML External Entity (XXE) injection via vector SVG image | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **shop-auth** | `shop-auth-jwt-easy` | Easy | 100 | `A07:2021-Identification & Auth` | Unsecured JWT algorithm `"alg": "none"` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **shop-auth** | `shop-auth-jwt-medium` | Medium | 200 | `A07:2021-Identification & Auth` | Forged token using cracked weak secret `"secret123"` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **shop-auth** | `shop-auth-jwt-hard` | Hard | 300 | `A07:2021-Identification & Auth` | Header parameter injection / `kid: /dev/null` empty secret | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **shop-auth** | `shop-auth-bruteforce-easy` | Easy | 100 | `A07:2021-Identification & Auth` | Unrestricted credential guessing: `admin:admin123` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **shop-auth** | `shop-auth-bruteforce-medium` | Medium | 200 | `A07:2021-Identification & Auth` | Rate limit IP bypass via spoofed `X-Forwarded-For` header | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **shop-auth** | `shop-auth-bruteforce-hard` | Hard | 300 | `A07:2021-Identification & Auth` | Authentication timing attack identifying valid `support` user | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **shop-auth** | `shop-auth-reset-easy` | Easy | 100 | `A07:2021-Identification & Auth` | Predictable password reset token: `md5(username)` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **shop-auth** | `shop-auth-reset-medium` | Medium | 200 | `A07:2021-Identification & Auth` | Timestamp window token prediction: `sha1(username + t)` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **shop-auth** | `shop-auth-reset-hard` | Hard | 300 | `A07:2021-Identification & Auth` | Host header poisoning in password reset email link | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **ping-tool** | `ping-tool-rce-easy` | Easy | 100 | `A03:2021-Injection` | Semicolon command chaining: `127.0.0.1; cat ...` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **ping-tool-medium` | `ping-tool-rce-medium` | Medium | 200 | `A03:2021-Injection` | Newline command separation bypass: `127.0.0.1\ncat ...` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **ping-tool** | `ping-tool-rce-hard` | Hard | 300 | `A03:2021-Injection` | Space & command filter bypass: `\nhead$IFS/app/flags/...` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **ping-tool** | `ping-tool-ssrf-easy` | Easy | 100 | `A10:2021-Server-Side Request Forgery` | Unrestricted local loopback probe to `/internal/status` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **ping-tool** | `ping-tool-ssrf-medium` | Medium | 200 | `A10:2021-Server-Side Request Forgery` | Alternative loopback address bypass: `http://0.0.0.0:8005/` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **ping-tool** | `ping-tool-ssrf-hard` | Hard | 300 | `A10:2021-Server-Side Request Forgery` | Loopback subnet omission bypass: `http://127.0.0.2:8005/` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |
| **ping-tool** | `ping-tool-xss-easy` | Easy | 100 | `A03:2021-Injection` | Reflected input `<script>` reflected via `{{ ... \| safe }}` | `VULNLAB{...}` (Hex-32) | ✅ 100 pts awarded |
| **ping-tool** | `ping-tool-xss-medium` | Medium | 200 | `A03:2021-Injection` | Case-sensitive tag filter bypass: `<img src=x onerror=...>` | `VULNLAB{...}` (Hex-32) | ✅ 200 pts awarded |
| **ping-tool** | `ping-tool-xss-hard` | Hard | 300 | `A03:2021-Injection` | Inline JS string literal boundary breakout: `"; alert(1); //` | `VULNLAB{...}` (Hex-32) | ✅ 300 pts awarded |

---

## 3. Scoreboard Verification Results

### 3.1 Zero-Plaintext Flag Hashing
- Verification confirmed that the Scoreboard receives **only HMAC-SHA256 digests** of flags (`HMAC-SHA256(SCOREBOARD_SECRET, flag)`).
- Plaintext flags are never persisted in the Scoreboard's SQLite database (`scoreboard.db`), memory dumps, or log output.
- Flag submissions are checked using constant-time comparison (`hmac.compare_digest`).

### 3.2 Scoring Integrity & Progressive Hints
- **Base Scoring**: Easy (100 pts), Medium (200 pts), Hard (300 pts).
- **First Blood**: The first solve for any challenge is recorded with `is_first_blood: true` and rendered with a `🩸 First Blood` badge.
- **Duplicate Prevention**: Re-submitting an already-solved flag is rejected with `already_solved: true` and 0 additional points awarded.
- **Hint Penalty**: Unlocking Hint 1 costs 25% of challenge points. Verified that solving a 100 pt challenge with 1 unlocked hint awards exactly **75 points** (100 - 25).

### 3.3 Rate Limiting
- A thread-safe sliding window rate limiter protects `/api/submit` (max 10 submissions per minute per player / IP).
- Automated stress tests confirmed that the 11th rapid submission is blocked with **HTTP 429 Too Many Requests** and a `retry_after` countdown header.

### 3.4 Admin Reset
- Tested `POST /api/admin/reset` protected by `X-Admin-Token: <SCOREBOARD_SECRET>`.
- Verified that calling the endpoint wipes all solve records, resets hints, and restores the leaderboard to 0 entries.

---

## 4. Hard Safety & Security Verification

| Safety Boundary | Required Invariant | Verified State | Audit Command / Method |
|---|---|---|---|
| **Host Port Binding** | Bind strictly to `127.0.0.1` | **PASS**: All 6 services bound to `127.0.0.1` only | `docker compose ps` |
| **Network Isolation** | Isolated networks; Scoreboard has no path to apps | **PASS**: 6 separate bridges (`vulnlab-*-net`), cross-network ping blocked | `docker exec vulnlab-scoreboard python -c "socket.connect(...)"` |
| **Privilege Mode** | No privileged mode or `docker.sock` | **PASS**: No privileged containers, no socket mounts | `docker inspect --format '{{.HostConfig.Privileged}}'` |
| **Non-Root Users** | Containers run unprivileged | **PASS**: All apps run as `UID 1000` | `docker exec <container> id -u` |
| **Resource Limits** | Max 0.50 CPU, 256MB RAM | **PASS**: Enforced via `deploy.resources.limits` | `docker inspect --format '{{.HostConfig.Memory}}'` |
| **Storage Hardening** | Named volumes only, no host directory bind mounts | **PASS**: Named volumes (`scoreboard-data`, `notes-db-data`, `file-share-data`) | `docker compose config` |
| **Flag Hygiene** | No flags in git repo, commits, or Docker image layers | **PASS**: `.env` is gitignored (`0600` permissions); 0 flags in `docker history` | `git grep "VULNLAB{"` & `docker history` |
| **Educational Warning** | README warning on local-only usage | **PASS**: Prominent banner present in root `README.md` and app walk-throughs | Inspection of `README.md` |

---

## 5. Lifecycle Scripts Verification

- **`./scripts/start.sh`**: Successfully generates flags on clean starts, builds pinned container images, initiates detached containers, and polls all `/health` endpoints with visual status until fully healthy.
- **`./scripts/stop.sh`**: Gracefully stops all lab containers via `docker compose down`.
- **`./scripts/reset.sh`**: Completely purges persistent container state and database volumes (`down -v`), regenerates fresh cryptographic flags (`gen-flags.sh`), and restarts clean containers.
