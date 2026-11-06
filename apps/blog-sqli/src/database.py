import sqlite3
import os
import hashlib
from datetime import datetime

DATABASE_PATH = os.environ.get('DATABASE_PATH', '/tmp/blog.db')


def get_flag(var_name: str) -> str:
    """Retrieve flag from environment or generate compliant fallback."""
    val = os.environ.get(var_name)
    if val and val.strip():
        return val.strip()
    # Fallback matching VULNLAB{<32-hex-lowercase>}
    digest = hashlib.md5(f"seed_{var_name}".encode('utf-8')).hexdigest()
    return f"VULNLAB{{{digest}}}"


def get_db():
    """Get a SQLite database connection with row factory."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database schema and seed initial data if not present."""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        bio TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TEXT NOT NULL,
        views INTEGER DEFAULT 0
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT DEFAULT 'approved',
        FOREIGN KEY (post_id) REFERENCES posts (id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        flag TEXT NOT NULL,
        description TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # Seed users if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        admin_pass = hashlib.sha256(b"admin_ctf_super_secret_blog_2026").hexdigest()[:20]
        cursor.execute(
            "INSERT INTO users (username, password, role, bio) VALUES (?, ?, ?, ?)",
            ("admin", admin_pass, "admin", "Lead Security Engineer & System Administrator")
        )
        cursor.execute(
            "INSERT INTO users (username, password, role, bio) VALUES (?, ?, ?, ?)",
            ("alice", "alicepassword123", "author", "Junior Web Developer & Tech Blogger")
        )
        cursor.execute(
            "INSERT INTO users (username, password, role, bio) VALUES (?, ?, ?, ?)",
            ("bob", "bobpassword456", "author", "Cybersecurity Researcher & Bug Hunter")
        )

    # Seed posts if empty
    cursor.execute("SELECT COUNT(*) FROM posts")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO posts (title, content, author, created_at, views) VALUES (?, ?, ?, ?, ?)",
            (
                "Welcome to VulnLab Security Blog!",
                "This blog is dedicated to exploring web application security, modern vulnerability patterns, and defensive engineering. Stay tuned for tutorials on injection flaws, access controls, and authentication mechanisms.",
                "alice",
                "2026-01-15 10:00:00",
                42
            )
        )
        cursor.execute(
            "INSERT INTO posts (title, content, author, created_at, views) VALUES (?, ?, ?, ?, ?)",
            (
                "Understanding SQL Injections in Modern Applications",
                "SQL Injection remains one of the most critical web risks in the OWASP Top 10. While parameterized queries effectively eliminate injection vectors, legacy codebases and dynamic query concatenation still expose database layers to exploitation.",
                "admin",
                "2026-02-01 14:30:00",
                128
            )
        )
        cursor.execute(
            "INSERT INTO posts (title, content, author, created_at, views) VALUES (?, ?, ?, ?, ?)",
            (
                "Cross-Site Scripting (XSS) Mechanics and Browser Contexts",
                "Stored and reflected XSS vulnerabilities occur when untrusted input is embedded into the DOM without appropriate contextual escaping or strict Content Security Policies (CSP). Always sanitize user-provided markup!",
                "bob",
                "2026-02-10 09:15:00",
                95
            )
        )

    # Seed comments if empty
    cursor.execute("SELECT COUNT(*) FROM comments")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO comments (post_id, author_name, content, created_at) VALUES (?, ?, ?, ?)",
            (1, "bob", "Great inaugural post, Alice! Looking forward to the tutorials.", "2026-01-15 11:20:00")
        )
        cursor.execute(
            "INSERT INTO comments (post_id, author_name, content, created_at) VALUES (?, ?, ?, ?)",
            (2, "alice", "Parameterized queries are definitely the right way to go.", "2026-02-01 15:45:00")
        )

    # Refresh flags on startup so environment variable changes take effect immediately
    cursor.execute("DELETE FROM flags")
    cursor.execute(
        "INSERT INTO flags (name, flag, description) VALUES (?, ?, ?)",
        ("flag_blog_sqli_union_easy", get_flag("FLAG_BLOG_SQLI_UNION_EASY"), "UNION SQL Injection Easy Flag")
    )
    cursor.execute(
        "INSERT INTO flags (name, flag, description) VALUES (?, ?, ?)",
        ("flag_blog_sqli_union_medium", get_flag("FLAG_BLOG_SQLI_UNION_MEDIUM"), "UNION SQL Injection Medium Flag")
    )
    cursor.execute(
        "INSERT INTO flags (name, flag, description) VALUES (?, ?, ?)",
        ("flag_blog_sqli_union_hard", get_flag("FLAG_BLOG_SQLI_UNION_HARD"), "UNION SQL Injection Hard Flag")
    )

    conn.commit()
    conn.close()
