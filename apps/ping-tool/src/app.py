#!/usr/bin/env python3
import os
import re
import socket
import subprocess
import urllib.parse
import ipaddress
import secrets
from flask import (
    Flask,
    request,
    jsonify,
    render_template,
    redirect,
    url_for,
    session,
    make_response
)
import requests

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(16))

# Default fallback flags adhering to VULNLAB{<32-hex-lowercase>}
DEFAULT_FLAGS = {
    'FLAG_PING_TOOL_RCE_EASY': 'VULNLAB{1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d}',
    'FLAG_PING_TOOL_RCE_MEDIUM': 'VULNLAB{2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e}',
    'FLAG_PING_TOOL_RCE_HARD': 'VULNLAB{3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f}',
    'FLAG_PING_TOOL_SSRF_EASY': 'VULNLAB{4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a}',
    'FLAG_PING_TOOL_SSRF_MEDIUM': 'VULNLAB{5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b}',
    'FLAG_PING_TOOL_SSRF_HARD': 'VULNLAB{6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c}',
    'FLAG_PING_TOOL_XSS_EASY': 'VULNLAB{7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d}',
    'FLAG_PING_TOOL_XSS_MEDIUM': 'VULNLAB{8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e}',
    'FLAG_PING_TOOL_XSS_HARD': 'VULNLAB{9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f}'
}

def get_flag(env_name: str) -> str:
    return os.environ.get(env_name, DEFAULT_FLAGS.get(env_name, 'VULNLAB{00000000000000000000000000000000}'))

def get_flags_dir() -> str:
    flags_dir = os.environ.get('FLAGS_DIR', '/app/flags')
    try:
        os.makedirs(flags_dir, exist_ok=True)
        return flags_dir
    except Exception:
        fallback = os.path.join(os.path.dirname(__file__), '..', 'flags')
        os.makedirs(fallback, exist_ok=True)
        return fallback

def update_rce_flag_files(current_difficulty: str):
    flags_dir = get_flags_dir()
    rce_easy = get_flag('FLAG_PING_TOOL_RCE_EASY')
    rce_medium = get_flag('FLAG_PING_TOOL_RCE_MEDIUM')
    rce_hard = get_flag('FLAG_PING_TOOL_RCE_HARD')

    # Write difficulty-specific flag files
    try:
        with open(os.path.join(flags_dir, 'flag_rce_easy.txt'), 'w') as f:
            f.write(rce_easy.strip() + '\n')
        with open(os.path.join(flags_dir, 'flag_rce_medium.txt'), 'w') as f:
            f.write(rce_medium.strip() + '\n')
        with open(os.path.join(flags_dir, 'flag_rce_hard.txt'), 'w') as f:
            f.write(rce_hard.strip() + '\n')

        # Active flag file accessed by generic payloads
        diff_map = {'easy': rce_easy, 'medium': rce_medium, 'hard': rce_hard}
        active_flag = diff_map.get(current_difficulty, rce_easy)
        with open(os.path.join(flags_dir, 'flag_rce.txt'), 'w') as f:
            f.write(active_flag.strip() + '\n')
    except Exception as e:
        app.logger.warning(f"Could not write flag files: {e}")

def get_current_difficulty() -> str:
    # Precedence: URL param > cookie > session > environment variable
    diff = request.args.get('difficulty') or request.cookies.get('difficulty') or session.get('difficulty')
    if not diff or diff not in ('easy', 'medium', 'hard'):
        diff = os.environ.get('PING_TOOL_DIFFICULTY', os.environ.get('DIFFICULTY', 'easy')).lower()
    if diff not in ('easy', 'medium', 'hard'):
        diff = 'easy'
    return diff

# Initialize flags at startup
with app.app_context():
    init_diff = os.environ.get('PING_TOOL_DIFFICULTY', os.environ.get('DIFFICULTY', 'easy')).lower()
    if init_diff not in ('easy', 'medium', 'hard'):
        init_diff = 'easy'
    update_rce_flag_files(init_diff)

# ---------------------------------------------------------------------------
# Core Diagnostic Endpoints
# ---------------------------------------------------------------------------

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/api/set-difficulty', methods=['POST'])
def set_difficulty():
    data = request.get_json(silent=True) or request.form
    new_diff = (data.get('difficulty') or '').lower()
    if new_diff in ('easy', 'medium', 'hard'):
        session['difficulty'] = new_diff
        update_rce_flag_files(new_diff)
        resp = jsonify({'status': 'ok', 'difficulty': new_diff})
        resp.set_cookie('difficulty', new_diff, max_age=86400, samesite='Lax')
        return resp
    return jsonify({'status': 'error', 'message': "Invalid difficulty. Choose 'easy', 'medium', or 'hard'."}), 400

