import time
import math
import threading
from typing import Dict, List, Tuple
from src.config import RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_SECONDS


class SubmissionRateLimiter:
    """Thread-safe sliding window rate limiter for flag submissions."""
    def __init__(self, max_attempts: int = RATE_LIMIT_MAX_ATTEMPTS, window_seconds: int = RATE_LIMIT_WINDOW_SECONDS):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._history: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check_and_record(self, key: str) -> Tuple[bool, int]:
        """
        Check if key has exceeded allowed rate.
        If allowed, records this attempt and returns (True, 0).
        If rejected, returns (False, retry_after_seconds).
        """
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            timestamps = self._history.get(key, [])
            # Filter timestamps inside active window
            recent = [t for t in timestamps if t > window_start]

            if len(recent) >= self.max_attempts:
                # Calculate remaining wait time based on oldest timestamp in window
                oldest_in_window = recent[0]
                retry_after = max(1, math.ceil(oldest_in_window + self.window_seconds - now))
                self._history[key] = recent
                return False, retry_after

            # Record attempt
            recent.append(now)
            self._history[key] = recent
            return True, 0

    def reset_all(self):
        """Clear all rate limit history (used during admin reset)."""
        with self._lock:
            self._history.clear()


# Global rate limiter instance
flag_rate_limiter = SubmissionRateLimiter()
