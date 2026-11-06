# VulnLab CTF - Notes IDOR (`notes-idor`)

A vulnerable web application built for practicing Insecure Direct Object References (IDOR) and Broken Access Control vulnerabilities across progressive difficulty tiers.

## 1. Application Overview

**VulnLab Notes** is an internal corporate notes and memo platform. Users can register, log in, create private or public research memos, view system audit activity, and manage account profile settings. An administrative console is provided for managing users and monitoring platform telemetry.

- **Port**: `8002` (`127.0.0.1:8002`)
- **Tech Stack**: Node.js 20 (Express.js), PostgreSQL 16 (with embedded memory store fallback)
- **Vulnerability Category**: Broken Access Control (`OWASP A01:2021-Broken Access Control`)
- **Base Image**: `node:20-alpine` (runs as non-root user `node`)

---

## 2. Pre-Seeded Accounts

| Username | Password | Role | Description |
|---|---|---|---|
| `admin` | `AdminSecretPass2026!` | `admin` | Platform Administrator. Owns confidential note #1. |
| `alice` | `alice123` | `user` | Standard Employee (Engineering). Notes #3 & #4. |
| `bob` | `bob123` | `user` | Standard Employee (QA). Note #5. |

---

## 3. Challenge Registry

This application hosts 6 challenges across two vulnerability tracks and three difficulty modes:

| ID | Title | Difficulty | Points | Category | Flag Environment Variable |
|---|---|---|---|---|---|
| `notes-idor-view-easy` | Notes - IDOR Note Access (Easy) | Easy | 100 | Broken Access Control | `FLAG_NOTES_IDOR_VIEW_EASY` |
| `notes-idor-view-medium` | Notes - IDOR Note Access (Medium) | Medium | 200 | Broken Access Control | `FLAG_NOTES_IDOR_VIEW_MEDIUM` |
| `notes-idor-view-hard` | Notes - IDOR Note Access (Hard) | Hard | 300 | Broken Access Control | `FLAG_NOTES_IDOR_VIEW_HARD` |
| `notes-idor-admin-easy` | Notes - Privilege Escalation to Admin (Easy) | Easy | 100 | Broken Access Control | `FLAG_NOTES_IDOR_ADMIN_EASY` |
| `notes-idor-admin-medium` | Notes - Privilege Escalation to Admin (Medium) | Medium | 200 | Broken Access Control | `FLAG_NOTES_IDOR_ADMIN_MEDIUM` |
| `notes-idor-admin-hard` | Notes - Privilege Escalation to Admin (Hard) | Hard | 300 | Broken Access Control | `FLAG_NOTES_IDOR_ADMIN_HARD` |

---

## 4. Architecture & Vulnerabilities

### Track A: Note Viewing IDOR (`notes-idor-view`)
- **Easy (`notes-idor-view-easy`)**:
  - Direct sequential integer IDs (`/api/notes/:id`). Note ID 1 belongs to the administrator.
  - The endpoint fetches `WHERE id = req.params.id` without validating ownership (`user_id = current_user.id`).
- **Medium (`notes-idor-view-medium`)**:
  - Obfuscated IDs: note IDs are Base64-encoded integers (e.g. note 1 is `MQ==`), or accept parameter overrides (`?note_id=1`).
  - No authorization check is performed on the resolved identifier.
- **Hard (`notes-idor-view-hard`)**:
  - Note IDs are non-sequential UUIDs.
  - An information disclosure vulnerability in `/api/activity` (audit log) and `/api/users/admin/public-profile` leaks the administrator's secret note UUID (`a1b2c3d4-e5f6-4789-9abc-def012345678`).
  - Requesting `/api/notes/<UUID>` returns the private note without checking permissions.

### Track B: Privilege Escalation (`notes-idor-admin`)
- **Easy (`notes-idor-admin-easy`)**:
  - Mass assignment vulnerability on `PUT /api/users/profile`.
  - The server merges `role` directly from the request payload into the database record and user session.
  - Accessing `/admin` or `/api/admin/flag` releases the administrator flag.
- **Medium (`notes-idor-admin-medium`)**:
  - Profile update filters `role`, but the administrator authorization middleware improperly trusts reverse-proxy and client headers:
    - `X-Role: admin`
    - `X-User-Role: admin`
    - `X-HTTP-Method-Override: ADMIN`
- **Hard (`notes-idor-admin-hard`)**:
  - Header spoofing is strictly rejected and session role is validated.
  - Two privilege escalation vectors are present:
    1. **User Update IDOR**: `PUT /api/users/:id` lacks verification that the session user matches `:id`. An attacker can overwrite user 1's password (`{"password": "..."}`) and log in as `admin`.
    2. **Nested Parameter Injection**: `PUT /api/users/profile` unpacks nested metadata (`{"metadata": {"role": "admin"}}`), promoting the user's role to admin.

---

## 5. Running the Application

### Running with Docker (Standalone)
```bash
# Build the container
docker build -t vulnlab-notes-idor .

# Run the container
docker run -d --name notes-idor -p 127.0.0.1:8002:8002 vulnlab-notes-idor
```

### Running Locally with Node.js
```bash
# Install dependencies
npm install

# Run database setup & start server
npm start
```

### Running Test Suite
```bash
npm test
```

### Healthcheck
```bash
curl http://127.0.0.1:8002/health
# Response: {"status":"ok"}
```

---

## 6. Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `8002` | Port on which the Express server listens. |
| `DATABASE_URL` | *None* (falls back to memory store) | Connection string for PostgreSQL 16 (e.g. `postgres://user:pass@host:5432/notes_db`). |
| `SESSION_SECRET` | `vulnlab-notes-idor-secret-key-2026` | Secret used to sign session cookies. |
| `DIFFICULTY` / `NOTES_IDOR_DIFFICULTY` | `easy` | Initial difficulty mode (`easy`, `medium`, `hard`). |
| `FLAG_NOTES_IDOR_VIEW_EASY` | *Deterministic dev fallback* | Flag for Easy View IDOR. |
| `FLAG_NOTES_IDOR_VIEW_MEDIUM` | *Deterministic dev fallback* | Flag for Medium View IDOR. |
| `FLAG_NOTES_IDOR_VIEW_HARD` | *Deterministic dev fallback* | Flag for Hard View IDOR. |
| `FLAG_NOTES_IDOR_ADMIN_EASY` | *Deterministic dev fallback* | Flag for Easy Admin Escalation. |
| `FLAG_NOTES_IDOR_ADMIN_MEDIUM` | *Deterministic dev fallback* | Flag for Medium Admin Escalation. |
| `FLAG_NOTES_IDOR_ADMIN_HARD` | *Deterministic dev fallback* | Flag for Hard Admin Escalation. |
