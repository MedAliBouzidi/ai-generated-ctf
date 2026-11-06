# PingTool (NetPulse Diagnostics Console)

**Port**: `8005` (Bound strictly to `127.0.0.1:8005`)  
**Tech Stack**: Python 3.12, Flask, Jinja2, Requests  
**Base Image**: `python:3.12-slim`  
**Container User**: Non-root (`appuser:appuser`, UID 1000)  
**Network**: Isolated Docker network `vulnlab-ping-net`

---

## Overview

**PingTool** (NetPulse Diagnostics Console) is a network utility dashboard designed for infrastructure operators and developers to perform reachability probes, HTTP status checks, DNS lookups, and diagnostic audit trail reviews.

The application features an interactive difficulty toggle (`Easy`, `Medium`, `Hard`) that controls input validation, security controls, and defense evasion complexity for each vulnerability class.

---

## Challenge Categories & Mappings

The application hosts 9 CTF challenges across 3 OWASP Top 10 vulnerability categories:

| ID | Title | Difficulty | Points | OWASP Category | Flag Environment Variable |
|---|---|---|---|---|---|
| `ping-tool-rce-easy` | PingTool - Unsanitized Command Injection (Easy) | Easy | 100 | `A03:2021-Injection` | `FLAG_PING_TOOL_RCE_EASY` |
| `ping-tool-rce-medium` | PingTool - Filter-Bypass Command Injection (Medium) | Medium | 200 | `A03:2021-Injection` | `FLAG_PING_TOOL_RCE_MEDIUM` |
| `ping-tool-rce-hard` | PingTool - Whitespace/Binary Bypass Command Injection (Hard) | Hard | 300 | `A03:2021-Injection` | `FLAG_PING_TOOL_RCE_HARD` |
| `ping-tool-ssrf-easy` | PingTool - Unrestricted SSRF (Easy) | Easy | 100 | `A10:2021-Server-Side Request Forgery` | `FLAG_PING_TOOL_SSRF_EASY` |
| `ping-tool-ssrf-medium` | PingTool - SSRF Localhost Filter Bypass (Medium) | Medium | 200 | `A10:2021-Server-Side Request Forgery` | `FLAG_PING_TOOL_SSRF_MEDIUM` |
| `ping-tool-ssrf-hard` | PingTool - SSRF CIDR/Hex/Redirect Bypass (Hard) | Hard | 300 | `A10:2021-Server-Side Request Forgery` | `FLAG_PING_TOOL_SSRF_HARD` |
| `ping-tool-xss-easy` | PingTool - Reflected XSS (Easy) | Easy | 100 | `A03:2021-Injection` | `FLAG_PING_TOOL_XSS_EASY` |
| `ping-tool-xss-medium` | PingTool - Reflected XSS Tag Filter Bypass (Medium) | Medium | 200 | `A03:2021-Injection` | `FLAG_PING_TOOL_XSS_MEDIUM` |
| `ping-tool-xss-hard` | PingTool - Context-Breaking Reflected XSS (Hard) | Hard | 300 | `A03:2021-Injection` | `FLAG_PING_TOOL_XSS_HARD` |

---

## Vulnerabilities Summary

### 1. OS Command Injection (`ping-tool-rce`)
- **Location**: `/api/ping` (ICMP Echo Utility)
- **Mechanics**:
  - **Easy**: Target host input is directly interpolated into `ping -c <count> <host>` and executed using `subprocess.Popen(..., shell=True)`.
  - **Medium**: Blacklists common shell operators (`;`, `&&`, `|`), bypassable using newlines (`\n` or `%0a`), backticks, or command substitution `$(...)`.
  - **Hard**: Strict blacklist filtering spaces, `;`, `&`, `|`, and keywords `cat`, `sh`, `bash`. Bypassable using `$IFS` as whitespace and alternative file readers like `head`, `tail`, `more`, `nl`, or shell redirection `<`.

### 2. Server-Side Request Forgery (`ping-tool-ssrf`)
- **Location**: `/api/ssrf` (HTTP Health / URL Preview Tool)
- **Target Endpoint**: `GET /internal/status` (loopback restricted endpoint hosting the control plane and SSRF flag)
- **Mechanics**:
  - **Easy**: Unrestricted fetching of user-provided URLs.
  - **Medium**: Naive blacklist checking for strings `'localhost'` and `'127.0.0.1'`, bypassable via alternative IP representations (`0.0.0.0`, `127.1`, decimal `2130706433`, hex `0x7f000001`, or IPv6 `[::]`).
  - **Hard**: Resolves hostname to an IP and validates against `127.0.0.1/32`, bypassable via alternative loopback subnet IPs (`127.0.0.2` in `127.0.0.0/8`) or HTTP 302 redirects (`/api/redirect?url=...`).

### 3. Reflected Cross-Site Scripting (`ping-tool-xss`)
- **Location**: `/lookup?host=...` and `/audit?search=...` (Error Feedback and Audit Filter)
- **Administrative Context**: Captured by simulated Admin Bot (`/api/report?url=...`) or administrator audit endpoint (`/api/audit/logs`)
- **Mechanics**:
  - **Easy**: Reflected error message is marked `| safe` in Jinja2 without HTML escaping.
  - **Medium**: Case-sensitive or single-pass replacement of `<script>`, bypassable with uppercase `<SCRIPT>` or event-driven tags (`<img src=x onerror=...>`).
  - **Hard**: HTML angle brackets `<` and `>` are escaped, but user input is reflected into an inline JavaScript string literal (`let host = "{{ host }}";`), bypassable via quote breakout `"; ... //`.

---

## Running Locally

### Via Docker:
```bash
docker build -t vulnlab-ping-tool .
docker run -p 127.0.0.1:8005:8005 \
  -e DIFFICULTY=easy \
  -e FLAG_PING_TOOL_RCE_EASY=VULNLAB{...} \
  vulnlab-ping-tool
```

### Healthcheck:
```bash
curl -f http://127.0.0.1:8005/health
# {"status": "ok"}
```
