import os
import re
import hashlib
from datetime import datetime
from flask import (
    Flask, request, session, redirect, url_for, render_template,
    jsonify, flash
)
from database import get_db, init_db, get_flag

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'vulnlab-insecure-secret-key-blog-sqli')


def get_current_difficulty() -> str:
    """Determine the active difficulty level (easy, medium, hard)."""
    # 1. URL query param override
    param = request.args.get('difficulty')
    if param and param.lower() in ('easy', 'medium', 'hard'):
        return param.lower()

    # 2. HTTP header override
    header = request.headers.get('X-Difficulty')
    if header and header.lower() in ('easy', 'medium', 'hard'):
        return header.lower()

    # 3. Session override
    sess_diff = session.get('difficulty')
    if sess_diff and sess_diff.lower() in ('easy', 'medium', 'hard'):
        return sess_diff.lower()

    # 4. Cookie override
    cookie_diff = request.cookies.get('ctf_difficulty')
    if cookie_diff and cookie_diff.lower() in ('easy', 'medium', 'hard'):
        return cookie_diff.lower()

    # 5. Environment variable default
    env_diff = os.environ.get('BLOG_SQLI_DIFFICULTY') or os.environ.get('DIFFICULTY', 'easy')
    return env_diff.lower() if env_diff.lower() in ('easy', 'medium', 'hard') else 'easy'


@app.context_processor
def inject_difficulty():
    return {'difficulty': get_current_difficulty()}


@app.route('/health')
def healthcheck():
    """Healthcheck endpoint required by Docker and platform."""
    return jsonify({"status": "ok"}), 200


@app.route('/set-difficulty')
def set_difficulty():
    """Switch active difficulty via UI."""
    mode = request.args.get('mode', 'easy').lower()
    if mode in ('easy', 'medium', 'hard'):
        session['difficulty'] = mode
        flash(f"Switched difficulty mode to {mode.upper()}.", "info")
    target = request.referrer or url_for('index')
    resp = redirect(target)
    resp.set_cookie('ctf_difficulty', mode, max_age=86400)
    return resp


@app.route('/api/difficulty', methods=['GET', 'POST'])
def api_difficulty():
    """API endpoint to view or update difficulty."""
    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        mode = (data.get('difficulty') or data.get('mode') or '').lower()
        if mode in ('easy', 'medium', 'hard'):
            session['difficulty'] = mode
            resp = jsonify({"status": "ok", "difficulty": mode})
            resp.set_cookie('ctf_difficulty', mode, max_age=86400)
            return resp
        return jsonify({"error": "Invalid difficulty. Choose easy, medium, or hard."}), 400
    return jsonify({"difficulty": get_current_difficulty()})


# ----------------------------------------------------------------------
# 1. Feed & Search (Vulnerability: blog-sqli-union)
# ----------------------------------------------------------------------

@app.route('/')
def index():
    query = request.args.get('q')
    difficulty = get_current_difficulty()
    conn = get_db()
    cursor = conn.cursor()

    if query is not None and query != '':
        # UNION SQL Injection processing
        sql_query = None

        if difficulty == 'easy':
            # Easy: No sanitization, directly formatted into query
            sql_query = f"SELECT id, title, content, created_at, author FROM posts WHERE title LIKE '%{query}%' OR content LIKE '%{query}%'"

        elif difficulty == 'medium':
            # Medium: Single-pass keyword stripping of UNION and SELECT
            filtered_q = re.sub(r'UNION', '', query, count=1, flags=re.IGNORECASE)
            filtered_q = re.sub(r'SELECT', '', filtered_q, count=1, flags=re.IGNORECASE)
            sql_query = f"SELECT id, title, content, created_at, author FROM posts WHERE title LIKE '%{filtered_q}%' OR content LIKE '%{filtered_q}%'"

        elif difficulty == 'hard':
            # Hard: Prohibits literal spaces and standard keyword sequences
            if ' ' in query:
                flash("WAF Block: Spaces are strictly prohibited in Hard mode search!", "danger")
                return render_template('index.html', results=[], query=query), 400

            if re.search(r'(union\s+select|from\s+flags)', query, re.IGNORECASE):
                flash("WAF Block: Prohibited keyword sequence detected!", "danger")
                return render_template('index.html', results=[], query=query), 400

            sql_query = f"SELECT id, title, content, created_at, author FROM posts WHERE title LIKE '%{query}%' OR content LIKE '%{query}%'"

        try:
            cursor.execute(sql_query)
            results = cursor.fetchall()
        except Exception as e:
            flash(f"Database Query Error: {e}", "danger")
            results = []
    else:
        cursor.execute("SELECT id, title, content, created_at, author FROM posts ORDER BY id DESC")
        results = cursor.fetchall()

    conn.close()

    if request.headers.get('Accept') == 'application/json':
        posts_data = [
            {"id": r[0], "title": r[1], "content": r[2], "created_at": r[3], "author": r[4] if len(r) > 4 else "Unknown"}
            for r in results
        ]
        return jsonify({"results": posts_data})

    return render_template('index.html', results=results, query=query)


