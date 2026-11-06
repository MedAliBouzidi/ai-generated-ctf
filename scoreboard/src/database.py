import sqlite3
from typing import Optional, List, Dict, Any
from pathlib import Path
from src.config import DATABASE_PATH


def get_db_connection() -> sqlite3.Connection:
    """Create a SQLite connection with foreign keys enabled and row factory."""
    db_file = Path(DATABASE_PATH)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


def init_db():
    """Initialize database tables and indexes."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Players table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Stored flag hashes (HMAC-SHA256 only)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS challenge_hashes (
                challenge_id TEXT PRIMARY KEY,
                flag_hash TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Unlocked hints per player
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS unlocked_hints (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id INTEGER NOT NULL,
                challenge_id TEXT NOT NULL,
                hint_index INTEGER NOT NULL,
                cost INTEGER NOT NULL,
                unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
                UNIQUE(player_id, challenge_id, hint_index)
            );
        """)

        # Challenge solves
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS solves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id INTEGER NOT NULL,
                challenge_id TEXT NOT NULL,
                points_awarded INTEGER NOT NULL,
                is_first_blood BOOLEAN NOT NULL DEFAULT 0,
                solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
                UNIQUE(player_id, challenge_id)
            );
        """)

        # Indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_solves_player ON solves(player_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_solves_challenge ON solves(challenge_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hints_player ON unlocked_hints(player_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hints_challenge ON unlocked_hints(challenge_id);")
        
        conn.commit()


def save_challenge_hash(challenge_id: str, flag_hash: str):
    """Store or update HMAC-SHA256 hash for a challenge."""
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO challenge_hashes (challenge_id, flag_hash, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(challenge_id) DO UPDATE SET
                flag_hash = excluded.flag_hash,
                updated_at = CURRENT_TIMESTAMP;
        """, (challenge_id, flag_hash))
        conn.commit()


def get_challenge_hash(challenge_id: str) -> Optional[str]:
    """Retrieve stored HMAC-SHA256 hash for a challenge."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT flag_hash FROM challenge_hashes WHERE challenge_id = ?;",
            (challenge_id,)
        ).fetchone()
        return row["flag_hash"] if row else None


def get_or_create_player(username: str) -> Dict[str, Any]:
    """Find existing player or register new player."""
    clean_username = username.strip()
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id, username, created_at, last_active FROM players WHERE LOWER(username) = LOWER(?);",
            (clean_username,)
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE players SET last_active = CURRENT_TIMESTAMP WHERE id = ?;",
                (row["id"],)
            )
            conn.commit()
            return dict(row)
        
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO players (username) VALUES (?);",
            (clean_username,)
        )
        conn.commit()
        player_id = cursor.lastrowid
        row = conn.execute(
            "SELECT id, username, created_at, last_active FROM players WHERE id = ?;",
            (player_id,)
        ).fetchone()
        return dict(row)


def get_player_by_id(player_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve player by ID."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id, username, created_at, last_active FROM players WHERE id = ?;",
            (player_id,)
        ).fetchone()
        return dict(row) if row else None


def is_challenge_solved(player_id: int, challenge_id: str) -> bool:
    """Check if player has already solved the challenge."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM solves WHERE player_id = ? AND challenge_id = ?;",
            (player_id, challenge_id)
        ).fetchone()
        return row is not None


def is_first_blood_available(challenge_id: str) -> bool:
    """Check if any player has solved this challenge yet."""
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM solves WHERE challenge_id = ? LIMIT 1;",
            (challenge_id,)
        ).fetchone()
        return row is None


def get_first_blood_info(challenge_id: str) -> Optional[Dict[str, Any]]:
    """Get player info who achieved first blood on a challenge."""
    with get_db_connection() as conn:
        row = conn.execute("""
            SELECT s.solved_at, p.id AS player_id, p.username
            FROM solves s
            JOIN players p ON s.player_id = p.id
            WHERE s.challenge_id = ? AND s.is_first_blood = 1
            LIMIT 1;
        """, (challenge_id,)).fetchone()
        return dict(row) if row else None


def unlock_hint(player_id: int, challenge_id: str, hint_index: int, cost: int) -> bool:
    """Unlock a hint for a player. Returns True if unlocked or already unlocked."""
    with get_db_connection() as conn:
        try:
            conn.execute("""
                INSERT OR IGNORE INTO unlocked_hints (player_id, challenge_id, hint_index, cost)
                VALUES (?, ?, ?, ?);
            """, (player_id, challenge_id, hint_index, cost))
            conn.commit()
            return True
        except sqlite3.Error:
            return False


