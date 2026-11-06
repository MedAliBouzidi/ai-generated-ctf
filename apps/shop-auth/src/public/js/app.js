const app = {
  currentDifficulty: 'easy',
  currentUser: null,
  token: localStorage.getItem('vulnshop_jwt') || null,
  activeFlag: null,

  async init() {
    await this.fetchDifficulty();
    await this.fetchProducts();
    await this.checkSession();

    // Check query params for token redemption (e.g. /reset-password?token=...)
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    if (resetToken) {
      this.showView('auth');
      this.switchAuthTab('reset');
      const tokenInput = document.getElementById('resetToken');
      if (tokenInput) tokenInput.value = resetToken;
    }
  },

  // --------------------------------------------------------------------------
  // Navigation & Views
  // --------------------------------------------------------------------------
  showView(viewName) {
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    const targetNav = document.getElementById(`nav-${viewName}`);

    if (targetView) targetView.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    if (viewName === 'emails') {
      this.fetchEmails();
    } else if (viewName === 'admin') {
      this.checkAdminAccess();
    }
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`tab-${tab}`);
    if (btn) btn.classList.add('active');

    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('resetSection').style.display = tab === 'reset' ? 'block' : 'none';

    this.hideAlert('authAlert');
  },

  // --------------------------------------------------------------------------
  // Difficulty Handling
  // --------------------------------------------------------------------------
  async fetchDifficulty() {
    try {
      const res = await fetch('/api/difficulty');
      const data = await res.json();
      this.currentDifficulty = data.difficulty || 'easy';
      this.updateDifficultyBadge();
    } catch (err) {
      console.error('Failed to fetch difficulty:', err);
    }
  },

  updateDifficultyBadge() {
    const badge = document.getElementById('difficultyBadge');
    const label = document.getElementById('difficultyLabel');
    if (!badge || !label) return;

    badge.className = `difficulty-badge difficulty-${this.currentDifficulty}`;
    label.textContent = `${this.currentDifficulty.toUpperCase()} MODE`;

    const adminMetric = document.getElementById('adminDiffMetric');
    if (adminMetric) adminMetric.textContent = this.currentDifficulty.toUpperCase();
  },

  openDifficultyModal() {
    const modal = document.getElementById('diffModal');
    if (modal) modal.style.display = 'flex';
  },

  closeDifficultyModal() {
    const modal = document.getElementById('diffModal');
    if (modal) modal.style.display = 'none';
  },

  async selectDifficulty(level) {
    try {
      const res = await fetch('/api/difficulty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: level })
      });
      const data = await res.json();
      if (data.success) {
        this.currentDifficulty = data.difficulty;
        this.updateDifficultyBadge();
        this.closeDifficultyModal();
        this.showAlert('authAlert', `Difficulty switched to ${level.toUpperCase()}. Database re-seeded.`, 'info');
        await this.checkSession();
      }
    } catch (err) {
      alert(`Error setting difficulty: ${err.message}`);
    }
  },

  // --------------------------------------------------------------------------
  // Products Catalog
  // --------------------------------------------------------------------------
  async fetchProducts() {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (data.success && data.products) {
        this.renderProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  },

  renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    grid.innerHTML = products.map(p => `
      <div class="product-card">
        <div class="product-top">
          <div class="product-icon">${p.icon || '📦'}</div>
          <span class="product-badge">${p.badge || p.category}</span>
        </div>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description}</p>
        <div class="product-bottom">
          <span class="product-price">$${p.price.toFixed(2)}</span>
          <button class="btn btn-primary" onclick="app.orderProduct(${p.id})">Buy Item</button>
        </div>
      </div>
    `).join('');
  },

  orderProduct(productId) {
    if (!this.currentUser) {
      alert('Please sign in or create an account to purchase hardware.');
      this.showView('auth');
      return;
    }
    alert(`Order for product #${productId} placed! Hardware dispatch initiated.`);
  },

  // --------------------------------------------------------------------------
  // User Authentication
  // --------------------------------------------------------------------------
  async checkSession() {
    const token = this.token || this.getCookie('token');
    if (!token) {
      this.currentUser = null;
      this.renderProfile();
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        this.token = token;
        localStorage.setItem('vulnshop_jwt', token);
      } else {
        this.currentUser = null;
        localStorage.removeItem('vulnshop_jwt');
      }
    } catch (_) {
      this.currentUser = null;
    }
    this.renderProfile();
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert('authAlert', data.error || 'Authentication failed', 'danger');
        return;
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('vulnshop_jwt', data.token);

      this.showAlert('authAlert', `Successfully logged in as ${data.user.username}!`, 'success');
      this.renderProfile();

      if (data.flag) {
        this.displayFlag(data.flag, `Bruteforce Solved (${this.currentDifficulty.toUpperCase()})`);
      }
    } catch (err) {
      this.showAlert('authAlert', `Network error: ${err.message}`, 'danger');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert('authAlert', data.error || 'Registration failed', 'danger');
        return;
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('vulnshop_jwt', data.token);

      this.showAlert('authAlert', 'Account registered successfully!', 'success');
      this.renderProfile();
    } catch (err) {
      this.showAlert('authAlert', `Network error: ${err.message}`, 'danger');
    }
  },

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('vulnshop_jwt');
    document.cookie = 'token=; Max-Age=0; path=/;';
    this.renderProfile();
    this.showAlert('authAlert', 'Logged out successfully.', 'info');
  },

  renderProfile() {
    const profSec = document.getElementById('profileSection');
    const loginForm = document.getElementById('loginForm');
    const regForm = document.getElementById('registerForm');
    const resetSec = document.getElementById('resetSection');
    const tabs = document.querySelector('.tabs');

    if (this.currentUser) {
      if (profSec) profSec.style.display = 'block';
      if (loginForm) loginForm.style.display = 'none';
      if (regForm) regForm.style.display = 'none';
      if (resetSec) resetSec.style.display = 'none';
      if (tabs) tabs.style.display = 'none';

      document.getElementById('profUsername').textContent = this.currentUser.username;
      document.getElementById('profEmail').textContent = this.currentUser.email;
      document.getElementById('profRole').textContent = this.currentUser.role.toUpperCase();
      document.getElementById('profBalance').textContent = (this.currentUser.balance || 0).toFixed(2);
      document.getElementById('profJwt').value = this.token || '';
    } else {
      if (profSec) profSec.style.display = 'none';
      if (tabs) tabs.style.display = 'flex';
      this.switchAuthTab('login');
    }
  },

  // --------------------------------------------------------------------------
  // Password Reset Handlers
  // --------------------------------------------------------------------------
  async handleForgotPassword(e) {
    e.preventDefault();
    const username = document.getElementById('forgotUsername').value.trim();

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();
      this.showAlert('authAlert', `${data.message} (${data.simulated || ''})`, 'info');
      await this.fetchEmails();
    } catch (err) {
      this.showAlert('authAlert', `Error: ${err.message}`, 'danger');
    }
  },

  async handleResetPassword(e) {
    e.preventDefault();
    const token = document.getElementById('resetToken').value.trim();
    const newPassword = document.getElementById('resetNewPassword').value;

    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert('authAlert', data.error || 'Password reset failed', 'danger');
        return;
      }

      this.showAlert('authAlert', data.message, 'success');

      if (data.flag) {
        this.displayFlag(data.flag, `Password Reset Solved (${this.currentDifficulty.toUpperCase()})`);
      }
    } catch (err) {
      this.showAlert('authAlert', `Error: ${err.message}`, 'danger');
    }
  },

  // --------------------------------------------------------------------------
  // Mailbox Outbox
  // --------------------------------------------------------------------------
  async fetchEmails() {
    try {
      const res = await fetch('/api/emails');
      const data = await res.json();
      const tbody = document.getElementById('emailsTableBody');
      if (!tbody) return;

      if (!data.emails || data.emails.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No outgoing emails recorded yet. Request a password reset to populate.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.emails.map(email => `
        <tr>
          <td>#${email.id}</td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(email.timestamp).toLocaleTimeString()}</td>
          <td><strong>${email.to}</strong></td>
          <td><code class="code-pill">${email.host}</code></td>
          <td>
            <a href="${email.resetLink}" class="code-pill" style="color: #38bdf8; text-decoration: none;" target="_blank">
              ${email.resetLink}
            </a>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    }
  },

  async clearEmails() {
    if (!confirm('Clear all recorded outgoing emails?')) return;
    try {
      await fetch('/api/emails/clear', { method: 'POST' });
      await this.fetchEmails();
    } catch (err) {
      alert(`Error clearing emails: ${err.message}`);
    }
  },

  // --------------------------------------------------------------------------
  // Admin Portal & JWT Verification
  // --------------------------------------------------------------------------
  async checkAdminAccess() {
    const token = this.token || this.getCookie('token');
    const deniedBox = document.getElementById('adminDenied');
    const contentBox = document.getElementById('adminContent');

    if (!token) {
      if (deniedBox) deniedBox.style.display = 'block';
      if (contentBox) contentBox.style.display = 'none';
      return;
    }

    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        if (deniedBox) deniedBox.style.display = 'block';
        if (contentBox) contentBox.style.display = 'none';
        return;
      }

      if (deniedBox) deniedBox.style.display = 'none';
      if (contentBox) contentBox.style.display = 'block';

      const userPill = document.getElementById('adminUserPill');
      if (userPill) userPill.textContent = `Authenticated: ${data.portal.authenticatedAs}`;

      if (data.flag) {
        this.displayFlag(data.flag, `Admin JWT Solved (${this.currentDifficulty.toUpperCase()})`);
      }
    } catch (_) {
      if (deniedBox) deniedBox.style.display = 'block';
      if (contentBox) contentBox.style.display = 'none';
    }
  },

  populateCurrentToken() {
    const input = document.getElementById('testTokenInput');
    if (input) input.value = this.token || this.getCookie('token') || '';
  },

  async testAdminToken() {
    const input = document.getElementById('testTokenInput');
    const resultBox = document.getElementById('tokenTestResult');
    if (!input || !resultBox) return;

    const token = input.value.trim();
    if (!token) {
      alert('Please enter a JWT token string.');
      return;
    }

    resultBox.style.display = 'block';
    resultBox.innerHTML = `<div class="alert alert-info">Submitting token to /api/admin/dashboard...</div>`;

    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.ok) {
        let flagHtml = '';
        if (data.flag) {
          this.displayFlag(data.flag, `Admin JWT Solved (${this.currentDifficulty.toUpperCase()})`);
          flagHtml = `<div style="margin-top: 0.5rem;"><strong>Captured Flag:</strong> <code class="code-pill">${data.flag}</code></div>`;
        }
        resultBox.innerHTML = `
          <div class="alert alert-success">
            <strong>HTTP 200 OK: Admin Token Accepted!</strong><br>
            Authenticated As: <code>${data.portal.authenticatedAs}</code> (Role: ${data.portal.role})
            ${flagHtml}
          </div>
        `;
      } else {
        resultBox.innerHTML = `
          <div class="alert alert-danger">
            <strong>HTTP ${res.status}: Verification Rejected</strong><br>
            ${data.error || 'Unknown error'}: ${data.details || ''}
          </div>
        `;
      }
    } catch (err) {
      resultBox.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
  },

  // --------------------------------------------------------------------------
  // Helpers & Alerts
  // --------------------------------------------------------------------------
  displayFlag(flag, title = 'Challenge Solved!') {
    this.activeFlag = flag;
    const banner = document.getElementById('flagBanner');
    const titleEl = document.getElementById('flagTitle');
    const valEl = document.getElementById('flagDisplay');

    if (banner && valEl) {
      if (titleEl) titleEl.textContent = `${title} - Flag Captured:`;
      valEl.textContent = flag;
      banner.classList.add('show');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  copyFlag() {
    if (!this.activeFlag) return;
    navigator.clipboard.writeText(this.activeFlag).then(() => {
      alert(`Flag copied to clipboard:\n${this.activeFlag}`);
    }).catch(() => {
      prompt('Copy flag manually:', this.activeFlag);
    });
  },

  showAlert(elId, msg, type = 'info') {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.style.display = 'block';
  },

  hideAlert(elId) {
    const el = document.getElementById(elId);
    if (el) el.style.display = 'none';
  },

  getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }
};

window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
