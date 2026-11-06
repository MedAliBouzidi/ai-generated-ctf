// VulnLab CTF Scoreboard Frontend Application

const state = {
  user: null,
  token: localStorage.getItem("vulnlab_token") || null,
  challenges: [],
  leaderboard: [],
  filters: {
    app: "all",
    difficulty: "all",
    status: "all",
    search: ""
  },
  autoRefresh: true,
  refreshTimer: null,
  pendingHint: null
};

// ============================================================================
// API Helper
// ============================================================================

async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
    headers["X-Player-Token"] = state.token;
  }

  try {
    const res = await fetch(url, { credentials: "same-origin", credentials: "include", ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.detail || data.message || `Request failed with status ${res.status}`;
      if (res.status === 401 && !url.includes("/api/register")) {
        // Player not registered or expired
        showToast("Registration required. Please choose a handle.", "warning");
        openRegisterModal();
      } else if (res.status === 429) {
        showToast(errorMsg, "error");
      }
      throw new Error(errorMsg);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${url}:`, err);
    throw err;
  }
}

// ============================================================================
// Toast Notifications
// ============================================================================

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================================================
// User & Auth Management
// ============================================================================

async function fetchUserProfile() {
  if (!state.token) {
    updateUserUI();
    return;
  }

  try {
    const user = await apiFetch("/api/me");
    state.user = user;
    updateUserUI();
  } catch (e) {
    // Token invalid or reset
    state.token = null;
    state.user = null;
    localStorage.removeItem("vulnlab_token");
    updateUserUI();
  }
}

function updateUserUI() {
  const playerCard = document.getElementById("player-card");
  const authPromptBtn = document.getElementById("auth-prompt-btn");

  if (state.user) {
    playerCard.style.display = "flex";
    authPromptBtn.style.display = "none";

    document.getElementById("ui-player-name").textContent = state.user.username;
    document.getElementById("ui-player-score").textContent = `${state.user.score || 0} pts`;
    document.getElementById("ui-player-rank").textContent = state.user.rank ? `#${state.user.rank}` : "Unranked";
    document.getElementById("ui-player-bloods").textContent = `🩸 ${state.user.first_bloods_count || 0}`;
  } else {
    playerCard.style.display = "none";
    authPromptBtn.style.display = "inline-flex";
  }
}

async function registerPlayer(username) {
  try {
    const res = await apiFetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ username })
    });

    state.token = res.token;
    localStorage.setItem("vulnlab_token", res.token);
    showToast(`Welcome hacker ${res.username}!`, "success");
    closeModal("register-modal");

    await fetchUserProfile();
    await loadChallenges();
    await loadLeaderboard();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ============================================================================
// Challenges Logic
// ============================================================================

async function loadChallenges() {
  try {
    const challenges = await apiFetch("/api/challenges");
    state.challenges = challenges;
    renderChallenges();
  } catch (err) {
    console.error("Error loading challenges:", err);
  }
}

