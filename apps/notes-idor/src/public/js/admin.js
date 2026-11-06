/**
 * Administrator Console Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    await initAdmin();
});

async function initAdmin() {
    try {
        // Fetch Admin Flag
        const flagRes = await fetch('/api/admin/flag');

        if (!flagRes.ok) {
            const errData = await flagRes.json().catch(() => ({}));
            showDenied(errData);
            return;
        }

        const flagData = await flagRes.json();
        showAdminConsole(flagData);
        await loadStats();
        await loadUsers();
    } catch (err) {
        console.error('Init admin error:', err);
        showDenied({ error: 'Network communication error' });
    }
}

function showDenied(errData) {
    document.getElementById('denied-view').style.display = 'block';
    document.getElementById('admin-dashboard-view').style.display = 'none';

    const diffBadge = document.getElementById('admin-diff-badge');
    const diff = errData.difficulty || 'easy';
    diffBadge.className = `diff-badge ${diff}`;
    diffBadge.textContent = diff.toUpperCase();

    const hintEl = document.getElementById('denied-hint');
    if (diff === 'easy') {
        hintEl.innerHTML = `<strong>Challenge Hint (Easy):</strong> Send <code>PUT /api/users/profile</code> with <code>{"role": "admin"}</code> to escalate your user's role via mass assignment.`;
    } else if (diff === 'medium') {
        hintEl.innerHTML = `<strong>Challenge Hint (Medium):</strong> Mass assignment is filtered, but header inspection permits bypass. Try requesting with <code>X-Role: admin</code> or <code>X-HTTP-Method-Override: ADMIN</code>.`;
    } else {
        hintEl.innerHTML = `<strong>Challenge Hint (Hard):</strong> Exploit IDOR in <code>PUT /api/users/1</code> to reset the administrator password or send <code>{"metadata": {"role": "admin"}}</code>.`;
    }
}

function showAdminConsole(data) {
    document.getElementById('denied-view').style.display = 'none';
    document.getElementById('admin-dashboard-view').style.display = 'block';

    const diff = data.difficulty || 'easy';
    const badge = document.getElementById('admin-diff-badge');
    badge.className = `diff-badge ${diff}`;
    badge.textContent = diff.toUpperCase();

    document.getElementById('flag-tier-badge').className = `diff-badge ${diff}`;
    document.getElementById('flag-tier-badge').textContent = `${diff.toUpperCase()} FLAG`;
    document.getElementById('admin-flag-text').textContent = data.flag;
}

async function loadStats() {
    try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('stat-users').textContent = data.stats.total_users;
            document.getElementById('stat-db').textContent = data.stats.db_engine;
            document.getElementById('stat-diff').textContent = data.stats.active_difficulty;
        }
    } catch (err) {
        console.error('Load stats error:', err);
    }
}

async function loadUsers() {
    try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
            const data = await res.json();
            const tbody = document.getElementById('users-tbody');
            tbody.innerHTML = '';

            data.users.forEach(u => {
                const tr = document.createElement('tr');
                const isAdm = u.role === 'admin';
                tr.innerHTML = `
                    <td><code>#${u.id}</code></td>
                    <td><strong>${escapeHtml(u.username)}</strong></td>
                    <td>${escapeHtml(u.full_name || '-')}</td>
                    <td>${escapeHtml(u.email || '-')}</td>
                    <td><span class="diff-badge ${isAdm ? 'hard' : 'easy'}">${escapeHtml(u.role)}</span></td>
                    <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(u.created_at).toLocaleDateString()}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error('Load users error:', err);
    }
}

function copyAdminFlag() {
    const text = document.getElementById('admin-flag-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert('Admin Flag copied to clipboard!');
    });
}

async function logoutAdmin() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
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