@app.route('/post/<int:post_id>')
def view_post(post_id):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, title, content, author, created_at, views FROM posts WHERE id = ?", (post_id,))
    post = cursor.fetchone()
    if not post:
        conn.close()
        flash("Post not found.", "warning")
        return redirect(url_for('index'))

    # Increment view count
    cursor.execute("UPDATE posts SET views = views + 1 WHERE id = ?", (post_id,))
    conn.commit()

    cursor.execute("SELECT id, author_name, content, created_at FROM comments WHERE post_id = ? ORDER BY id ASC", (post_id,))
    comments = cursor.fetchall()
    conn.close()

    return render_template('post.html', post=post, comments=comments)


# ----------------------------------------------------------------------
# 2. Comments & Stored XSS (Vulnerability: blog-sqli-xss)
# ----------------------------------------------------------------------

@app.route('/post/<int:post_id>/comment', methods=['POST'])
def add_comment(post_id):
    difficulty = get_current_difficulty()
    author_name = request.form.get('author_name', 'Anonymous').strip() or 'Anonymous'
    raw_content = request.form.get('content', '')

    if not raw_content:
        flash("Comment cannot be empty.", "warning")
        return redirect(url_for('view_post', post_id=post_id))

    # XSS Filtering based on difficulty
    if difficulty == 'easy':
        # Easy: No sanitization, stored raw
        sanitized_content = raw_content

    elif difficulty == 'medium':
        # Medium: Strips lowercase/standard <script> tags once
        # Bypassable with <SCRIPT> or <img onerror> or <svg>
        sanitized_content = re.sub(r'<script[^>]*>.*?</script>', '', raw_content)
        sanitized_content = re.sub(r'</?script[^>]*>', '', sanitized_content)

    elif difficulty == 'hard':
        # Hard: Strips all <script> tags case-insensitively AND whitespace-delimited onerror/onload
        # Bypassable with <svg/onload=...> or <iframe srcdoc=...> or <a href="javascript:...">
        sanitized_content = re.sub(r'</?script[^>]*>', '', raw_content, flags=re.IGNORECASE)
        sanitized_content = re.sub(r'\s+(onerror|onload)\s*=', '', sanitized_content, flags=re.IGNORECASE)

    conn = get_db()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO comments (post_id, author_name, content, created_at) VALUES (?, ?, ?, ?)",
        (post_id, author_name, sanitized_content, now_str)
    )
    conn.commit()
    conn.close()

    flash("Comment submitted successfully!", "success")
    return redirect(url_for('view_post', post_id=post_id))


def evaluate_xss_in_comment(content: str) -> tuple[bool, str]:
    """Simulate browser JS parsing of rendered comment HTML."""
    # Check 1: script tags (any casing)
    if re.search(r'<script[^>]*>', content, re.IGNORECASE):
        return True, "Executed <script> tag"
    # Check 2: event handlers (with whitespace, slash, or newline)
    if re.search(r'[\s/]+on[a-z]+\s*=', content, re.IGNORECASE):
        return True, "Executed inline event handler"
    # Check 3: javascript: pseudo-protocol in href or src
    if re.search(r'(href|src|formaction)\s*=\s*["\']?\s*javascript:', content, re.IGNORECASE):
        return True, "Executed javascript: URI"
    # Check 4: iframe srcdoc context
    if re.search(r'<iframe[^>]+srcdoc\s*=', content, re.IGNORECASE):
        return True, "Executed iframe srcdoc context"
    # Check 5: HTML tag event handler directly attached
    if re.search(r'<(svg|img|body|iframe|object|embed|input|details)[^>]+(onload|onerror|onfocus|ontoggle|onmouseover)', content, re.IGNORECASE):
        return True, "Executed tag event handler"

    return False, ""


