/**
 * VulnLab Notes Frontend Application Logic
 */

let currentUser = null;
let currentDifficulty = 'easy';
let authMode = 'login'; // 'login' or 'register'

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadDifficulty();
    await checkAuth();

    // Attach difficulty selector change listener
    document.getElementById('diff-select').addEventListener('change', async (e) => {
        await switchDifficulty(e.target.value);
    });
});

/**
 * Fetch and reflect active difficulty mode
 */
async function loadDifficulty() {
    try {
        const res = await fetch('/api/difficulty');
        const data = await res.json();
        if (data.status === 'success') {
            currentDifficulty = data.difficulty;
            updateDifficultyUI(currentDifficulty);
        }
    } catch (err) {
        console.error('Failed to load difficulty:', err);
    }
}

/**
 * Switch difficulty via API
 */
async function switchDifficulty(newDiff) {
    try {
        const res = await fetch('/api/difficulty', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ difficulty: newDiff })
        });
        const data = await res.json();
        if (data.status === 'success') {
            currentDifficulty = data.difficulty;
            updateDifficultyUI(currentDifficulty);
            if (currentUser) {
                await loadNotes();
                await loadProfile();
            }
        }
    } catch (err) {
        console.error('Failed to switch difficulty:', err);
    }
}

function updateDifficultyUI(diff) {
    const badge = document.getElementById('diff-badge');
    const select = document.getElementById('diff-select');

    badge.className = `diff-badge ${diff}`;
    badge.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
    select.value = diff;

    // Update banner hints
    const title = document.getElementById('mode-guidance-title');
    const desc = document.getElementById('mode-guidance-desc');
    const massGroup = document.getElementById('mass-assign-group');

    if (diff === 'easy') {
        if (title) title.textContent = 'IDOR Practice: Easy Tier (100 Pts)';
        if (desc) desc.textContent = 'Sequential numeric note IDs (/api/notes/:id). Mass assignment permitted on profile update.';
        if (massGroup) massGroup.style.display = 'block';
    } else if (diff === 'medium') {
        if (title) title.textContent = 'IDOR Practice: Medium Tier (200 Pts)';
        if (desc) desc.textContent = 'Note IDs are Base64 encoded or accept query parameter override (?note_id=1). Role spoofing via X-Role.';
        if (massGroup) massGroup.style.display = 'none';
    } else {
        if (title) title.textContent = 'IDOR Practice: Hard Tier (300 Pts)';
        if (desc) desc.textContent = 'Note IDs are UUIDs. Check public audit activity feed or user public profiles to discover leaked admin note UUID.';
        if (massGroup) massGroup.style.display = 'none';
    }
}

/**
 * Check authenticated session
 */
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (data.authenticated && data.user) {
            currentUser = data.user;
            showAuthenticatedUI();
            await loadNotes();
        } else {
            currentUser = null;
            showGuestUI();
        }
    } catch (err) {
        console.error('Check auth error:', err);
        showGuestUI();
    }
}

function showAuthenticatedUI() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('notes-section').style.display = 'block';
    document.getElementById('auth-nav').style.display = 'flex';
    document.getElementById('guest-nav').style.display = 'none';

    document.getElementById('current-user-display').textContent = `${currentUser.full_name || currentUser.username} (${currentUser.role})`;

    // Show Admin Link if user is admin
    const adminLink = document.getElementById('admin-link');
    if (currentUser.role === 'admin') {
        adminLink.style.display = 'inline-block';
    } else {
        adminLink.style.display = 'none';
    }
}

function showGuestUI() {
    document.getElementById('auth-section').style.display = 'block';
    document.getElementById('notes-section').style.display = 'none';
    document.getElementById('activity-section').style.display = 'none';
    document.getElementById('profile-section').style.display = 'none';
    document.getElementById('auth-nav').style.display = 'none';
    document.getElementById('guest-nav').style.display = 'block';
}

/**
 * Section Switcher
 */
function showSection(section) {
    document.getElementById('notes-section').style.display = section === 'notes' ? 'block' : 'none';
    document.getElementById('activity-section').style.display = section === 'activity' ? 'block' : 'none';
    document.getElementById('profile-section').style.display = section === 'profile' ? 'block' : 'none';

    if (section === 'notes') loadNotes();
    if (section === 'activity') loadActivity();
    if (section === 'profile') loadProfile();
}

