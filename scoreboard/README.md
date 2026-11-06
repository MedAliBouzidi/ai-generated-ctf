# VulnLab CTF - Central Scoreboard

The **VulnLab CTF Scoreboard** is a high-performance, cyber-themed scoring engine and dashboard for the VulnLab local practice laboratory. Built with **FastAPI** and **SQLite**, it provides real-time leaderboard tracking, progressive hints with point deduction penalties, first-blood badges, rate limiting, and zero-plaintext flag storage.

---

## 🚀 Key Features

- **Zero-Plaintext Flag Storage:** The scoreboard **never** stores or logs plaintext flags. Flag values are digested using **HMAC-SHA256** keyed with `SCOREBOARD_SECRET`. Submissions are verified via constant-time cryptographic hash comparison.
- **Progressive Hint Penalty System:** Each challenge provides up to 2 hints. Unlocking each hint permanently deducts **25%** of the challenge's base point value upon solve:
  - **Easy (100 pts):** Hint 1 costs 25 pts, Hint 2 costs 25 pts.
  - **Medium (200 pts):** Hint 1 costs 50 pts, Hint 2 costs 50 pts.
  - **Hard (300 pts):** Hint 1 costs 75 pts, Hint 2 costs 75 pts.
- **🩸 First Blood Tracking:** The first hacker to solve any challenge is awarded a First Blood badge on the challenge card and on the live leaderboard.
- **Brute-Force Protection:** Flag submissions are rate-limited to a maximum of **10 attempts per minute** per player / IP address (HTTP 429 upon violation).
- **Consolidated Registry:** Pre-configured with all **42 VulnLab challenges** spanning 5 vulnerable applications (Blog SQLi, Notes IDOR, File Share, Shop Auth, Ping Tool).
- **Modern Cyber Web UI:** Dark mode responsive dashboard with neon styling, real-time leaderboard, challenge filters (by app, difficulty, status, search), and direct navigation links to target application ports.
- **Administrative Reset:** Secure API endpoint and UI panel to wipe submissions, hint unlocks, and leaderboard standings without restarting Docker containers.

---

## 🌐 Network & Port Allocation

| Component | Port | Host Binding | Network |
|---|---|---|---|
| **Scoreboard Web UI & API** | `8000` | `127.0.0.1:8000` | `vulnlab-scoreboard-net` |
| **Blog SQLi Target** | `8001` | `127.0.0.1:8001` | `vulnlab-blog-net` |
| **Notes IDOR Target** | `8002` | `127.0.0.1:8002` | `vulnlab-notes-net` |
| **File Share Target** | `8003` | `127.0.0.1:8003` | `vulnlab-files-net` |
| **Shop Auth Target** | `8004` | `127.0.0.1:8004` | `vulnlab-shop-net` |
| **Ping Tool Target** | `8005` | `127.0.0.1:8005` | `vulnlab-ping-net` |

---

## 🔒 Flag Hashing & Security Architecture

1. **HMAC Calculation:**
   $$\text{Flag Hash} = \text{HMAC-SHA256}(\text{SCOREBOARD\_SECRET}, \text{flag\_string})$$
2. **Startup Initialization:**
   At boot, the scoreboard resolves flags for all 42 challenges:
   - If `FLAG_HASH_<FLAG_ENV>` is provided in the environment, it is loaded directly.
   - If `<FLAG_ENV>` plaintext is provided, the scoreboard computes its HMAC-SHA256 digest, purges the plaintext string from memory, and stores only the hash in SQLite.
3. **Constant-Time Verification:**
   When a user submits `VULNLAB{...}`, the scoreboard computes `HMAC-SHA256(SCOREBOARD_SECRET, submitted_flag)` and verifies it using Python's `hmac.compare_digest` against the stored hash.

---

## ⚙️ Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `SCOREBOARD_SECRET` | `vulnlab_scoreboard_secret_key_default_2026` | Secret key used for HMAC flag hashing and admin API authentication |
| `DATABASE_PATH` | `/app/data/scoreboard.db` | SQLite database file location |
| `CHALLENGES_FILE` | `/app/challenges.json` | Path to consolidated challenges definition file |
| `RATE_LIMIT_MAX_ATTEMPTS` | `10` | Maximum flag submissions per window |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Duration of rate limiting sliding window (seconds) |

---

## 📡 API Documentation

### 1. Health Checks
- `GET /health` or `GET /api/health`
  - **Response (200 OK):**
    ```json
    { "status": "ok" }
    ```

### 2. Player Registration & Session
- `POST /api/register`
  - **Request Body:**
    ```json
    { "username": "zero_cool" }
    ```
  - **Response (200 OK):**
    ```json
    {
      "id": 1,
      "username": "zero_cool",
      "token": "<signed_session_token>",
      "message": "Welcome, zero_cool!"
    }
    ```
  - *Note:* Sets an HTTP cookie `player_session` and returns token for header authentication (`Authorization: Bearer <token>` or `X-Player-Token: <token>`).

