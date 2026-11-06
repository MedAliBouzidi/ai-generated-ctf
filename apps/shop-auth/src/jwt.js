const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('./config');

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function sign(header, payload, secret) {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  
  if (header.alg && header.alg.toLowerCase() === 'none') {
    return `${data}.`;
  }
  
  const signature = crypto.createHmac('sha256', secret || '').update(data).digest('base64url');
  return `${data}.${signature}`;
}

function createToken(payload, difficulty = config.getDifficulty()) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour
  const tokenPayload = { ...payload, iat, exp };

  if (difficulty === 'easy') {
    const header = { alg: 'HS256', typ: 'JWT' };
    return sign(header, tokenPayload, config.jwtSecrets.easy);
  } else if (difficulty === 'medium') {
    const header = { alg: 'HS256', typ: 'JWT' };
    return sign(header, tokenPayload, config.jwtSecrets.medium);
  } else {
    // Hard mode includes kid header parameter pointing to default key
    const header = { alg: 'HS256', typ: 'JWT', kid: 'src/public/keys/default.key' };
    const defaultKeyPath = path.resolve(__dirname, 'public/keys/default.key');
    let secret = config.jwtSecrets.hard;
    try {
      if (fs.existsSync(defaultKeyPath)) {
        secret = fs.readFileSync(defaultKeyPath, 'utf8');
      }
    } catch (_) {}
    return sign(header, tokenPayload, secret);
  }
}

function verifyToken(token, difficulty = config.getDifficulty()) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing or invalid format' };
  }

  const parts = token.trim().split('.');
  if (parts.length < 2 || parts.length > 3) {
    return { valid: false, error: 'Malformed JWT structure' };
  }

  const [headerB64, payloadB64, signatureB64 = ''] = parts;
  let header, payload;

  try {
    header = JSON.parse(base64UrlDecode(headerB64));
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (err) {
    return { valid: false, error: 'Invalid base64url or JSON encoding' };
  }

  const data = `${headerB64}.${payloadB64}`;
  const alg = (header.alg || '').toLowerCase();

  // EASY MODE VULNERABILITY: "alg": "none" accepted
  if (difficulty === 'easy') {
    if (alg === 'none') {
      return {
        valid: true,
        header,
        payload,
        exploit: 'alg_none',
        flag: config.flags.jwt.easy,
      };
    }

    // Otherwise verify with easy secret
    const expectedSig = crypto.createHmac('sha256', config.jwtSecrets.easy).update(data).digest('base64url');
    if (signatureB64 === expectedSig) {
      return { valid: true, header, payload };
    }
    return { valid: false, error: 'Invalid JWT signature' };
  }

  // MEDIUM MODE VULNERABILITY: Weak dictionary secret
  if (difficulty === 'medium') {
    if (alg === 'none') {
      return { valid: false, error: 'Security Exception: Algorithm "none" is disallowed in medium security mode' };
    }

    if (alg !== 'hs256') {
      return { valid: false, error: `Unsupported algorithm: ${header.alg}` };
    }

    const expectedSig = crypto.createHmac('sha256', config.jwtSecrets.medium).update(data).digest('base64url');
    if (signatureB64 === expectedSig) {
      return {
        valid: true,
        header,
        payload,
        exploit: 'weak_secret',
        flag: config.flags.jwt.medium,
      };
    }
    return { valid: false, error: 'Invalid JWT signature' };
  }

  // HARD MODE VULNERABILITY: Header parameter injection / Key ID traversal
  if (difficulty === 'hard') {
    if (alg === 'none') {
      return { valid: false, error: 'Security Exception: Algorithm "none" is strictly rejected in hard security mode' };
    }

    if (alg !== 'hs256') {
      return { valid: false, error: `Unsupported algorithm: ${header.alg}` };
    }

    let verificationKey = null;
    let exploitType = null;

    // Vulnerability 1: Embedded JWK (RFC 7515 / RFC 7517)
    if (header.jwk) {
      let rawKey = header.jwk.k || header.jwk.key;
      if (rawKey) {
        exploitType = 'jwk_injection';
        // Check if k is base64url encoded
        try {
          const decodedKey = Buffer.from(rawKey, 'base64').toString('utf8');
          verificationKey = decodedKey || rawKey;
        } catch (_) {
          verificationKey = rawKey;
        }
      }
    }
    // Vulnerability 2: Key ID (kid) path traversal
    else if (header.kid) {
      exploitType = 'kid_traversal';
      try {
        let keyPath;
        if (header.kid.startsWith('/')) {
          keyPath = header.kid;
        } else {
          keyPath = path.resolve(__dirname, '..', header.kid);
        }

        if (fs.existsSync(keyPath)) {
          verificationKey = fs.readFileSync(keyPath, 'utf8');
        } else {
          return { valid: false, error: `Key file not found: ${header.kid}` };
        }
      } catch (err) {
        return { valid: false, error: `Error reading key ID: ${err.message}` };
      }
    } else {
      // Standard server secret
      verificationKey = config.jwtSecrets.hard;
    }

    if (verificationKey === null) {
      return { valid: false, error: 'Unable to resolve verification key' };
    }

    const expectedSig = crypto.createHmac('sha256', verificationKey).update(data).digest('base64url');
    if (signatureB64 === expectedSig) {
      const isExploited = exploitType !== null;
      return {
        valid: true,
        header,
        payload,
        exploit: exploitType,
        flag: isExploited ? config.flags.jwt.hard : undefined,
      };
    }
    return { valid: false, error: 'Invalid JWT signature' };
  }

  return { valid: false, error: 'Unknown difficulty mode' };
}

module.exports = {
  base64UrlEncode,
  base64UrlDecode,
  sign,
  createToken,
  verifyToken,
};