@app.route('/difficulty/<mode>', methods=['GET'])
def switch_difficulty_mode(mode):
    mode = mode.lower()
    if mode in ('easy', 'medium', 'hard'):
        session['difficulty'] = mode
        update_rce_flag_files(mode)
        resp = redirect(request.referrer or url_for('index'))
        resp.set_cookie('difficulty', mode, max_age=86400, samesite='Lax')
        return resp
    return redirect(url_for('index'))

@app.route('/', methods=['GET'])
def index():
    difficulty = get_current_difficulty()
    update_rce_flag_files(difficulty)
    return render_template('index.html', difficulty=difficulty)

# ---------------------------------------------------------------------------
# Vulnerability 1: Ping Command Injection (ping-tool-rce)
# ---------------------------------------------------------------------------

@app.route('/api/ping', methods=['POST'])
def api_ping():
    difficulty = get_current_difficulty()
    update_rce_flag_files(difficulty)

    data = request.get_json(silent=True) or request.form
    host = str(data.get('host', '')).strip()
    count = str(data.get('count', '2')).strip()

    if not host:
        return jsonify({'success': False, 'error': 'Target host or IP address is required.'}), 400

    # Ensure count is safe
    if not count.isdigit() or int(count) < 1 or int(count) > 4:
        count = '2'

    # Difficulty-based filtering
    if difficulty == 'easy':
        # Unsanitized: Raw command string with shell=True
        pass
    elif difficulty == 'medium':
        # Blacklist common command separators: ;, &&, |
        blacklisted = [';', '&&', '|']
        for token in blacklisted:
            if token in host:
                return jsonify({
                    'success': False,
                    'error': f"Input validation failure: Forbidden delimiter '{token}' detected."
                }), 400
    elif difficulty == 'hard':
        # Blacklists spaces, ;, &, |, and command binaries: cat, sh, bash
        forbidden_chars = [';', '&', '|', ' ']
        for ch in forbidden_chars:
            if ch in host:
                return jsonify({
                    'success': False,
                    'error': f"Strict filter violation: Character '{ch}' is blocked."
                }), 400

        forbidden_words = ['cat', 'sh', 'bash']
        for word in forbidden_words:
            if re.search(r'\b' + re.escape(word) + r'\b', host, re.IGNORECASE):
                return jsonify({
                    'success': False,
                    'error': f"WAF Security Alert: Command binary '{word}' is strictly prohibited."
                }), 400

    # Execute system command
    cmd = f"ping -c {count} {host}"
    try:
        proc = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = proc.communicate(timeout=6)
        output = stdout if stdout else stderr
        return jsonify({
            'success': True,
            'command': f"ping -c {count} <redacted>" if difficulty == 'hard' else cmd,
            'output': output,
            'returncode': proc.returncode,
            'active_difficulty': difficulty
        })
    except subprocess.TimeoutExpired:
        proc.kill()
        return jsonify({'success': False, 'error': 'Command execution timed out after 6 seconds.'}), 504
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ---------------------------------------------------------------------------
# Vulnerability 2: Server-Side Request Forgery (ping-tool-ssrf)
# ---------------------------------------------------------------------------

@app.route('/internal/status', methods=['GET'])
def internal_status():
    client_ip = request.remote_addr
    # Strict loopback access check
    allowed_ips = ('127.0.0.1', '::1', 'testclient', 'localhost')
    if client_ip not in allowed_ips:
        return jsonify({
            'error': 'Access Denied: Internal control plane is strictly restricted to loopback clients.',
            'client_ip': client_ip
        }), 403

    difficulty = get_current_difficulty()
    flag_keys = {
        'easy': 'FLAG_PING_TOOL_SSRF_EASY',
        'medium': 'FLAG_PING_TOOL_SSRF_MEDIUM',
        'hard': 'FLAG_PING_TOOL_SSRF_HARD'
    }
    active_flag = get_flag(flag_keys.get(difficulty, 'FLAG_PING_TOOL_SSRF_EASY'))

    return jsonify({
        'status': 'operational',
        'service': 'core-diagnostic-control-plane',
        'active_difficulty': difficulty,
        'flag': active_flag,
        'diagnostics': {
            'memory_used_mb': 48.2,
            'active_daemons': 3,
            'loopback_secured': True
        }
    })

@app.route('/api/redirect', methods=['GET'])
def simulated_redirect():
    target = request.args.get('url') or request.args.get('target')
    if not target:
        return jsonify({'error': "Missing 'url' or 'target' query parameter"}), 400
    return redirect(target, code=302)