function renderChallenges() {
  const grid = document.getElementById("challenges-grid");
  if (!grid) return;

  const { app, difficulty, status, search } = state.filters;

  const filtered = state.challenges.filter(c => {
    if (app !== "all" && c.app !== app) return false;
    if (difficulty !== "all" && c.difficulty !== difficulty) return false;
    if (status === "solved" && !c.solved) return false;
    if (status === "unsolved" && c.solved) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = c.title.toLowerCase().includes(q) ||
                    c.category.toLowerCase().includes(q) ||
                    c.description.toLowerCase().includes(q) ||
                    c.id.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No challenges match your filters.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => {
    const diffClass = `badge-${c.difficulty}`;
    const solvedClass = c.solved ? "solved" : "";
    
    // First Blood tag
    const fbHtml = c.first_blood_player ? `
      <div class="first-blood-tag">
        🩸 First Blood: <strong>${escapeHtml(c.first_blood_player)}</strong>
      </div>
    ` : "";

    // Hints section
    const hintsHtml = c.hints && c.hints.length > 0 ? `
      <div class="hints-container">
        <div class="hints-header">
          <span>Hints Available (-25% pts each)</span>
          <span>${c.hints.filter(h => h.unlocked).length} / ${c.hints.length} unlocked</span>
        </div>
        ${c.hints.map((h, i) => {
          if (h.unlocked && h.text) {
            return `
              <div class="hint-item">
                <div class="hint-unlocked">
                  <strong>💡 Hint ${i + 1}:</strong> ${escapeHtml(h.text)}
                </div>
              </div>
            `;
          } else {
            return `
              <div class="hint-item">
                <button class="hint-locked-btn" onclick="promptUnlockHint('${c.id}', ${i}, ${h.cost}, '${escapeHtml(c.title)}')">
                  <span>🔒 Unlock Hint ${i + 1}</span>
                  <span style="color: var(--accent-amber);">-${h.cost} pts</span>
                </button>
              </div>
            `;
          }
        }).join("")}
      </div>
    ` : "";

    // Submission form
    const submitHtml = c.solved ? `
      <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--accent-green); text-align: center; padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 6px;">
        ✓ Solved (+${c.points_awarded || c.points} pts) ${c.is_first_blood ? "🩸 First Blood!" : ""}
      </div>
    ` : `
      <form class="submit-form" onsubmit="handleFlagSubmit(event, '${c.id}')">
        <input type="text" class="flag-input" placeholder="VULNLAB{...}" required id="flag-input-${c.id}" autocomplete="off" />
        <button type="submit" class="btn-submit" id="btn-submit-${c.id}">Submit</button>
      </form>
    `;

    return `
      <div class="challenge-card ${solvedClass}" id="card-${c.id}">
        <div>
          <div class="card-top">
            <div class="badges-row">
              <span class="badge ${diffClass}">${c.difficulty}</span>
              <span class="badge badge-app">${c.app}</span>
              <span class="badge badge-owasp">${c.owasp.split(":")[0]}</span>
            </div>
            <div class="points-pill">${c.points} pts</div>
          </div>
          <h3 class="card-title">${escapeHtml(c.title)}</h3>
          <p class="card-desc">${escapeHtml(c.description)}</p>
          ${fbHtml}
          ${hintsHtml}
        </div>
        <div>
          ${submitHtml}
        </div>
      </div>
    `;
  }).join("");
}

// ============================================================================
// Flag Submission Handler
// ============================================================================

async function handleFlagSubmit(event, challengeId) {
  event.preventDefault();
  if (!state.user) {
    showToast("Please register or login first!", "warning");
    openRegisterModal();
    return;
  }

  const input = document.getElementById(`flag-input-${challengeId}`);
  const btn = document.getElementById(`btn-submit-${challengeId}`);
  const flag = input ? input.value.trim() : "";

  if (!flag) return;

  btn.disabled = true;
  btn.textContent = "Checking...";

  try {
    const res = await apiFetch("/api/submit", {
      method: "POST",
      body: JSON.stringify({
        challenge_id: challengeId,
        flag: flag
      })
    });

    if (res.success) {
      showToast(res.message, "success");
      // Refresh user profile, challenges, and leaderboard
      await fetchUserProfile();
      await loadChallenges();
      await loadLeaderboard();
    } else {
      showToast(res.message, "error");
    }
  } catch (err) {
    // Handled in apiFetch
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Submit";
    }
  }
}

// ============================================================================
// Hint Unlock Modal & Flow
// ============================================================================

function promptUnlockHint(challengeId, hintIndex, cost, title) {
  if (!state.user) {
    showToast("Please register or login first!", "warning");
    openRegisterModal();
    return;
  }

  state.pendingHint = { challengeId, hintIndex, cost, title };
  document.getElementById("hint-modal-title").textContent = `Unlock Hint ${hintIndex + 1}`;
  document.getElementById("hint-modal-body").innerHTML = `
    Are you sure you want to unlock <strong>Hint ${hintIndex + 1}</strong> for <em>${title}</em>?<br><br>
    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.75rem; border-radius: 6px; color: var(--accent-amber); font-family: var(--font-mono); font-size: 0.85rem;">
      ⚠️ Penalty: <strong>-${cost} points</strong> will be permanently deducted from this challenge's reward upon solve.
    </div>
  `;
  openModal("hint-modal");
}

async function confirmUnlockHint() {
  if (!state.pendingHint) return;
  const { challengeId, hintIndex } = state.pendingHint;
  closeModal("hint-modal");

  try {
    const res = await apiFetch("/api/hint", {
      method: "POST",
      body: JSON.stringify({
        challenge_id: challengeId,
        hint_index: hintIndex
      })
    });

    showToast(res.message, "success");
    await loadChallenges();
  } catch (err) {
    // Handled in apiFetch
  } finally {
    state.pendingHint = null;
  }
}

// ============================================================================
// Leaderboard Logic
// ============================================================================

async function loadLeaderboard() {
  try {
    const board = await apiFetch("/api/leaderboard");
    state.leaderboard = board;
    renderLeaderboard();
  } catch (err) {
    console.error("Error loading leaderboard:", err);
  }
}

