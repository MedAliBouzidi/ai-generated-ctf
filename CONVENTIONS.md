# VulnLab CTF - Conventions & Challenge Registry

## Flag Format
- `VULNLAB{<32-hex-lowercase>}`
- Example: `VULNLAB{a1b2c3d4e5f678901234567890abcdef}`

## Difficulty Mechanism
Every app inspects an environment variable:
`DIFFICULTY` (can also be specified per app, e.g. `BLOG_SQLI_DIFFICULTY`, etc., default is `easy`).
Supported values: `easy`, `medium`, `hard`.
When the app runs in `easy` mode:
- It serves the `EASY` flag when exploited.
- Minimal or no input validation.
When the app runs in `medium` mode:
- It serves the `MEDIUM` flag when exploited.
- Partial defenses (e.g., keyword blacklist, client-side check, simple regex).
When the app runs in `hard` mode:
- It serves the `HARD` flag when exploited.
- More comprehensive defenses requiring alternate syntax, encoding, or second-order techniques.

In addition, each app provides a visible badge or indicator on its UI showing the active difficulty (`Easy`, `Medium`, `Hard`) and allows viewing or switching mode or testing exploits against the running difficulty.

## Complete Challenge Registry (42 Challenges)

### App 1: `blog-sqli` (Port 8001)
- Base URL: `http://127.0.0.1:8001`
- Healthcheck: `GET /health` -> `{"status": "ok"}`
- Categories:
  1. `blog-sqli-login-easy`: Title: "Blog - SQLi Login Bypass (Easy)" | Pts: 100 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_LOGIN_EASY`
  2. `blog-sqli-login-medium`: Title: "Blog - SQLi Login Bypass (Medium)" | Pts: 200 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_LOGIN_MEDIUM`
  3. `blog-sqli-login-hard`: Title: "Blog - SQLi Login Bypass (Hard)" | Pts: 300 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_LOGIN_HARD`
  4. `blog-sqli-union-easy`: Title: "Blog - UNION Data Extraction (Easy)" | Pts: 100 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_UNION_EASY`
  5. `blog-sqli-union-medium`: Title: "Blog - UNION Data Extraction (Medium)" | Pts: 200 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_UNION_MEDIUM`
  6. `blog-sqli-union-hard`: Title: "Blog - UNION Data Extraction (Hard)" | Pts: 300 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_UNION_HARD`
  7. `blog-sqli-xss-easy`: Title: "Blog - Stored XSS in Comments (Easy)" | Pts: 100 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_XSS_EASY`
  8. `blog-sqli-xss-medium`: Title: "Blog - Stored XSS in Comments (Medium)" | Pts: 200 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_XSS_MEDIUM`
  9. `blog-sqli-xss-hard`: Title: "Blog - Stored XSS in Comments (Hard)" | Pts: 300 | OWASP: `A03:2021-Injection` | Flag: `FLAG_BLOG_SQLI_XSS_HARD`

### App 2: `notes-idor` (Port 8002)
- Base URL: `http://127.0.0.1:8002`
- Healthcheck: `GET /health` -> `{"status": "ok"}`
- Categories:
  10. `notes-idor-view-easy`: Title: "Notes - IDOR Note Access (Easy)" | Pts: 100 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_NOTES_IDOR_VIEW_EASY`
  11. `notes-idor-view-medium`: Title: "Notes - IDOR Note Access (Medium)" | Pts: 200 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_NOTES_IDOR_VIEW_MEDIUM`
  12. `notes-idor-view-hard`: Title: "Notes - IDOR Note Access (Hard)" | Pts: 300 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_NOTES_IDOR_VIEW_HARD`
  13. `notes-idor-admin-easy`: Title: "Notes - Privilege Escalation to Admin (Easy)" | Pts: 100 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_NOTES_IDOR_ADMIN_EASY`
  14. `notes-idor-admin-medium`: Title: "Notes - Privilege Escalation to Admin (Medium)" | Pts: 200 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_NOTES_IDOR_ADMIN_MEDIUM`
  15. `notes-idor-admin-hard`: Title: "Notes - Privilege Escalation to Admin (Hard)" | Pts: 300 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_NOTES_IDOR_ADMIN_HARD`

