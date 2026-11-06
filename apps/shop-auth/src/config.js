const crypto = require('crypto');

function getFlag(envVar, fallbackSeed) {
  const val = process.env[envVar];
  if (val && /^VULNLAB\{[0-9a-f]{32}\}$/i.test(val)) {
    return val;
  }
  const hash = crypto.createHash('sha256').update(envVar + (fallbackSeed || 'vulnlab-shop-auth-2026')).digest('hex').substring(0, 32);
  return `VULNLAB{${hash}}`;
}

// Current active difficulty
let activeDifficulty = (process.env.SHOP_AUTH_DIFFICULTY || process.env.DIFFICULTY || 'easy').toLowerCase();
if (!['easy', 'medium', 'hard'].includes(activeDifficulty)) {
  activeDifficulty = 'easy';
}

const config = {
  port: parseInt(process.env.PORT || '8004', 10),
  
  getDifficulty: () => activeDifficulty,
  setDifficulty: (level) => {
    if (['easy', 'medium', 'hard'].includes(level)) {
      activeDifficulty = level;
      return true;
    }
    return false;
  },

  jwtSecrets: {
    easy: 'easy_dev_secret_key_1337',
    medium: 'secret123', // Weak dictionary secret crackable with rockyou/jwtcat
    hard: crypto.randomBytes(32).toString('hex'), // Strong random secret, vulnerable to kid / jwk header parameter confusion
  },

  flags: {
    jwt: {
      easy: getFlag('FLAG_SHOP_AUTH_JWT_EASY', 'shop-auth-jwt-easy'),
      medium: getFlag('FLAG_SHOP_AUTH_JWT_MEDIUM', 'shop-auth-jwt-medium'),
      hard: getFlag('FLAG_SHOP_AUTH_JWT_HARD', 'shop-auth-jwt-hard'),
    },
    bruteforce: {
      easy: getFlag('FLAG_SHOP_AUTH_BRUTEFORCE_EASY', 'shop-auth-bruteforce-easy'),
      medium: getFlag('FLAG_SHOP_AUTH_BRUTEFORCE_MEDIUM', 'shop-auth-bruteforce-medium'),
      hard: getFlag('FLAG_SHOP_AUTH_BRUTEFORCE_HARD', 'shop-auth-bruteforce-hard'),
    },
    reset: {
      easy: getFlag('FLAG_SHOP_AUTH_RESET_EASY', 'shop-auth-reset-easy'),
      medium: getFlag('FLAG_SHOP_AUTH_RESET_MEDIUM', 'shop-auth-reset-medium'),
      hard: getFlag('FLAG_SHOP_AUTH_RESET_HARD', 'shop-auth-reset-hard'),
    },
  },
};

module.exports = config;