@app.route('/api/ssrf', methods=['POST'])
def api_ssrf():
    difficulty = get_current_difficulty()
    data = request.get_json(silent=True) or request.form
    url = str(data.get('url', '')).strip()

    if not url:
        return jsonify({'success': False, 'error': 'Target URL is required.'}), 400

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        return jsonify({'success': False, 'error': 'Only HTTP and HTTPS protocols are supported.'}), 400

    if difficulty == 'easy':
        # Unrestricted: fetches any user-supplied URL directly
        pass
    elif difficulty == 'medium':
        # Medium: naive string blacklist against localhost and 127.0.0.1
        lowered = url.lower()
        if 'localhost' in lowered or '127.0.0.1' in lowered:
            return jsonify({
                'success': False,
                'error': "Security Policy Violation: Hostnames 'localhost' and '127.0.0.1' are blocked by filter."
            }), 400
    elif difficulty == 'hard':
        # Hard: Resolves domain and performs CIDR check
        hostname = parsed.hostname
        if not hostname:
            return jsonify({'success': False, 'error': 'Invalid URL hostname.'}), 400

        try:
            resolved_ip = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(resolved_ip)

            # Flawed CIDR blacklist: developer only blacklisted 127.0.0.1/32 and 0.0.0.0/32
            # Bypassed via other loopback IPs (e.g. 127.0.0.2) or redirect (allow_redirects=True)
            blocked_cidrs = [
                ipaddress.ip_network('127.0.0.1/32'),
                ipaddress.ip_network('0.0.0.0/32')
            ]
            for cidr in blocked_cidrs:
                if ip_obj in cidr:
                    return jsonify({
                        'success': False,
                        'error': f"SSRF Protection Error: Resolved IP {resolved_ip} matches prohibited CIDR {cidr}."
                    }), 400
        except socket.gaierror as e:
            return jsonify({'success': False, 'error': f"DNS Resolution Failed: {e}"}), 400
        except Exception as e:
            return jsonify({'success': False, 'error': f"IP Verification Error: {e}"}), 400

    # Fetch URL
    try:
        resp = requests.get(
            url,
            timeout=5,
            allow_redirects=True,
            headers={'User-Agent': 'NetPulse-Diagnostic-Agent/1.0'},
            cookies={'difficulty': difficulty}
        )
        return jsonify({
            'success': True,
            'status_code': resp.status_code,
            'headers': dict(resp.headers),
            'body': resp.text[:4000],
            'url_final': resp.url,
            'active_difficulty': difficulty
        })
    except requests.RequestException as e:
        return jsonify({'success': False, 'error': f"HTTP Request Failed: {e}"}), 502

# ---------------------------------------------------------------------------
# Vulnerability 3: Reflected Cross-Site Scripting (ping-tool-xss)
# ---------------------------------------------------------------------------

@app.route('/lookup', methods=['GET', 'POST'])
def host_lookup():
    difficulty = get_current_difficulty()
    raw_host = request.values.get('host', '').strip()

    error_reflection = None
    js_context_reflection = ""
    lookup_success = False
    lookup_result = None

    if raw_host:
        # Check if it looks like a clean valid hostname/IP
        if re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', raw_host) or re.match(r'^\d{1,3}(\.\d{1,3}){3}$', raw_host):
            try:
                ip = socket.gethostbyname(raw_host)
                lookup_success = True
                lookup_result = f"Resolved {raw_host} -> {ip}"
            except Exception as e:
                error_reflection = raw_host
        else:
            # Trigger lookup diagnostic error feedback
            error_reflection = raw_host

    if error_reflection is not None:
        if difficulty == 'easy':
            # Raw reflection without sanitization, rendered with | safe
            pass
        elif difficulty == 'medium':
            # Strips <script> case-sensitive once (bypassable with <SCRIPT> or <img src=x onerror=...>)
            error_reflection = re.sub(r'<script>', '', error_reflection, count=1, flags=0)
        elif difficulty == 'hard':
            # Angle brackets sanitized to prevent HTML injection, but reflected into JS context
            js_context_reflection = error_reflection.replace('<', '&lt;').replace('>', '&gt;')
            error_reflection = js_context_reflection

    return render_template(
        'index.html',
        active_tab='lookup',
        difficulty=difficulty,
        queried_host=raw_host,
        lookup_success=lookup_success,
        lookup_result=lookup_result,
        error_reflection=error_reflection,
        js_context_reflection=js_context_reflection
    )

@app.route('/audit', methods=['GET'])
def audit_view():
    difficulty = get_current_difficulty()
    search = request.args.get('search', '').strip()

    error_reflection = None
    js_context_reflection = ""

    if search:
        if difficulty == 'easy':
            error_reflection = search
        elif difficulty == 'medium':
            error_reflection = re.sub(r'<script>', '', search, count=1, flags=0)
        elif difficulty == 'hard':
            js_context_reflection = search.replace('<', '&lt;').replace('>', '&gt;')
            error_reflection = js_context_reflection

    flag_keys = {
        'easy': 'FLAG_PING_TOOL_XSS_EASY',
        'medium': 'FLAG_PING_TOOL_XSS_MEDIUM',
        'hard': 'FLAG_PING_TOOL_XSS_HARD'
    }
    current_flag = get_flag(flag_keys.get(difficulty, 'FLAG_PING_TOOL_XSS_EASY'))

    resp = make_response(render_template(
        'audit.html',
        difficulty=difficulty,
        search=search,
        error_reflection=error_reflection,
        js_context_reflection=js_context_reflection,
        current_flag=current_flag
    ))
    resp.set_cookie('admin_session', current_flag, httponly=False)
    return resp