/**
 * Authentication Form Handlers
 */
function toggleAuthMode(e) {
    if (e) e.preventDefault();
    authMode = authMode === 'login' ? 'register' : 'login';

    const title = document.getElementById('auth-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const regGroup = document.getElementById('reg-name-group');

    if (authMode === 'register') {
        title.textContent = 'Create New Account';
        submitBtn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign In';
        regGroup.style.display = 'block';
    } else {
        title.textContent = 'Sign In to SecureNotes';
        submitBtn.textContent = 'Sign In';
        toggleText.textContent = 'Need an account?';
        toggleLink.textContent = 'Sign Up';
        regGroup.style.display = 'none';
    }
}

function fillCreds(u, p) {
    document.getElementById('auth-username').value = u;
    document.getElementById('auth-password').value = p;
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const errorEl = document.getElementById('auth-error');
    errorEl.style.display = 'none';

    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    const full_name = document.getElementById('auth-fullname').value.trim();

    const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = authMode === 'register' ? { username, password, full_name } : { username, password };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent = data.error || 'Authentication failed';
            errorEl.style.display = 'block';
            return;
        }

        currentUser = data.user;
        showAuthenticatedUI();
        await loadNotes();
    } catch (err) {
        errorEl.textContent = 'Network or server error';
        errorEl.style.display = 'block';
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        showGuestUI();
    } catch (err) {
        console.error('Logout error:', err);
    }
}

/**
 * Notes Operations
 */