@app.route('/api/admin/visit-comments', methods=['GET', 'POST'])
def admin_visit_comments():
    """Simulate admin bot visiting blog comments with administrative session cookie."""
    difficulty = get_current_difficulty()
    post_id = request.args.get('post_id')

    flag_var = f"FLAG_BLOG_SQLI_XSS_{difficulty.upper()}"
    flag_val = get_flag(flag_var)

    conn = get_db()
    cursor = conn.cursor()

    if post_id:
        cursor.execute("SELECT id, content FROM comments WHERE post_id = ? ORDER BY id DESC LIMIT 10", (post_id,))
    else:
        cursor.execute("SELECT id, content FROM comments ORDER BY id DESC LIMIT 20")
    comments = cursor.fetchall()

    xss_triggered = False
    triggered_comment_id = None
    trigger_detail = ""

    for c in comments:
        cid, content = c[0], c[1]
        is_xss, detail = evaluate_xss_in_comment(content)
        if is_xss:
            xss_triggered = True
            triggered_comment_id = cid
            trigger_detail = detail
            break

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if xss_triggered:
        log_entry = (
            f"[ADMIN BOT] Visited comments. Exploit triggered via comment #{triggered_comment_id} ({trigger_detail})! "
            f"Exfiltrated cookie: admin_flag={flag_val}"
        )
        cursor.execute(
            "INSERT INTO admin_logs (action, details, created_at) VALUES (?, ?, ?)",
            ("XSS Exploit Triggered", log_entry, now_str)
        )
        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "xss_triggered": True,
            "message": "Admin bot visited the page and executed your injected payload! Admin session cookie compromised.",
            "flag": flag_val,
            "admin_log": log_entry
        }), 200
    else:
        log_entry = "[ADMIN BOT] Visited comments. All comments were safely displayed. No executable script payload detected."
        cursor.execute(
            "INSERT INTO admin_logs (action, details, created_at) VALUES (?, ?, ?)",
            ("Admin Bot Review", log_entry, now_str)
        )
        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "xss_triggered": False,
            "message": "Admin bot reviewed comments. All content was safely rendered. No scripts executed.",
            "flag": None,
            "admin_log": log_entry
        }), 200


@app.route('/api/exfil', methods=['GET', 'POST'])
def api_exfil():
    """Exfiltration receiver endpoint for XSS cookie stealing payloads."""
    data = request.args.to_dict() or request.get_json(silent=True) or request.form.to_dict()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO admin_logs (action, details, created_at) VALUES (?, ?, ?)",
        ("Exfiltration Received", str(data), now_str)
    )
    conn.commit()
    conn.close()

    return jsonify({"status": "received", "logged_at": now_str}), 200


# ----------------------------------------------------------------------
# 3. Authentication & SQLi Login Bypass (Vulnerability: blog-sqli-login)
# ----------------------------------------------------------------------

def execute_login_query(conn, raw_query: str):
    """Normalize and execute vulnerable login query with CTF compatibility."""
    normalized = raw_query

    # SQLite compatibility: translate # comment to --
    if '#' in normalized:
        normalized = normalized.split('#', 1)[0] + " --"

    # SQLite compatibility: close unclosed /* multi-line comments
    if '/*' in normalized and '*/' not in normalized:
        normalized = normalized + "*/"

    # SQLite compatibility: handle || as logical OR for auth bypass if used
    if "||" in normalized:
        normalized = normalized.replace("||", " OR ")

    cursor = conn.cursor()
    cursor.execute(normalized)
    return cursor.fetchone()


