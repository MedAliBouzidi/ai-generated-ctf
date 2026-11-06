# VulnLab CTF - Blog SQLi Application (`blog-sqli`)

A realistic, modern web application designed for learning and practicing SQL Injection (Authentication Bypass and UNION Data Extraction) and Stored Cross-Site Scripting (XSS).

## Overview & Architecture

- **Host Port**: `127.0.0.1:8001` (Container port `8001`)
- **Technology Stack**: Python 3.12, Flask 3.x, SQLite 3, Jinja2
- **Base Docker Image**: `python:3.12-slim`
- **Security Boundary**: Runs under an unprivileged user `ctfuser` (UID 1000) on an isolated Docker network (`vulnlab-blog-net`).

## Challenges Hosted (9 Total)

| Challenge ID | Title | Difficulty | Points | OWASP Category |
|---|---|---|---|---|
| `blog-sqli-login-easy` | Blog - SQLi Login Bypass (Easy) | Easy | 100 | `A03:2021-Injection` |
| `blog-sqli-login-medium` | Blog - SQLi Login Bypass (Medium) | Medium | 200 | `A03:2021-Injection` |
| `blog-sqli-login-hard` | Blog - SQLi Login Bypass (Hard) | Hard | 300 | `A03:2021-Injection` |
| `blog-sqli-union-easy` | Blog - UNION Data Extraction (Easy) | Easy | 100 | `A03:2021-Injection` |
| `blog-sqli-union-medium` | Blog - UNION Data Extraction (Medium) | Medium | 200 | `A03:2021-Injection` |
| `blog-sqli-union-hard` | Blog - UNION Data Extraction (Hard) | Hard | 300 | `A03:2021-Injection` |
| `blog-sqli-xss-easy` | Blog - Stored XSS in Comments (Easy) | Easy | 100 | `A03:2021-Injection` |
| `blog-sqli-xss-medium` | Blog - Stored XSS in Comments (Medium) | Medium | 200 | `A03:2021-Injection` |
| `blog-sqli-xss-hard` | Blog - Stored XSS in Comments (Hard) | Hard | 300 | `A03:2021-Injection` |

## Difficulty Mechanism

The active difficulty defaults to `easy` and can be set via environment variable:
- `DIFFICULTY=easy|medium|hard` or `BLOG_SQLI_DIFFICULTY=easy|medium|hard`

Players can also dynamically toggle the difficulty directly from the web UI badges, via URL parameter `?difficulty=<level>`, or using the API endpoint `/set-difficulty?mode=<level>`.

## Key Endpoints

- `GET /health`: Healthcheck endpoint returning `{"status": "ok"}`.
- `GET /`: Blog post feed with search input.
- `GET /post/<id>`: View single blog post and submit comments.
- `POST /post/<id>/comment`: Post comment containing text or XSS payloads.
- `GET /login` / `POST /login`: Authentication portal vulnerable to SQL injection.
- `GET /admin` / `GET /dashboard`: Admin control panel displaying captured login flags.
- `GET /api/admin/visit-comments` / `POST /api/admin/visit-comments`: Simulated admin browser bot that visits comments with administrative session cookies.
- `GET /api/exfil` / `POST /api/exfil`: Optional cookie exfiltration receiver.

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run server
python src/app.py
```

## Running with Docker

```bash
docker build -t vulnlab-blog-sqli .
docker run -p 127.0.0.1:8001:8001 vulnlab-blog-sqli
```