### App 3: `file-share` (Port 8003)
- Base URL: `http://127.0.0.1:8003`
- Healthcheck: `GET /health` -> `{"status": "ok"}`
- Categories:
  16. `file-share-traversal-easy`: Title: "FileShare - Path Traversal (Easy)" | Pts: 100 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_FILE_SHARE_TRAVERSAL_EASY`
  17. `file-share-traversal-medium`: Title: "FileShare - Path Traversal (Medium)" | Pts: 200 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_FILE_SHARE_TRAVERSAL_MEDIUM`
  18. `file-share-traversal-hard`: Title: "FileShare - Path Traversal (Hard)" | Pts: 300 | OWASP: `A01:2021-Broken Access Control` | Flag: `FLAG_FILE_SHARE_TRAVERSAL_HARD`
  19. `file-share-upload-easy`: Title: "FileShare - Unrestricted File Upload (Easy)" | Pts: 100 | OWASP: `A03:2021-Injection` | Flag: `FLAG_FILE_SHARE_UPLOAD_EASY`
  20. `file-share-upload-medium`: Title: "FileShare - Unrestricted File Upload (Medium)" | Pts: 200 | OWASP: `A03:2021-Injection` | Flag: `FLAG_FILE_SHARE_UPLOAD_MEDIUM`
  21. `file-share-upload-hard`: Title: "FileShare - Unrestricted File Upload (Hard)" | Pts: 300 | OWASP: `A03:2021-Injection` | Flag: `FLAG_FILE_SHARE_UPLOAD_HARD`
  22. `file-share-mime-easy`: Title: "FileShare - Weak MIME Validation (Easy)" | Pts: 100 | OWASP: `A04:2021-Insecure Design` | Flag: `FLAG_FILE_SHARE_MIME_EASY`
  23. `file-share-mime-medium`: Title: "FileShare - Weak MIME Validation (Medium)" | Pts: 200 | OWASP: `A04:2021-Insecure Design` | Flag: `FLAG_FILE_SHARE_MIME_MEDIUM`
  24. `file-share-mime-hard`: Title: "FileShare - Weak MIME Validation (Hard)" | Pts: 300 | OWASP: `A04:2021-Insecure Design` | Flag: `FLAG_FILE_SHARE_MIME_HARD`

### App 4: `shop-auth` (Port 8004)
- Base URL: `http://127.0.0.1:8004`
- Healthcheck: `GET /health` -> `{"status": "ok"}`
- Categories:
  25. `shop-auth-jwt-easy`: Title: "Shop - Weak JWT None Algorithm (Easy)" | Pts: 100 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_JWT_EASY`
  26. `shop-auth-jwt-medium`: Title: "Shop - Weak JWT Secret Brute Force (Medium)" | Pts: 200 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_JWT_MEDIUM`
  27. `shop-auth-jwt-hard`: Title: "Shop - Weak JWT Header Parameter Confusion (Hard)" | Pts: 300 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_JWT_HARD`
  28. `shop-auth-bruteforce-easy`: Title: "Shop - No Login Rate Limiting (Easy)" | Pts: 100 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_BRUTEFORCE_EASY`
  29. `shop-auth-bruteforce-medium`: Title: "Shop - Header-Bypass Rate Limiting (Medium)" | Pts: 200 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_BRUTEFORCE_MEDIUM`
  30. `shop-auth-bruteforce-hard`: Title: "Shop - Timing/Response Attack (Hard)" | Pts: 300 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_BRUTEFORCE_HARD`
  31. `shop-auth-reset-easy`: Title: "Shop - Predictable Reset Token MD5 (Easy)" | Pts: 100 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_RESET_EASY`
  32. `shop-auth-reset-medium`: Title: "Shop - Predictable Reset Timestamp (Medium)" | Pts: 200 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_RESET_MEDIUM`
  33. `shop-auth-reset-hard`: Title: "Shop - Host Header Poisoning Reset (Hard)" | Pts: 300 | OWASP: `A07:2021-Identification and Authentication Failures` | Flag: `FLAG_SHOP_AUTH_RESET_HARD`