@app.route('/login', methods=['GET', 'POST'])
def login():
    difficulty = get_current_difficulty()
    is_json = request.is_json or request.headers.get('Accept') == 'application/json'

    if request.method == 'GET':
        return render_template('login.html', error=None)

    # Extract credentials
    if request.is_json:
        data = request.get_json(silent=True) or {}
        username = data.get('username', '')
        password = data.get('password', '')
    else:
        username = request.form.get('username', '')
        password = request.form.get('password', '')

    # Apply Difficulty Filters
    if difficulty == 'easy':
        # Easy: No filtering
        pass

    elif difficulty == 'medium':
        # Medium: blocks 'or'/'and'/'--' (case-insensitive regex)
        if re.search(r'\b(or|and)\b|--', username, re.IGNORECASE) or re.search(r'\b(or|and)\b|--', password, re.IGNORECASE):
            err_msg = "WAF Block: 'OR', 'AND', and '--' comments are strictly forbidden in Medium mode!"
            if is_json:
                return jsonify({"success": False, "error": err_msg}), 400
            return render_template('login.html', error=err_msg), 400

    elif difficulty == 'hard':
        # Hard: blocks spaces and standard comments (-- / /* / #)
        if ' ' in username or ' ' in password:
            err_msg = "WAF Block: Spaces are strictly prohibited in Hard mode!"
            if is_json:
                return jsonify({"success": False, "error": err_msg}), 400
            return render_template('login.html', error=err_msg), 400

        if re.search(r'--|/\*|#', username) or re.search(r'--|/\*|#', password):
            err_msg = "WAF Block: Comments are strictly prohibited in Hard mode!"
            if is_json:
                return jsonify({"success": False, "error": err_msg}), 400
            return render_template('login.html', error=err_msg), 400

    # Vulnerable SQL concatenation
    raw_query = f"SELECT id, username, password, role FROM users WHERE username = '{username}' AND password = '{password}'"

    conn = get_db()
    try:
        user = execute_login_query(conn, raw_query)
    except Exception as e:
        conn.close()
        err_msg = f"SQL Syntax Error: {e}"
        if is_json:
            return jsonify({"success": False, "error": err_msg}), 400
        return render_template('login.html', error=err_msg), 400

    if user:
        session['logged_in'] = True
        session['user_id'] = user[0]
        session['username'] = user[1]
        session['role'] = user[3]

        flag_var = f"FLAG_BLOG_SQLI_LOGIN_{difficulty.upper()}"
        flag_val = get_flag(flag_var)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO admin_logs (action, details, created_at) VALUES (?, ?, ?)",
            (f"Login Successful ({user[1]})", f"User authenticated with role '{user[3]}'", now_str)
        )
        conn.commit()
        conn.close()

        if is_json:
            return jsonify({
                "success": True,
                "message": f"Successfully authenticated as {user[1]}",
                "username": user[1],
                "role": user[3],
                "flag": flag_val if user[3] == 'admin' else None
            }), 200

        flash(f"Welcome back, {user[1]}!", "success")
        return redirect(url_for('admin_dashboard') if user[3] == 'admin' else url_for('index'))

    conn.close()
    err_msg = "Invalid credentials. Authentication failed."
    if is_json:
        return jsonify({"success": False, "error": err_msg}), 401
    return render_template('login.html', error=err_msg), 401


@app.route('/admin')
@app.route('/dashboard')
def admin_dashboard():
    """Administrative dashboard displaying the login bypass flag."""
    if not session.get('logged_in') or session.get('role') != 'admin':
        flash("Access Denied: Administrative privileges required.", "danger")
        return redirect(url_for('login'))

    difficulty = get_current_difficulty()
    flag_var = f"FLAG_BLOG_SQLI_LOGIN_{difficulty.upper()}"
    flag_val = get_flag(flag_var)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, bio FROM users")
    users = cursor.fetchall()

    cursor.execute("SELECT action, details, created_at FROM admin_logs ORDER BY id DESC LIMIT 15")
    logs = cursor.fetchall()
    conn.close()

    return render_template('dashboard.html', flag=flag_val, users=users, logs=logs)


@app.route('/logout')
def logout():
    session.clear()
    flash("You have been signed out.", "info")
    return redirect(url_for('index'))


# Initialize database schema and seeds on import
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8001))
    app.run(host='0.0.0.0', port=port, debug=False)