@app.route('/api/audit/logs', methods=['GET'])
def api_audit_logs():
    difficulty = get_current_difficulty()
    search = request.args.get('search', '').strip()

    flag_keys = {
        'easy': 'FLAG_PING_TOOL_XSS_EASY',
        'medium': 'FLAG_PING_TOOL_XSS_MEDIUM',
        'hard': 'FLAG_PING_TOOL_XSS_HARD'
    }
    current_flag = get_flag(flag_keys.get(difficulty, 'FLAG_PING_TOOL_XSS_EASY'))

    reflected = None
    if search:
        if difficulty == 'easy':
            reflected = search
        elif difficulty == 'medium':
            reflected = re.sub(r'<script>', '', search, count=1, flags=0)
        elif difficulty == 'hard':
            reflected = search.replace('<', '&lt;').replace('>', '&gt;')

    return jsonify({
        'status': 'ok',
        'active_difficulty': difficulty,
        'admin_session': current_flag,
        'flag': current_flag,
        'reflected_query': reflected,
        'audit_records': [
            {'id': 101, 'operator': 'admin', 'service': 'ping-daemon', 'action': 'PING 10.0.0.1', 'status': 'SUCCESS'},
            {'id': 102, 'operator': 'system', 'service': 'ssrf-agent', 'action': 'CHECK internal-control-plane', 'status': 'SUCCESS'},
            {'id': 103, 'operator': 'admin', 'service': 'audit-search', 'action': f"QUERY '{search or 'system'}'", 'status': 'FILTERED'}
        ]
    })

@app.route('/api/report', methods=['GET', 'POST'])
def report_to_admin():
    """
    Simulated Admin Bot: Visits reported URL or evaluates payload.
    If valid XSS is detected for the active difficulty, returns the leaked admin session cookie containing the flag.
    """
    difficulty = get_current_difficulty()
    data = request.get_json(silent=True) or request.values
    target_url = (data.get('url') or '').strip()

    if not target_url:
        return jsonify({'status': 'error', 'message': "Missing 'url' parameter to report to administrator."}), 400

    flag_keys = {
        'easy': 'FLAG_PING_TOOL_XSS_EASY',
        'medium': 'FLAG_PING_TOOL_XSS_MEDIUM',
        'hard': 'FLAG_PING_TOOL_XSS_HARD'
    }
    active_flag = get_flag(flag_keys.get(difficulty, 'FLAG_PING_TOOL_XSS_EASY'))

    # Parse parameters from URL to inspect payload
    parsed = urllib.parse.urlparse(target_url)
    query_params = urllib.parse.parse_qs(parsed.query)

    payloads = []
    for k, v_list in query_params.items():
        payloads.extend(v_list)
    if not payloads:
        payloads = [target_url]

    xss_success = False
    for p in payloads:
        unquoted = urllib.parse.unquote(p)
        if difficulty == 'easy':
            # Raw <script> or event handlers
            if '<script' in unquoted.lower() or 'onerror' in unquoted.lower() or 'onload' in unquoted.lower():
                xss_success = True
                break
        elif difficulty == 'medium':
            # Case bypass <SCRIPT> or alternative tags like <img onerror=...>, <svg onload=...>
            if '<SCRIPT>' in unquoted or '<img' in unquoted.lower() or '<svg' in unquoted.lower() or '<iframe' in unquoted.lower():
                xss_success = True
                break
        elif difficulty == 'hard':
            # String breakout syntax inside JS context: "; ... // or '; ... //
            if any(tok in unquoted for tok in ['";', "';", '";alert', "';alert", '";fetch', "';fetch"]):
                xss_success = True
                break

    if xss_success:
        return jsonify({
            'status': 'success',
            'visited_url': target_url,
            'xss_executed': True,
            'message': 'Admin bot navigated to URL. Reflected XSS executed in administrator session context!',
            'leaked_cookie': f"admin_session={active_flag}",
            'flag': active_flag
        })
    else:
        return jsonify({
            'status': 'visited',
            'visited_url': target_url,
            'xss_executed': False,
            'message': f"Admin bot visited the URL, but the payload did not execute under active difficulty '{difficulty}' filter."
        })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8005))
    app.run(host='0.0.0.0', port=port, threaded=True)