- `GET /api/me`
  - **Headers:** `Authorization: Bearer <token>`
  - **Response (200 OK):** Current player profile, total points, rank, solve records, and unlocked hints.

### 3. Challenges
- `GET /api/challenges`
  - **Headers:** `Authorization: Bearer <token>` *(optional, enriches with user solve & hint status)*
  - **Response (200 OK):** Array of challenge objects:
    ```json
    [
      {
        "id": "blog-sqli-login-easy",
        "app": "blog-sqli",
        "title": "Blog - SQLi Login Bypass (Easy)",
        "difficulty": "easy",
        "points": 100,
        "category": "SQL Injection",
        "owasp": "A03:2021-Injection",
        "description": "Bypass authentication on the blog login form...",
        "solve_count": 3,
        "first_blood_player": "acid_burn",
        "first_blood_time": "2026-11-06T20:15:00Z",
        "solved": false,
        "hints": [
          { "index": 0, "cost": 25, "unlocked": false, "text": null },
          { "index": 1, "cost": 25, "unlocked": false, "text": null }
        ]
      }
    ]
    ```

### 4. Hints System
- `POST /api/hint`
  - **Headers:** `Authorization: Bearer <token>`
  - **Request Body:**
    ```json
    {
      "challenge_id": "blog-sqli-login-easy",
      "hint_index": 0
    }
    ```
  - **Response (200 OK):**
    ```json
    {
      "success": true,
      "challenge_id": "blog-sqli-login-easy",
      "hint_index": 0,
      "cost": 25,
      "hint": "Check how username and password inputs are concatenated into the SQL statement.",
      "message": "Hint 1 unlocked! (25 points penalty upon solve)."
    }
    ```

### 5. Flag Submission
- `POST /api/submit`
  - **Headers:** `Authorization: Bearer <token>`
  - **Rate Limit:** 10 requests / minute
  - **Request Body:**
    ```json
    {
      "challenge_id": "blog-sqli-login-easy",
      "flag": "VULNLAB{a1b2c3d4e5f678901234567890abcdef}"
    }
    ```
  - **Response - Success (200 OK):**
    ```json
    {
      "success": true,
      "already_solved": false,
      "points": 75,
      "is_first_blood": true,
      "message": "🎉 Correct flag! Awarded 75 points. 🩸 FIRST BLOOD ACHIEVED! (25 pts deducted for unlocked hints)."
    }
    ```
  - **Response - Incorrect (200 OK):**
    ```json
    {
      "success": false,
      "already_solved": false,
      "points": 0,
      "is_first_blood": false,
      "message": "Incorrect flag. Keep trying!"
    }
    ```
  - **Response - Rate Limited (429 Too Many Requests):**
    ```json
    {
      "detail": "Rate limit exceeded. Maximum 10 submissions per minute. Please wait 45 seconds."
    }
    ```

### 6. Leaderboard
- `GET /api/leaderboard`
  - **Response (200 OK):**
    ```json
    [
      {
        "rank": 1,
        "player_id": 1,
        "username": "zero_cool",
        "score": 575,
        "solves_count": 3,
        "first_bloods_count": 2,
        "last_solve_time": "2026-11-06T20:45:12Z",
        "solves": [
          { "challenge_id": "blog-sqli-login-easy", "points": 100, "is_first_blood": true }
        ]
      }
    ]
    ```

### 7. Admin Reset
- `POST /api/admin/reset`
  - **Authentication:** Header `X-Admin-Token: <SCOREBOARD_SECRET>` or query parameter `?token=<SCOREBOARD_SECRET>`.
  - **Optional Body:**
    ```json
    {
      "reset_players": false
    }
    ```
  - **cURL Example:**
    ```bash
    curl -X POST http://127.0.0.1:8000/api/admin/reset \
      -H "X-Admin-Token: $SCOREBOARD_SECRET" \
      -H "Content-Type: application/json"
    ```
  - **Response (200 OK):**
    ```json
    {
      "status": "ok",
      "message": "Scoreboard successfully reset. Solves and hints have been wiped.",
      "players_reset": false
    }
    ```

---

## 🐳 Docker Deployment

### Build Container
```bash
cd /home/medali/MyData/ExtraProjects/ai-generated-ctf/scoreboard
docker build -t vulnlab-scoreboard:latest .
```

### Run Standalone
```bash
docker run -d \
  --name vulnlab-scoreboard \
  -p 127.0.0.1:8000:8000 \
  -e SCOREBOARD_SECRET="your_production_secret" \
  vulnlab-scoreboard:latest
```

### Verify Container Health
```bash
curl -f http://127.0.0.1:8000/health
# {"status":"ok"}
```
