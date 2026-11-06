const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const config = require('./config');
const db = require('./db');
const jwt = require('./jwt');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory failed login tracking for rate limiting: ip -> { count, windowStart }
const failedAttempts = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['client-ip'] || req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress || '127.0.0.1';
}

// Reseed DB when difficulty changes
function setDifficulty(newDiff) {
  if (config.setDifficulty(newDiff)) {
    db.seed(newDiff);
    failedAttempts.clear();
    return true;
  }
  return false;
}

// ----------------------------------------------------------------------------
// Healthcheck
// ----------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ----------------------------------------------------------------------------
// Difficulty Management
// ----------------------------------------------------------------------------
app.get('/api/difficulty', (req, res) => {
  res.json({
    difficulty: config.getDifficulty(),
    supported: ['easy', 'medium', 'hard']
  });
});

app.post('/api/difficulty', (req, res) => {
  const { difficulty } = req.body;
  if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid difficulty. Must be easy, medium, or hard.' });
  }
  setDifficulty(difficulty.toLowerCase());
  res.json({
    success: true,
    message: `Difficulty switched to ${config.getDifficulty()}`,
    difficulty: config.getDifficulty()
  });
});

// ----------------------------------------------------------------------------
// Products Catalog
// ----------------------------------------------------------------------------
app.get('/api/products', (req, res) => {
  res.json({
    success: true,
    products: db.products
  });
});

app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = db.products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ success: true, product });
});

// ----------------------------------------------------------------------------
// Authentication: Register
// ----------------------------------------------------------------------------
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  if (username.length < 3 || password.length < 4) {
    return res.status(400).json({ error: 'Username (min 3) or password (min 4) too short' });
  }

  const result = db.createUser(username, email, password, 'customer');
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const token = jwt.createToken({
    id: result.user.id,
    username: result.user.username,
    role: result.user.role,
    email: result.user.email
  });

  res.cookie('token', token, { httpOnly: false });
  res.json({
    success: true,
    message: 'Registration successful',
    token,
    user: {
      id: result.user.id,
      username: result.user.username,
      email: result.user.email,
      role: result.user.role
    }
  });
});

// ----------------------------------------------------------------------------
// Authentication: Login & Bruteforce Vulnerabilities
// ----------------------------------------------------------------------------
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const difficulty = config.getDifficulty();
  const clientIp = getClientIp(req);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Rate Limiting Logic per Difficulty
  if (difficulty === 'medium' || difficulty === 'hard') {
    const now = Date.now();
    const tracker = failedAttempts.get(clientIp) || { count: 0, windowStart: now };
    
    // Reset window after 60 seconds
    if (now - tracker.windowStart > 60000) {
      tracker.count = 0;
      tracker.windowStart = now;
    }

    if (tracker.count >= 5) {
      return res.status(429).json({
        error: `Too many failed login attempts from IP [${clientIp}]. Rate limit exceeded (max 5). Try again in 60s.`,
        clientIp,
        remainingAttempts: 0
      });
    }
  }

  const user = db.getUser(username);

  // Hard mode: Timing discrepancy for user enumeration
  if (difficulty === 'hard') {
    if (!user) {
      // Non-existing user returns immediately (~1-3ms)
      const tracker = failedAttempts.get(clientIp) || { count: 0, windowStart: Date.now() };
      tracker.count++;
      failedAttempts.set(clientIp, tracker);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    // Existing user undergoes artificial delay / heavy computation (~250ms)
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  // Check password
  const passwordValid = user && (
    user.passwordPlain === password || bcrypt.compareSync(password, user.passwordHash)
  );

  if (!passwordValid) {
    if (difficulty === 'medium' || difficulty === 'hard') {
      const tracker = failedAttempts.get(clientIp) || { count: 0, windowStart: Date.now() };
      tracker.count++;
      failedAttempts.set(clientIp, tracker);
      const remaining = Math.max(0, 5 - tracker.count);
      return res.status(401).json({
        error: 'Invalid username or password',
        attemptsUsed: tracker.count,
        remainingAttempts: remaining
      });
    }
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Successful login: reset failed attempts for IP
  failedAttempts.delete(clientIp);

  // Issue JWT token
  const token = jwt.createToken({
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email
  }, difficulty);

  res.cookie('token', token, { httpOnly: false });

  // Award bruteforce flag if logging in as administrative staff
  let flagAwarded = null;
  if (user.role === 'admin' || user.username === 'admin' || user.username === 'support') {
    if (difficulty === 'easy') {
      flagAwarded = config.flags.bruteforce.easy;
    } else if (difficulty === 'medium') {
      flagAwarded = config.flags.bruteforce.medium;
    } else if (difficulty === 'hard') {
      flagAwarded = config.flags.bruteforce.hard;
    }
  }

  res.json({
    success: true,
    message: `Welcome back, ${user.name || user.username}!`,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: user.balance
    },
    flag: flagAwarded || undefined
  });
});

