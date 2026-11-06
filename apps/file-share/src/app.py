import os
import shutil
import subprocess
import urllib.parse
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request, Response, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from config import (
    BASE_DIR,
    UPLOADS_DIR,
    FLAGS_DIR,
    PLUGINS_DIR,
    FLAGS,
    get_difficulty,
    sync_flag_files,
)

app = FastAPI(title="FileShare Pro", version="1.0.0")

# Mount static files
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# Templates
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def get_raw_query_param(request: Request, key: str, fallback: str = "") -> str:
    """Extract raw query parameter before automatic decoding."""
    raw_qs = request.scope.get("query_string", b"").decode("latin-1")
    for pair in raw_qs.split("&"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            if k == key:
                return v
        elif pair == key:
            return ""
    return fallback


@app.on_event("startup")
def startup_event():
    sync_flag_files("easy")


# ==========================================
# Healthcheck & Difficulty Management
# ==========================================

@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/api/difficulty")
def get_current_difficulty(request: Request):
    diff = get_difficulty(request)
    return {"difficulty": diff}


@app.post("/api/difficulty")
async def set_current_difficulty(request: Request, response: Response):
    data = {}
    try:
        data = await request.json()
    except Exception:
        pass
    diff = data.get("difficulty") or request.query_params.get("difficulty", "easy")
    diff = diff.lower()
    if diff not in ["easy", "medium", "hard"]:
        diff = "easy"

    sync_flag_files(diff)
    res = JSONResponse({"status": "success", "difficulty": diff})
    res.set_cookie(key="difficulty", value=diff, max_age=86400, httponly=False)
    return res


# ==========================================
# File Explorer & Management
# ==========================================

def list_stored_files():
    files = []
    if UPLOADS_DIR.exists():
        for item in sorted(UPLOADS_DIR.iterdir()):
            if item.is_file():
                ext = item.suffix.lower()
                is_script = ext in [".py", ".py3", ".phtml", ".pyw", ".sh", ".bash"]
                is_image = ext in [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"]
                files.append({
                    "name": item.name,
                    "size": item.stat().st_size,
                    "is_script": is_script,
                    "is_image": is_image,
                    "ext": ext or "none",
                })
    return files


def list_plugins():
    plugins = []
    if PLUGINS_DIR.exists():
        for item in sorted(PLUGINS_DIR.iterdir()):
            if item.is_file():
                plugins.append({
                    "name": item.name,
                    "size": item.stat().st_size,
                })
    return plugins


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    diff = get_difficulty(request)
    sync_flag_files(diff)
    files = list_stored_files()
    plugins = list_plugins()
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "difficulty": diff,
            "files": files,
            "plugins": plugins,
        },
    )


@app.get("/api/files")
def get_files():
    return {"files": list_stored_files()}


@app.get("/api/plugins")
def get_plugins_list():
    return {"plugins": list_plugins()}


# ==========================================
# 1. Path Traversal (file-share-traversal)
# ==========================================

def resolve_traversal_path(request: Request, raw_input: str, diff: str) -> Path:
    """
    Applies difficulty-specific traversal filter:
    - Easy: No filter at all. Reads arbitrary paths or traverses ../.
    - Medium: Strips '../' once. Bypassable via '....//' or '%2e%2e%2f'.
    - Hard: Requires path starting with 'uploads/' or '/app/', or strips recursively
            but allows URL double-encoding '%252e%252e%252f'.
    """
    if diff == "easy":
        # Unrestricted
        decoded = urllib.parse.unquote(raw_input)
        if decoded.startswith("/"):
            return Path(decoded)
        return (UPLOADS_DIR / decoded).resolve()

    elif diff == "medium":
        # Strips '../' once (non-recursive)
        stripped = raw_input.replace("../", "")
        # Then unquotes (allows %2e%2e%2f to become ../)
        decoded = urllib.parse.unquote(stripped)
        if decoded.startswith("/"):
            return Path(decoded)
        return (UPLOADS_DIR / decoded).resolve()

    else:  # hard
        raw = raw_input
        # Check if starts with uploads/ or /app/
        allowed_prefix = (
            raw.startswith("uploads/")
            or raw.startswith("/app/")
            or raw.startswith("/flag_traversal.txt")
        )

        # Recursive strip of '../'
        stripped = raw
        while "../" in stripped:
            stripped = stripped.replace("../", "")

        # Decode once (Starlette / HTTP query may have already decoded once, so handle double encoding)
        decoded = urllib.parse.unquote(stripped)
        if "%2e" in decoded.lower() or "%25" in decoded:
            decoded = urllib.parse.unquote(decoded)

        if allowed_prefix:
            if raw.startswith("uploads/"):
                subpath = raw[len("uploads/"):]
                return (UPLOADS_DIR / subpath).resolve()
            return Path(raw).resolve()

        if decoded.startswith("/"):
            return Path(decoded).resolve()
        return (UPLOADS_DIR / decoded).resolve()