async function loadNotes() {
    try {
        const res = await fetch('/api/notes');
        const data = await res.json();
        const grid = document.getElementById('notes-grid');
        grid.innerHTML = '';

        if (!data.notes || data.notes.length === 0) {
            grid.innerHTML = '<div style="color: var(--text-muted); grid-column: 1 / -1;">No notes created yet. Click "+ Create Note" above to write one!</div>';
            return;
        }

        data.notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';

            const privacyTag = note.is_private
                ? '<span style="color: #f87171; font-size: 0.75rem; font-weight: 600;">🔒 Private</span>'
                : '<span style="color: #34d399; font-size: 0.75rem; font-weight: 600;">🌐 Public</span>';

            card.innerHTML = `
                <div>
                    <div class="note-header">
                        <h4 class="note-title">${escapeHtml(note.title)}</h4>
                        ${privacyTag}
                    </div>
                    <div class="note-meta">
                        <span>ID: <code>${note.id}</code></span>
                        <span>${new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="note-body">${escapeHtml(note.content)}</div>
                </div>
                <div class="note-actions">
                    <button class="btn btn-secondary btn-sm" onclick="viewNote('${note.id}')">View Note</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteNote(${note.raw_id || note.id})">Delete</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        console.error('Load notes error:', err);
    }
}

/**
 * View Note (Exploits IDOR)
 */
async function viewNote(noteIdentifier) {
    try {
        const res = await fetch(`/api/notes/${encodeURIComponent(noteIdentifier)}`);
        const data = await res.json();

        if (!res.ok) {
            alert(`Error: ${data.error || 'Could not fetch note'}`);
            return;
        }

        const note = data.note;
        document.getElementById('modal-note-title').textContent = note.title;
        document.getElementById('modal-note-author').textContent = note.owner;
        document.getElementById('modal-note-id').textContent = note.id;
        document.getElementById('modal-note-privacy').textContent = note.is_private ? 'Private' : 'Public';
        document.getElementById('modal-note-content').textContent = note.content;

        // Check if note contains CTF Flag
        const flagMatch = note.content.match(/VULNLAB\{[a-f0-9]{32}\}/i);
        const flagBanner = document.getElementById('modal-flag-banner');
        if (flagMatch) {
            document.getElementById('modal-flag-text').textContent = flagMatch[0];
            document.getElementById('modal-flag-tier').textContent = `${data.difficulty.toUpperCase()} SOLVE`;
            flagBanner.style.display = 'flex';
        } else {
            flagBanner.style.display = 'none';
        }

        document.getElementById('note-modal').style.display = 'flex';
    } catch (err) {
        alert('Network error fetching note details');
    }
}

function testDirectNoteAccess() {
    const input = document.getElementById('direct-id-input').value.trim();
    if (!input) {
        alert('Please enter a note ID or parameter');
        return;
    }
    viewNote(input);
}

function closeNoteModal() {
    document.getElementById('note-modal').style.display = 'none';
}

function copyFlag() {
    const flagText = document.getElementById('modal-flag-text').textContent;
    navigator.clipboard.writeText(flagText).then(() => {
        alert('Flag copied to clipboard!');
    });
}

function openCreateModal() {
    document.getElementById('create-modal').style.display = 'flex';
}

function closeCreateModal() {
    document.getElementById('create-modal').style.display = 'none';
}

async function handleCreateNote(e) {
    e.preventDefault();
    const title = document.getElementById('new-note-title').value.trim();
    const content = document.getElementById('new-note-content').value.trim();
    const is_private = document.getElementById('new-note-private').checked;

    try {
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, is_private })
        });
        const data = await res.json();
        if (res.ok) {
            closeCreateModal();
            document.getElementById('new-note-title').value = '';
            document.getElementById('new-note-content').value = '';
            await loadNotes();
        } else {
            alert(data.error || 'Failed to create note');
        }
    } catch (err) {
        alert('Network error creating note');
    }
}

async function deleteNote(id) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
        const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await loadNotes();
        } else {
            const data = await res.json();
            alert(data.error || 'Failed to delete note');
        }
    } catch (err) {
        alert('Network error deleting note');
    }
}

/**
 * Activity Log
 */
async function loadActivity() {
    try {
        const res = await fetch('/api/activity');
        const data = await res.json();
        const tbody = document.getElementById('activity-tbody');
        tbody.innerHTML = '';

        if (!data.activity || data.activity.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No activity recorded yet</td></tr>';
            return;
        }

        data.activity.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>#${log.id}</code></td>
                <td><strong>${escapeHtml(log.username)}</strong></td>
                <td><span class="diff-badge ${log.action === 'NOTE_CREATED' ? 'easy' : 'medium'}">${escapeHtml(log.action)}</span></td>
                <td>${escapeHtml(log.details)}</td>
                <td>${log.note_uuid ? `<code style="color: #38bdf8; cursor: pointer;" title="Click to view note" onclick="viewNote('${log.note_uuid}')">${log.note_uuid}</code>` : '<span style="color: var(--text-muted);">-</span>'}</td>
                <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(log.created_at).toLocaleString()}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Load activity error:', err);
    }
}

/**
 * User Profile
 */
async function loadProfile() {
    try {
        const res = await fetch('/api/users/profile');
        const data = await res.json();
        if (data.status === 'success') {
            const p = data.profile;
            document.getElementById('prof-id').value = p.id;
            document.getElementById('prof-username').value = p.username;
            document.getElementById('prof-fullname').value = p.full_name || '';
            document.getElementById('prof-email').value = p.email || '';
            document.getElementById('prof-role').value = p.role;
        }
    } catch (err) {
        console.error('Load profile error:', err);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const msgEl = document.getElementById('profile-msg');
    msgEl.style.display = 'none';

    const full_name = document.getElementById('prof-fullname').value.trim();
    const email = document.getElementById('prof-email').value.trim();
    const roleOverride = document.getElementById('prof-role-override')?.value.trim();

    const payload = { full_name, email };
    if (roleOverride) {
        payload.role = roleOverride;
    }

    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            msgEl.textContent = 'Profile successfully updated!';
            msgEl.style.color = '#34d399';
            msgEl.style.display = 'block';

            currentUser.role = data.profile.role;
            currentUser.full_name = data.profile.full_name;
            showAuthenticatedUI();
            await loadProfile();
        } else {
            msgEl.textContent = data.error || 'Failed to update profile';
            msgEl.style.color = '#f87171';
            msgEl.style.display = 'block';
        }
    } catch (err) {
        msgEl.textContent = 'Network error updating profile';
        msgEl.style.color = '#f87171';
        msgEl.style.display = 'block';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