// ----------------------------------------------------------------------------
// Password Reset: Forgot Password & Reset Token Vulnerabilities
// ----------------------------------------------------------------------------
app.post('/api/forgot-password', (req, res) => {
  const { username, email } = req.body;
  const difficulty = config.getDifficulty();

  let user = null;
  if (username) user = db.getUser(username);
  if (!user && email) user = db.getUserByEmail(email);

  if (!user) {
    return res.json({
      success: true,
      message: 'If the provided account exists, a password reset link has been dispatched to its registered email.'
    });
  }

  let token;
  const nowSec = Math.floor(Date.now() / 1000);

  // Vulnerability token generation per difficulty:
  if (difficulty === 'easy') {
    // Easy: md5(username)
    token = crypto.createHash('md5').update(user.username.toLowerCase()).digest('hex');
  } else if (difficulty === 'medium') {
    // Medium: sha1(username + Math.floor(Date.now() / 1000))
    token = crypto.createHash('sha1').update(user.username.toLowerCase() + nowSec).digest('hex');
  } else {
    // Hard: cryptographic random token, but reset link vulnerable to Host Header Poisoning
    token = crypto.randomBytes(24).toString('hex');
  }

  // Host Header Poisoning extraction
  const hostHeader = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:8004';
  const isPoisoned = !['localhost:8004', '127.0.0.1:8004', 'localhost', '127.0.0.1'].includes(hostHeader);
  const resetLink = `http://${hostHeader}/reset-password?token=${token}`;

  // Store in database
  db.storeResetToken(token, user.username, isPoisoned, hostHeader);

  // Log in outbox
  db.logEmail(
    user.email,
    'VulnShop Security: Password Reset Request',
    `Hello ${user.username},\n\nA password reset request was received for your account. Click the link below to set a new password:\n${resetLink}\n\nIf you did not request this, please disregard.`,
    resetLink,
    hostHeader
  );

  res.json({
    success: true,
    message: 'If the provided account exists, a password reset link has been dispatched to its registered email.',
    simulated: 'Email generated and stored in Simulated Outbox (/api/emails).'
  });
});

app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const difficulty = config.getDifficulty();

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and newPassword are required' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
  }

  let targetUsername = null;
  let isPoisoned = false;

  // Verify token based on difficulty
  if (difficulty === 'easy') {
    // Check if token matches md5(username) for any user
    const adminMd5 = crypto.createHash('md5').update('admin').digest('hex');
    const supportMd5 = crypto.createHash('md5').update('support').digest('hex');
    const stored = db.verifyResetToken(token);

    if (token === adminMd5) {
      targetUsername = 'admin';
    } else if (token === supportMd5) {
      targetUsername = 'support';
    } else if (stored) {
      targetUsername = stored.username;
    }

    if (!targetUsername) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    db.updatePassword(targetUsername, newPassword);
    db.consumeResetToken(token);

    return res.json({
      success: true,
      message: `Password for ${targetUsername} reset successfully!`,
      flag: targetUsername === 'admin' ? config.flags.reset.easy : undefined
    });
  }

  if (difficulty === 'medium') {
    const stored = db.verifyResetToken(token);
    if (stored) {
      targetUsername = stored.username;
    } else {
      // Brute force check: allow timestamp within the last 120 seconds for admin or support
      const nowSec = Math.floor(Date.now() / 1000);
      for (let t = nowSec - 120; t <= nowSec + 10; t++) {
        if (crypto.createHash('sha1').update('admin' + t).digest('hex') === token) {
          targetUsername = 'admin';
          break;
        }
        if (crypto.createHash('sha1').update('support' + t).digest('hex') === token) {
          targetUsername = 'support';
          break;
        }
      }
    }

    if (!targetUsername) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    db.updatePassword(targetUsername, newPassword);
    db.consumeResetToken(token);

    return res.json({
      success: true,
      message: `Password for ${targetUsername} reset successfully!`,
      flag: targetUsername === 'admin' ? config.flags.reset.medium : undefined
    });
  }

  if (difficulty === 'hard') {
    const stored = db.consumeResetToken(token);
    if (!stored) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    targetUsername = stored.username;
    isPoisoned = stored.isPoisoned;

    db.updatePassword(targetUsername, newPassword);

    let flagAwarded = undefined;
    if (targetUsername === 'admin' && isPoisoned) {
      flagAwarded = config.flags.reset.hard;
    }

    return res.json({
      success: true,
      message: isPoisoned
        ? `Password for ${targetUsername} reset successfully using poisoned host reset token!`
        : `Password for ${targetUsername} reset successfully.`,
      flag: flagAwarded
    });
  }

  res.status(400).json({ error: 'Unknown difficulty mode' });
});

