const bcrypt = require('bcryptjs');

const INITIAL_PRODUCTS = [
  {
    id: 1,
    name: 'CyberDeck Pro 2026',
    price: 1299.00,
    category: 'Hardware',
    badge: 'Flagship',
    description: 'Ruggedized mobile field terminal with mechanical ortholinear keyboard, dual SDR tuners, and Gigabit bypass NIC.',
    stock: 5,
    icon: '💻'
  },
  {
    id: 2,
    name: 'Flipper Quantum',
    price: 249.00,
    category: 'Multi-tool',
    badge: 'Popular',
    description: 'Sub-GHz transceiver, RFID 125kHz, NFC, Infrared, GPIO probe header, and hardware crypto acceleration module.',
    stock: 14,
    icon: '🐬'
  },
  {
    id: 3,
    name: 'Rubber Ducky Ultra',
    price: 89.00,
    category: 'BadUSB',
    badge: 'Classic',
    description: '15-second multi-OS keystroke injector with DuckyScript 3.0, mass storage payload staging, and arming toggle switch.',
    stock: 42,
    icon: '🦆'
  },
  {
    id: 4,
    name: 'WiFi Pineapple Mark VII',
    price: 199.00,
    category: 'Wireless',
    badge: 'Hot',
    description: 'Automated rogue AP rogue suite, PineAP beacon replication, client deauth, and web-based audit suite.',
    stock: 11,
    icon: '🍍'
  },
  {
    id: 5,
    name: 'Proxmark3 RDV4 Kit',
    price: 320.00,
    category: 'RFID/NFC',
    badge: 'Pro',
    description: 'High-frequency & low-frequency RFID/NFC research instrument, antenna tuning, standalone battery pack included.',
    stock: 8,
    icon: '💳'
  },
  {
    id: 6,
    name: 'HackRF One SDR Kit',
    price: 350.00,
    category: 'SDR',
    badge: 'Pro',
    description: '1 MHz to 6 GHz half-duplex transceiver, 20 MHz bandwidth, Portapack H2 casing with touch display.',
    stock: 7,
    icon: '📡'
  },
  {
    id: 7,
    name: 'O.MG Elite Cable',
    price: 159.00,
    category: 'Cables',
    badge: 'Covert',
    description: 'USB-C to Lightning telemetry & HID injection cable with integrated web server, Wi-Fi trigger, and geofencing.',
    stock: 19,
    icon: '🔌'
  },
  {
    id: 8,
    name: 'RTL-SDR Blog V4',
    price: 39.00,
    category: 'SDR',
    badge: 'Budget',
    description: 'Wideband software defined radio receiver 500 kHz - 1.7 GHz with TCXO, bias tee, and aluminum enclosure.',
    stock: 50,
    icon: '📻'
  }
];

class Database {
  constructor() {
    this.products = [...INITIAL_PRODUCTS];
    this.users = new Map();
    this.resetTokens = new Map(); // token -> { username, createdAt, isPoisoned, host }
    this.sentEmails = [];
    this.failedAttempts = new Map(); // ip/key -> { count, lastAttempt }
    this.seed();
  }

  seed(difficulty = 'easy') {
    this.users.clear();
    this.resetTokens.clear();
    this.sentEmails = [];
    this.failedAttempts.clear();

    const salt = bcrypt.genSaltSync(8);

    // Admin user: password depends on difficulty
    const adminPassword = difficulty === 'hard'
      ? 'Admin_V0lt!Sec99#xK_RandomComplexPassword'
      : 'admin123';

    this.users.set('admin', {
      id: 1,
      username: 'admin',
      email: 'admin@vulnshop.local',
      role: 'admin',
      passwordHash: bcrypt.hashSync(adminPassword, salt),
      passwordPlain: adminPassword,
      name: 'System Administrator',
      balance: 9999.00,
      createdAt: new Date().toISOString()
    });

    // Support staff user: present in all modes, crucial in Hard mode bruteforce
    this.users.set('support', {
      id: 2,
      username: 'support',
      email: 'support@vulnshop.local',
      role: 'admin', // Support has admin portal privileges
      passwordHash: bcrypt.hashSync('welcome123', salt),
      passwordPlain: 'welcome123',
      name: 'Support Operations',
      balance: 1500.00,
      createdAt: new Date().toISOString()
    });

    // Customer user
    this.users.set('alice', {
      id: 3,
      username: 'alice',
      email: 'alice@vulnshop.local',
      role: 'customer',
      passwordHash: bcrypt.hashSync('customer123', salt),
      passwordPlain: 'customer123',
      name: 'Alice Cooper',
      balance: 450.00,
      createdAt: new Date().toISOString()
    });
  }

  getUser(username) {
    if (!username) return null;
    return this.users.get(username.toLowerCase()) || null;
  }

  getUserByEmail(email) {
    if (!email) return null;
    const lower = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === lower) {
        return user;
      }
    }
    return null;
  }

  createUser(username, email, password, role = 'customer') {
    const lower = username.toLowerCase();
    if (this.users.has(lower)) {
      return { success: false, error: 'Username already taken' };
    }
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return { success: false, error: 'Email already registered' };
      }
    }

    const salt = bcrypt.genSaltSync(8);
    const user = {
      id: this.users.size + 1,
      username: lower,
      email: email.toLowerCase(),
      role,
      passwordHash: bcrypt.hashSync(password, salt),
      passwordPlain: password,
      name: username,
      balance: 100.00,
      createdAt: new Date().toISOString()
    };
    this.users.set(lower, user);
    return { success: true, user };
  }

  updatePassword(username, newPassword) {
    const user = this.getUser(username);
    if (!user) return false;
    const salt = bcrypt.genSaltSync(8);
    user.passwordHash = bcrypt.hashSync(newPassword, salt);
    user.passwordPlain = newPassword;
    return true;
  }

  storeResetToken(token, username, isPoisoned = false, host = 'localhost:8004') {
    this.resetTokens.set(token, {
      username: username.toLowerCase(),
      createdAt: Date.now(),
      isPoisoned,
      host
    });
  }

  verifyResetToken(token) {
    const entry = this.resetTokens.get(token);
    if (!entry) return null;
    // Tokens valid for 30 minutes
    if (Date.now() - entry.createdAt > 30 * 60 * 1000) {
      this.resetTokens.delete(token);
      return null;
    }
    return entry;
  }

  consumeResetToken(token) {
    const entry = this.verifyResetToken(token);
    if (entry) {
      this.resetTokens.delete(token);
    }
    return entry;
  }

  logEmail(to, subject, body, resetLink, host) {
    const email = {
      id: this.sentEmails.length + 1,
      to,
      subject,
      body,
      resetLink,
      host,
      timestamp: new Date().toISOString()
    };
    this.sentEmails.unshift(email); // Most recent first
    if (this.sentEmails.length > 50) {
      this.sentEmails.pop();
    }
    return email;
  }

  getEmails() {
    return this.sentEmails;
  }

  clearEmails() {
    this.sentEmails = [];
  }
}

const db = new Database();

module.exports = db;