@app.get("/api/download")
def download_file(request: Request, file: str = Query("")):
    diff = get_difficulty(request)
    raw_file = get_raw_query_param(request, "file", file)
    if not raw_file:
        raise HTTPException(status_code=400, detail="Missing 'file' parameter")

    target = resolve_traversal_path(request, raw_file, diff)

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"File not found: {target.name} (Resolved path: {target})"
        )

    # If the user traversed to read flag_traversal.txt, ensure active difficulty flag is served
    if target.name in ["flag_traversal.txt", "traversal_easy.txt", "traversal_medium.txt", "traversal_hard.txt"]:
        if target.name == "flag_traversal.txt":
            content = FLAGS.get(f"traversal_{diff}", FLAGS["traversal_easy"]) + "\n"
        elif target.name == "traversal_easy.txt":
            content = FLAGS["traversal_easy"] + "\n"
        elif target.name == "traversal_medium.txt":
            content = FLAGS["traversal_medium"] + "\n"
        else:
            content = FLAGS["traversal_hard"] + "\n"
        return Response(content=content, media_type="text/plain")

    return FileResponse(path=str(target), filename=target.name)


@app.get("/api/preview")
def preview_file(request: Request, file: str = Query("")):
    diff = get_difficulty(request)
    raw_file = get_raw_query_param(request, "file", file)
    if not raw_file:
        raise HTTPException(status_code=400, detail="Missing 'file' parameter")

    target = resolve_traversal_path(request, raw_file, diff)

    if not target.exists() or not target.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"File not found: {target.name} (Resolved path: {target})"
        )

    try:
        if target.name == "flag_traversal.txt":
            content = FLAGS.get(f"traversal_{diff}", FLAGS["traversal_easy"]) + "\n"
        elif target.name == "traversal_easy.txt":
            content = FLAGS["traversal_easy"] + "\n"
        elif target.name == "traversal_medium.txt":
            content = FLAGS["traversal_medium"] + "\n"
        elif target.name == "traversal_hard.txt":
            content = FLAGS["traversal_hard"] + "\n"
        else:
            content = target.read_text(encoding="utf-8", errors="replace")

        return JSONResponse({
            "status": "success",
            "filename": target.name,
            "path": str(target),
            "content": content
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


# ==========================================
# 2. File Upload & Execution (file-share-upload)
# ==========================================

@app.post("/api/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
):
    diff = get_difficulty(request)
    filename = file.filename or "uploaded_file"

    # Difficulty defenses
    if diff == "easy":
        # No restrictions at all: scripts, archives, html allowed directly
        save_path = (UPLOADS_DIR / filename).resolve()
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        return {
            "status": "success",
            "filename": filename,
            "saved_to": str(save_path.relative_to(BASE_DIR)),
            "difficulty": diff,
            "message": "File uploaded successfully with unrestricted permissions."
        }

    elif diff == "medium":
        # Naive extension blacklist: checks lowercase exact endings
        disallowed = [".py", ".sh", ".bash", ".exe"]
        # Case-sensitive check allows .PY, .Py, alternate extensions (.py3, .phtml), double ext (.py.txt)
        for ext in disallowed:
            if filename.endswith(ext):
                raise HTTPException(
                    status_code=400,
                    detail=f"Security Policy Violation: Executable extension '{ext}' is forbidden by blacklist."
                )

        save_path = (UPLOADS_DIR / filename).resolve()
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        return {
            "status": "success",
            "filename": filename,
            "saved_to": str(save_path.relative_to(BASE_DIR)),
            "difficulty": diff,
            "message": "File passed extension blacklist check and was uploaded."
        }

    else:  # hard
        # Whitelist or path traversal in filename / plugins destination
        # Vulnerability: filename is joined without basename sanitization!
        # filename='../../plugins/test.py' or 'plugins/test.py' escapes uploads
        save_path = (UPLOADS_DIR / filename).resolve()
        # If traversal resolved to root /plugins, redirect to application PLUGINS_DIR
        if str(save_path).startswith("/plugins"):
            rel_name = os.path.basename(str(save_path))
            save_path = (PLUGINS_DIR / rel_name).resolve()

        # If inside plugins directory or escaping uploads:
        is_plugin = "plugins" in str(save_path)

        # Strict whitelist only enforced if staying inside uploads/
        if not is_plugin:
            allowed_exts = [".txt", ".pdf", ".md", ".csv", ".json", ".zip", ".png", ".jpg"]
            ext = os.path.splitext(filename)[1].lower()
            if ext not in allowed_exts:
                raise HTTPException(
                    status_code=400,
                    detail=f"Hard Policy Violation: Only safe document extensions ({', '.join(allowed_exts)}) permitted in standard uploads."
                )

        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        res = {
            "status": "success",
            "filename": filename,
            "saved_to": str(save_path),
            "difficulty": diff,
            "message": "File uploaded successfully."
        }

        if is_plugin:
            res["notice"] = "Plugin registered in plugins directory!"
            res["flag"] = FLAGS["upload_hard"]

        return res


@app.post("/api/upload/archive")
async def upload_archive(request: Request, file: UploadFile = File(...)):
    """
    Zip Slip archive extraction endpoint for hard difficulty.
    Extracts zip archive entries directly to UPLOADS_DIR without validating ../.
    """
    diff = get_difficulty(request)
    zip_path = UPLOADS_DIR / "temp_archive.zip"
    with open(zip_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    extracted_files = []
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.namelist():
                # In hard mode: Zip Slip vulnerability exists
                dest = (UPLOADS_DIR / member).resolve()
                dest.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as source, open(dest, "wb") as target:
                    shutil.copyfileobj(source, target)
                extracted_files.append(str(dest))
    finally:
        if zip_path.exists():
            zip_path.unlink()

    escaped_to_plugins = any("plugins" in p for p in extracted_files)
    res = {
        "status": "success",
        "extracted_count": len(extracted_files),
        "files": extracted_files,
        "difficulty": diff,
    }
    if escaped_to_plugins:
        res["notice"] = "Zip Slip detected: File extracted to plugins directory!"
        res["flag"] = FLAGS["upload_hard"]
    return res


@app.post("/api/execute")
async def execute_script(request: Request):
    """
    Script Runner Endpoint.
    Executes an uploaded script (.py, .PY, .py3, .phtml, .sh) or plugin.
    """
    diff = get_difficulty(request)
    data = {}
    try:
        data = await request.json()
    except Exception:
        pass

    filename = data.get("file") or request.query_params.get("file")
    if not filename:
        raise HTTPException(status_code=400, detail="Missing 'file' parameter to execute.")

    # Locate script
    candidate = (UPLOADS_DIR / filename).resolve()
    if not candidate.exists():
        candidate = (PLUGINS_DIR / filename).resolve()
    if not candidate.exists():
        candidate = (BASE_DIR / filename).resolve()

    if not candidate.exists() or not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"Script file '{filename}' not found.")

    ext = candidate.suffix.lower()
    cmd = []
    if ext in [".py", ".py3", ".phtml", ".pyw"] or filename.lower().endswith(".py"):
        cmd = ["python3", str(candidate)]
    elif ext in [".sh", ".bash"] or filename.lower().endswith(".sh"):
        cmd = ["bash", str(candidate)]
    elif ext in [".txt", ".png", ".gif", ".jpg"]:
        # Polyglot execution support
        cmd = ["python3", str(candidate)]
    else:
        cmd = ["python3", str(candidate)]

    env = os.environ.copy()
    env["FLAG_FILE_SHARE_UPLOAD_EASY"] = FLAGS["upload_easy"]
    env["FLAG_FILE_SHARE_UPLOAD_MEDIUM"] = FLAGS["upload_medium"]
    env["FLAG_FILE_SHARE_UPLOAD_HARD"] = FLAGS["upload_hard"]
    env["FLAG_FILE_SHARE_MIME_MEDIUM"] = FLAGS["mime_medium"]

    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5,
            cwd=str(BASE_DIR),
            env=env
        )
        output = proc.stdout + (("\nSTDERR:\n" + proc.stderr) if proc.stderr else "")
    except subprocess.TimeoutExpired:
        output = "Execution timed out (5s limit)."
    except Exception as e:
        output = f"Execution error: {str(e)}"

    # Determine awarded flag based on execution and active difficulty
    flag = None
    if diff == "easy":
        flag = FLAGS["upload_easy"]
    elif diff == "medium":
        flag = FLAGS["upload_medium"]
    elif diff == "hard":
        if "plugins" in str(candidate):
            flag = FLAGS["upload_hard"]

    # Also detect if this is a polyglot image execution for MIME medium
    if ext in [".gif", ".png", ".jpg"] or filename.startswith("polyglot"):
        flag = FLAGS["mime_medium"]

    return {
        "status": "success",
        "file": candidate.name,
        "difficulty": diff,
        "output": output,
        "flag": flag
    }


@app.post("/api/plugins/run")
async def run_plugin(request: Request):
    diff = get_difficulty(request)
    data = {}
    try:
        data = await request.json()
    except Exception:
        pass
    plugin_name = data.get("plugin") or request.query_params.get("plugin")
    if not plugin_name:
        raise HTTPException(status_code=400, detail="Missing 'plugin' parameter.")

    plugin_path = (PLUGINS_DIR / plugin_name).resolve()
    if not plugin_path.exists():
        raise HTTPException(status_code=404, detail=f"Plugin '{plugin_name}' not found.")

    env = os.environ.copy()
    env["FLAG_FILE_SHARE_UPLOAD_HARD"] = FLAGS["upload_hard"]

    try:
        proc = subprocess.run(
            ["python3", str(plugin_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5,
            cwd=str(BASE_DIR),
            env=env
        )
        output = proc.stdout + (("\nSTDERR:\n" + proc.stderr) if proc.stderr else "")
    except Exception as e:
        output = str(e)

    return {
        "status": "success",
        "plugin": plugin_name,
        "output": output,
        "flag": FLAGS["upload_hard"]
    }


# ==========================================
# 3. Weak MIME Validation (file-share-mime)
# ==========================================

MAGIC_BYTES = {
    "png": b"\x89PNG\r\n\x1a\n",
    "gif89a": b"GIF89a",
    "gif87a": b"GIF87a",
    "jpg": b"\xff\xd8\xff",
}


@app.post("/api/upload/image")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
):
    diff = get_difficulty(request)
    filename = file.filename or "media_upload"
    content = await file.read()
    content_type = file.content_type or ""

    if diff == "easy":
        # Only checks client-supplied Content-Type header
        valid_types = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]
        if content_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"MIME Error: Client Content-Type '{content_type}' is not allowed. Must be one of {valid_types}."
            )

        save_path = UPLOADS_DIR / filename
        save_path.write_bytes(content)

        return {
            "status": "success",
            "filename": filename,
            "content_type": content_type,
            "difficulty": diff,
            "message": "Image accepted via Content-Type header validation.",
            "flag": FLAGS["mime_easy"]
        }

    elif diff == "medium":
        # Checks magic bytes (header bytes like \x89PNG, GIF89a, \xff\xd8\xff)
        # but allows executable script payload in the body!
        has_magic = (
            content.startswith(MAGIC_BYTES["png"])
            or content.startswith(MAGIC_BYTES["gif89a"])
            or content.startswith(MAGIC_BYTES["gif87a"])
            or content.startswith(MAGIC_BYTES["jpg"])
        )

        if not has_magic:
            raise HTTPException(
                status_code=400,
                detail="MIME Error: Magic byte verification failed! File header does not match PNG, GIF, or JPEG signature."
            )

        save_path = UPLOADS_DIR / filename
        save_path.write_bytes(content)

        # Detect script payload in body
        has_script_payload = any(
            token in content
            for token in [b"import ", b"print(", b"system(", b"FLAG", b"bash", b"python", b"<?php", b"<script"]
        )

        res = {
            "status": "success",
            "filename": filename,
            "magic_bytes_verified": True,
            "difficulty": diff,
            "message": "Image passed magic bytes verification."
        }

        if has_script_payload:
            res["notice"] = "Polyglot image with embedded script payload verified!"
            res["flag"] = FLAGS["mime_medium"]

        return res

    else:  # hard
        # Image parser vulnerable to XXE (SVG Parser)
        # Supports SVG vector graphics and parses them using lxml.etree with entity resolution
        save_path = UPLOADS_DIR / filename
        save_path.write_bytes(content)

        is_svg = (
            filename.lower().endswith(".svg")
            or "svg" in content_type.lower()
            or b"<svg" in content.lower()
        )

        if not is_svg:
            # Check magic bytes for raster images
            has_magic = any(content.startswith(m) for m in MAGIC_BYTES.values())
            if not has_magic:
                raise HTTPException(
                    status_code=400,
                    detail="Hard MIME Policy: Only verified images or SVG vector graphics accepted."
                )
            return {
                "status": "success",
                "filename": filename,
                "message": "Raster image verified and stored."
            }

        # Parse SVG with entity resolution enabled (XXE Vulnerability)
        try:
            from lxml import etree
            parser = etree.XMLParser(
                resolve_entities=True,
                load_dtd=True,
                no_network=False,
                huge_tree=True
            )
            tree = etree.fromstring(content, parser=parser)
            text_nodes = [el.text for el in tree.iter() if el.text and el.text.strip()]
            rendered = etree.tostring(tree, encoding="utf-8").decode("utf-8")

            combined_output = " ".join(text_nodes) + "\n" + rendered
            flag_found = FLAGS["mime_hard"] if FLAGS["mime_hard"] in combined_output else None

            return {
                "status": "success",
                "filename": filename,
                "difficulty": diff,
                "svg_parsed": True,
                "extracted_text": " ".join(text_nodes),
                "rendered_preview": rendered[:500],
                "flag": flag_found,
                "message": "SVG successfully processed by XML graphics engine."
            }
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"SVG Parser error: {str(e)}"
            )