// ----------------------------------------------------------------------------
// Admin Portal & JWT Vulnerabilities
// ----------------------------------------------------------------------------
app.get('/api/admin/dashboard', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Missing JWT token in Authorization header or cookie.'
    });
  }

  const difficulty = config.getDifficulty();
  const verifyResult = jwt.verifyToken(token, difficulty);

  if (!verifyResult.valid) {
    return res.status(401).json({
      error: 'JWT verification failed',
      details: verifyResult.error
    });
  }

  const payload = verifyResult.payload || {};
  if (payload.role !== 'admin' && payload.username !== 'admin' && payload.username !== 'support') {
    return res.status(403).json({
      error: 'Access denied: Admin role required for dashboard portal.',
      userRole: payload.role
    });
  }

  // Determine JWT flag
  let jwtFlag = verifyResult.flag;
  if (!jwtFlag) {
    // If authenticated as admin, provide the current difficulty JWT flag
    if (difficulty === 'easy') {
      jwtFlag = config.flags.jwt.easy;
    } else if (difficulty === 'medium') {
      jwtFlag = config.flags.jwt.medium;
    } else if (difficulty === 'hard') {
      jwtFlag = config.flags.jwt.hard;
    }
  }

  res.json({
    success: true,
    message: 'Welcome to VulnShop Executive Management Portal',
    portal: {
      difficulty,
      authenticatedAs: payload.username,
      role: payload.role,
      metrics: {
        totalOrders: 1482,
        revenue: '$198,420.00',
        activeUsers: db.users.size,
        inventoryAlerts: 2
      },
      system: {
        nodeVersion: process.version,
        uptime: `${Math.floor(process.uptime())} seconds`,
        mode: difficulty.toUpperCase()
      }
    },
    flag: jwtFlag
  });
});

// ----------------------------------------------------------------------------
// Profile & User Info
// ----------------------------------------------------------------------------
app.get('/api/profile', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const difficulty = config.getDifficulty();
  const verifyResult = jwt.verifyToken(token, difficulty);

  if (!verifyResult.valid) {
    return res.status(401).json({ error: 'Invalid session token' });
  }

  const payload = verifyResult.payload;
  const user = db.getUser(payload.username);

  res.json({
    success: true,
    user: {
      username: payload.username,
      role: payload.role,
      email: payload.email || (user ? user.email : 'unknown@vulnshop.local'),
      balance: user ? user.balance : 0
    }
  });
});

// ----------------------------------------------------------------------------
// Email Outbox Inspector (Simulated Mail Server / Mailhog)
// ----------------------------------------------------------------------------
app.get('/api/emails', (req, res) => {
  res.json({
    success: true,
    emails: db.getEmails()
  });
});

app.post('/api/emails/clear', (req, res) => {
  db.clearEmails();
  res.json({ success: true, message: 'Simulated email outbox cleared' });
});

// ----------------------------------------------------------------------------
// Reset State / Seed Helper
// ----------------------------------------------------------------------------
app.post('/api/reset-state', (req, res) => {
  db.seed(config.getDifficulty());
  failedAttempts.clear();
  res.json({ success: true, message: 'Database and rate limits re-seeded.' });
});

// Fallback: serve single page app for any route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = config.port;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VulnShop] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[VulnShop] Active difficulty: ${config.getDifficulty().toUpperCase()}`);
  });
}

module.exports = app;