def get_player_unlocked_hints(player_id: int, challenge_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get all unlocked hints for a player, optionally filtered by challenge."""
    with get_db_connection() as conn:
        if challenge_id:
            rows = conn.execute("""
                SELECT challenge_id, hint_index, cost, unlocked_at
                FROM unlocked_hints
                WHERE player_id = ? AND challenge_id = ?
                ORDER BY hint_index ASC;
            """, (player_id, challenge_id)).fetchall()
        else:
            rows = conn.execute("""
                SELECT challenge_id, hint_index, cost, unlocked_at
                FROM unlocked_hints
                WHERE player_id = ?
                ORDER BY unlocked_at ASC;
            """, (player_id,)).fetchall()
        return [dict(r) for r in rows]


def get_hint_deductions_for_challenge(player_id: int, challenge_id: str) -> int:
    """Sum the cost of all hints unlocked by the player for this challenge."""
    with get_db_connection() as conn:
        row = conn.execute("""
            SELECT COALESCE(SUM(cost), 0) AS total_cost
            FROM unlocked_hints
            WHERE player_id = ? AND challenge_id = ?;
        """, (player_id, challenge_id)).fetchone()
        return int(row["total_cost"]) if row else 0


def record_solve(player_id: int, challenge_id: str, points_awarded: int, is_first_blood: bool) -> Dict[str, Any]:
    """Record a verified challenge solve."""
    with get_db_connection() as conn:
        conn.execute("""
            INSERT INTO solves (player_id, challenge_id, points_awarded, is_first_blood, solved_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
        """, (player_id, challenge_id, points_awarded, 1 if is_first_blood else 0))
        conn.commit()
        
        row = conn.execute("""
            SELECT id, player_id, challenge_id, points_awarded, is_first_blood, solved_at
            FROM solves
            WHERE player_id = ? AND challenge_id = ?;
        """, (player_id, challenge_id)).fetchone()
        return dict(row)


def get_player_solves(player_id: int) -> List[Dict[str, Any]]:
    """Retrieve all solves completed by a player."""
    with get_db_connection() as conn:
        rows = conn.execute("""
            SELECT challenge_id, points_awarded, is_first_blood, solved_at
            FROM solves
            WHERE player_id = ?
            ORDER BY solved_at DESC;
        """, (player_id,)).fetchall()
        return [dict(r) for r in rows]


def get_all_solves_summary() -> Dict[str, Dict[str, Any]]:
    """Get solve statistics (solve count, first blood) grouped by challenge_id."""
    with get_db_connection() as conn:
        rows = conn.execute("""
            SELECT 
                s.challenge_id,
                COUNT(s.id) AS solve_count,
                MAX(CASE WHEN s.is_first_blood = 1 THEN p.username ELSE NULL END) AS first_blood_player,
                MAX(CASE WHEN s.is_first_blood = 1 THEN s.solved_at ELSE NULL END) AS first_blood_time
            FROM solves s
            JOIN players p ON s.player_id = p.id
            GROUP BY s.challenge_id;
        """).fetchall()
        summary = {}
        for r in rows:
            summary[r["challenge_id"]] = {
                "solve_count": r["solve_count"],
                "first_blood_player": r["first_blood_player"],
                "first_blood_time": r["first_blood_time"]
            }
        return summary


def get_leaderboard() -> List[Dict[str, Any]]:
    """
    Get full leaderboard ordered by score DESC, then earliest last_solve_at ASC.
    Also includes solve count, first blood count, and solved challenges list.
    """
    with get_db_connection() as conn:
        # Get all players with aggregate score and solves
        rows = conn.execute("""
            SELECT 
                p.id AS player_id,
                p.username,
                COALESCE(SUM(s.points_awarded), 0) AS score,
                COUNT(s.id) AS solves_count,
                COALESCE(SUM(CASE WHEN s.is_first_blood = 1 THEN 1 ELSE 0 END), 0) AS first_bloods_count,
                MAX(s.solved_at) AS last_solve_time,
                p.created_at
            FROM players p
            LEFT JOIN solves s ON p.id = s.player_id
            GROUP BY p.id, p.username
            ORDER BY score DESC, 
                     CASE WHEN MAX(s.solved_at) IS NULL THEN 1 ELSE 0 END ASC,
                     last_solve_time ASC, 
                     p.created_at ASC;
        """).fetchall()
        
        # Get solves details for each player
        solves_by_player: Dict[int, List[Dict[str, Any]]] = {}
        solve_rows = conn.execute("""
            SELECT player_id, challenge_id, points_awarded, is_first_blood, solved_at
            FROM solves
            ORDER BY solved_at ASC;
        """).fetchall()
        for sr in solve_rows:
            solves_by_player.setdefault(sr["player_id"], []).append({
                "challenge_id": sr["challenge_id"],
                "points": sr["points_awarded"],
                "is_first_blood": bool(sr["is_first_blood"]),
                "solved_at": sr["solved_at"]
            })
            
        leaderboard = []
        rank = 1
        for r in rows:
            leaderboard.append({
                "rank": rank,
                "player_id": r["player_id"],
                "username": r["username"],
                "score": int(r["score"]),
                "solves_count": int(r["solves_count"]),
                "first_bloods_count": int(r["first_bloods_count"]),
                "last_solve_time": r["last_solve_time"],
                "solves": solves_by_player.get(r["player_id"], [])
            })
            rank += 1
            
        return leaderboard


def reset_scoreboard(reset_players: bool = False):
    """
    Reset all player submissions, hints, and leaderboard.
    Optionally removes players as well.
    """
    with get_db_connection() as conn:
        conn.execute("DELETE FROM solves;")
        conn.execute("DELETE FROM unlocked_hints;")
        if reset_players:
            conn.execute("DELETE FROM players;")
        conn.commit()