@app.get("/api/images/process")
def process_image(request: Request, file: str = Query("")):
    """Process or analyze polyglot image."""
    diff = get_difficulty(request)
    if not file:
        raise HTTPException(status_code=400, detail="Missing 'file' parameter")

    target = (UPLOADS_DIR / file).resolve()
    if not target.exists():
        raise HTTPException(status_code=404, detail="Image file not found.")

    content = target.read_bytes()
    has_magic = any(content.startswith(m) for m in MAGIC_BYTES.values())
    has_script = any(token in content for token in [b"import ", b"print(", b"FLAG", b"system("])

    res = {
        "status": "success",
        "file": file,
        "magic_bytes": has_magic,
        "payload_detected": has_script,
        "difficulty": diff
    }
    if has_magic and has_script:
        res["flag"] = FLAGS["mime_medium"]

    return res


@app.post("/api/reset-files")
def reset_sample_files():
    """Restore sample files and clean temporary uploads."""
    shutil.rmtree(UPLOADS_DIR, ignore_errors=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    (UPLOADS_DIR / "welcome.txt").write_text(
        "Welcome to FileShare Pro!\n"
        "This enterprise storage portal allows teams to share documents, "
        "run automated data processing scripts, and preview media assets.\n"
    )

    demo_plugin = PLUGINS_DIR / "demo_plugin.py"
    if not demo_plugin.exists():
        demo_plugin.write_text(
            "# Demo automation plugin for FileShare Pro\n"
            "import os\n"
            "print('[Plugin: Demo] FileShare Pro plugin system active.')\n"
        )

    return {"status": "success", "message": "Sample files reset successfully."}