### App 5: `ping-tool` (Port 8005)
- Base URL: `http://127.0.0.1:8005`
- Healthcheck: `GET /health` -> `{"status": "ok"}`
- Categories:
  34. `ping-tool-rce-easy`: Title: "PingTool - Unsanitized Command Injection (Easy)" | Pts: 100 | OWASP: `A03:2021-Injection` | Flag: `FLAG_PING_TOOL_RCE_EASY`
  35. `ping-tool-rce-medium`: Title: "PingTool - Filter-Bypass Command Injection (Medium)" | Pts: 200 | OWASP: `A03:2021-Injection` | Flag: `FLAG_PING_TOOL_RCE_MEDIUM`
  36. `ping-tool-rce-hard`: Title: "PingTool - Whitespace/Binary Bypass Command Injection (Hard)" | Pts: 300 | OWASP: `A03:2021-Injection` | Flag: `FLAG_PING_TOOL_RCE_HARD`
  37. `ping-tool-ssrf-easy`: Title: "PingTool - Unrestricted SSRF (Easy)" | Pts: 100 | OWASP: `A10:2021-Server-Side Request Forgery` | Flag: `FLAG_PING_TOOL_SSRF_EASY`
  38. `ping-tool-ssrf-medium`: Title: "PingTool - SSRF Localhost Filter Bypass (Medium)" | Pts: 200 | OWASP: `A10:2021-Server-Side Request Forgery` | Flag: `FLAG_PING_TOOL_SSRF_MEDIUM`
  39. `ping-tool-ssrf-hard`: Title: "PingTool - SSRF CIDR/Hex/Redirect Bypass (Hard)" | Pts: 300 | OWASP: `A10:2021-Server-Side Request Forgery` | Flag: `FLAG_PING_TOOL_SSRF_HARD`
  40. `ping-tool-xss-easy`: Title: "PingTool - Reflected XSS (Easy)" | Pts: 100 | OWASP: `A03:2021-Injection` | Flag: `FLAG_PING_TOOL_XSS_EASY`
  41. `ping-tool-xss-medium`: Title: "PingTool - Reflected XSS Tag Filter Bypass (Medium)" | Pts: 200 | OWASP: `A03:2021-Injection` | Flag: `FLAG_PING_TOOL_XSS_MEDIUM`
  42. `ping-tool-xss-hard`: Title: "PingTool - Context-Breaking Reflected XSS (Hard)" | Pts: 300 | OWASP: `A03:2021-Injection` | Flag: `FLAG_PING_TOOL_XSS_HARD`

## Scoreboard Endpoint Contract
- `GET /health` -> `{"status": "ok"}`
- `GET /api/challenges` -> List of challenges (id, title, app, difficulty, points, category, owasp, description, hints unlocked count)
- `POST /api/register` -> `{"username": "..."}` -> returns session / player info
- `POST /api/submit` -> `{"challenge_id": "...", "flag": "VULNLAB{...}"}` -> `{"success": true/false, "points": ..., "message": "..."}`
- `POST /api/hint` -> `{"challenge_id": "...", "hint_index": 0}` -> returns hint text and deducts points
- `GET /api/leaderboard` -> List of players, solves, timestamps, first blood markers, total score
- `POST /api/admin/reset` -> Resets solves, hints, and leaderboard (requires header `X-Admin-Token: <SCOREBOARD_SECRET>`)
