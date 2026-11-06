# FileShare Pro (`apps/file-share`)

## Overview
**FileShare Pro** is an enterprise-grade document sharing, automation plugin, and media management portal built with **FastAPI** and **Python 3.12**. It provides file upload, preview, download, and execution capabilities alongside image validation engines.

The application intentionally features vulnerabilities categorized under OWASP Top 10 across three progressive difficulty modes (`easy`, `medium`, `hard`):
1. **Path Traversal (`file-share-traversal`)**: Exploiting unvalidated file path parameters in download and preview endpoints.
2. **Unrestricted File Upload (`file-share-upload`)**: Uploading executable script files, bypassing extension blacklists, and leveraging directory traversal / Zip Slip to drop plugins.
3. **Weak MIME Validation (`file-share-mime`)**: Spoofing client Content-Type headers, assembling polyglot magic-byte files, and performing XML External Entity (XXE) attacks against the SVG vector image parser.

---

## Technical Specifications
- **Host Port**: `127.0.0.1:8003`
- **Container Port**: `8003`
- **Tech Stack**: Python 3.12-slim, FastAPI, Uvicorn, Jinja2, lxml, Pillow
- **Container Network**: `vulnlab-files-net`
- **Container User**: Non-root (`appuser`, UID 1000)
- **Healthcheck**: `curl -f http://localhost:8003/health || exit 1`

---

## Challenge Registry

| Challenge ID | Title | Points | Difficulty | OWASP Category | Flag Environment Variable |
|---|---|---|---|---|---|
| `file-share-traversal-easy` | FileShare - Path Traversal (Easy) | 100 | Easy | A01:2021-Broken Access Control | `FLAG_FILE_SHARE_TRAVERSAL_EASY` |
| `file-share-traversal-medium` | FileShare - Path Traversal (Medium) | 200 | Medium | A01:2021-Broken Access Control | `FLAG_FILE_SHARE_TRAVERSAL_MEDIUM` |
| `file-share-traversal-hard` | FileShare - Path Traversal (Hard) | 300 | Hard | A01:2021-Broken Access Control | `FLAG_FILE_SHARE_TRAVERSAL_HARD` |
| `file-share-upload-easy` | FileShare - Unrestricted File Upload (Easy) | 100 | Easy | A03:2021-Injection | `FLAG_FILE_SHARE_UPLOAD_EASY` |
| `file-share-upload-medium` | FileShare - Unrestricted File Upload (Medium) | 200 | Medium | A03:2021-Injection | `FLAG_FILE_SHARE_UPLOAD_MEDIUM` |
| `file-share-upload-hard` | FileShare - Unrestricted File Upload (Hard) | 300 | Hard | A03:2021-Injection | `FLAG_FILE_SHARE_UPLOAD_HARD` |
| `file-share-mime-easy` | FileShare - Weak MIME Validation (Easy) | 100 | Easy | A04:2021-Insecure Design | `FLAG_FILE_SHARE_MIME_EASY` |
| `file-share-mime-medium` | FileShare - Weak MIME Validation (Medium) | 200 | Medium | A04:2021-Insecure Design | `FLAG_FILE_SHARE_MIME_MEDIUM` |
| `file-share-mime-hard` | FileShare - Weak MIME Validation (Hard) | 300 | Hard | A04:2021-Insecure Design | `FLAG_FILE_SHARE_MIME_HARD` |

---

## Difficulty Configuration

The application determines its active security tier dynamically via:
1. Environment Variable: `DIFFICULTY` or `FILE_SHARE_DIFFICULTY` (`easy`, `medium`, `hard` — default: `easy`).
2. Web UI mode switcher: Interactive buttons in the navigation bar set a session cookie (`difficulty=easy|medium|hard`) and sync disk flag files instantly.
3. HTTP Header: `X-Difficulty: easy|medium|hard`.
4. URL Query Parameter: `?difficulty=easy|medium|hard`.

---

## Running Locally

### With Docker
```bash
# Build Docker image
docker build -t vulnlab-file-share .

# Run container binding to localhost:8003
docker run -d --name file-share \
  -p 127.0.0.1:8003:8003 \
  -e DIFFICULTY=easy \
  -e FLAG_FILE_SHARE_TRAVERSAL_EASY=VULNLAB{sample_flag_here} \
  vulnlab-file-share

# Verify healthcheck
curl -s http://127.0.0.1:8003/health
```

### With Python Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd src
uvicorn app:app --host 0.0.0.0 --port 8003
```

---

## Key Endpoints
- `GET /`: Interactive web dashboard with file manager, media gallery, and active difficulty indicator.
- `GET /health`: Healthcheck endpoint returning `{"status": "ok"}`.
- `GET /api/files`: JSON list of stored files.
- `GET /api/download?file=<path>`: Download file (Path Traversal target).
- `GET /api/preview?file=<path>`: Preview file content (Path Traversal target).
- `POST /api/upload`: Upload files (Unrestricted File Upload target).
- `POST /api/upload/archive`: Upload & unpack Zip archives (Zip Slip target).
- `POST /api/execute`: Run uploaded script (.py, .sh, polyglot).
- `POST /api/plugins/run`: Execute plugin from `/app/plugins/`.
- `POST /api/upload/image`: Image upload with MIME validation (Easy, Medium, Hard SVG XXE).
- `POST /api/reset-files`: Reset uploads directory back to default sample files.