function renderLeaderboard() {
  const tbody = document.getElementById("leaderboard-body");
  if (!tbody) return;

  if (state.leaderboard.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No solves recorded yet. Be the first to strike!</td></tr>`;
    return;
  }

  tbody.innerHTML = state.leaderboard.map(entry => {
    let rankBadge = `<span class="rank-badge">${entry.rank}</span>`;
    if (entry.rank === 1) rankBadge = `<span class="rank-badge rank-1">🥇 1</span>`;
    else if (entry.rank === 2) rankBadge = `<span class="rank-badge rank-2">🥈 2</span>`;
    else if (entry.rank === 3) rankBadge = `<span class="rank-badge rank-3">🥉 3</span>`;

    const isCurrent = state.user && state.user.id === entry.player_id;
    const rowStyle = isCurrent ? "background: rgba(0, 240, 255, 0.08); border-left: 3px solid var(--accent-cyan);" : "";

    const lastSolveText = entry.last_solve_time ? formatTime(entry.last_solve_time) : "—";

    return `
      <tr style="${rowStyle}">
        <td>${rankBadge}</td>
        <td class="player-col">${escapeHtml(entry.username)} ${isCurrent ? "<em>(You)</em>" : ""}</td>
        <td class="score-col">${entry.score} pts</td>
        <td><span class="solves-pill">${entry.solves_count} solves</span></td>
        <td>${entry.first_bloods_count > 0 ? `<span style="color: var(--accent-red); font-family: var(--font-mono); font-weight: bold;">🩸 ${entry.first_bloods_count}</span>` : "—"}</td>
        <td style="color: var(--text-muted); font-size: 0.8rem; font-family: var(--font-mono);">${lastSolveText}</td>
      </tr>
    `;
  }).join("");
}

// ============================================================================
// Admin Reset
// ============================================================================

async function handleAdminReset(event) {
  event.preventDefault();
  const token = document.getElementById("admin-token-input").value.trim();
  const resetPlayers = document.getElementById("admin-reset-players").checked;

  if (!token) {
    showToast("Please enter the SCOREBOARD_SECRET token.", "warning");
    return;
  }

  if (!confirm("Are you sure you want to reset all scoreboard solves, hints, and leaderboard scores?")) {
    return;
  }

  try {
    const res = await apiFetch("/api/admin/reset", {
      method: "POST",
      body: JSON.stringify({
        token: token,
        reset_players: resetPlayers
      })
    });

    showToast(res.message, "success");
    if (resetPlayers) {
      state.user = null;
      state.token = null;
      localStorage.removeItem("vulnlab_token");
      updateUserUI();
    } else {
      await fetchUserProfile();
    }
    await loadChallenges();
    await loadLeaderboard();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ============================================================================
// UI Utilities & Modals
// ============================================================================

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("active");
}

function openRegisterModal() {
  const input = document.getElementById("register-username-input");
  if (input) {
    input.value = state.user ? state.user.username : "";
  }
  openModal("register-modal");
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".view-section").forEach(sec => {
    sec.classList.toggle("active", sec.id === `view-${tabId}`);
  });

  if (tabId === "challenges") loadChallenges();
  if (tabId === "leaderboard") loadLeaderboard();
}

function formatTime(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// Initialization & Event Listeners
// ============================================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Navigation Tabs
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Filters
  document.getElementById("filter-app")?.addEventListener("change", (e) => {
    state.filters.app = e.target.value;
    renderChallenges();
  });
  document.getElementById("filter-difficulty")?.addEventListener("change", (e) => {
    state.filters.difficulty = e.target.value;
    renderChallenges();
  });
  document.getElementById("filter-status")?.addEventListener("change", (e) => {
    state.filters.status = e.target.value;
    renderChallenges();
  });
  document.getElementById("search-input")?.addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderChallenges();
  });

  // Register Form
  document.getElementById("register-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username-input").value;
    registerPlayer(username);
  });

  // Admin Form
  document.getElementById("admin-reset-form")?.addEventListener("submit", handleAdminReset);

  // Initial Data Load
  await fetchUserProfile();
  await loadChallenges();
  await loadLeaderboard();

  // Auto-refresh timer every 10 seconds
  setInterval(async () => {
    if (state.autoRefresh) {
      await loadLeaderboard();
      // Only reload challenges silently if user not currently typing in a flag field
      const activeEl = document.activeElement;
      if (!activeEl || !activeEl.classList.contains("flag-input")) {
        await loadChallenges();
      }
    }
  }, 10000);
});
