// NetPulse Diagnostics Console Interactive Scripts
document.addEventListener('DOMContentLoaded', () => {
    // 1. Difficulty Switcher Dropdown
    const diffSwitchBtn = document.getElementById('diffSwitchBtn');
    const diffMenu = document.getElementById('diffMenu');

    if (diffSwitchBtn && diffMenu) {
        diffSwitchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            diffMenu.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            diffMenu.classList.remove('show');
        });
    }

    // 2. Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            if (!targetId) return;

            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // 3. Ping Diagnostic Form Submission
    const pingForm = document.getElementById('pingForm');
    const pingOutput = document.getElementById('pingOutput');
    const pingSubmitBtn = document.getElementById('pingSubmitBtn');

    if (pingForm && pingOutput) {
        pingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const host = document.getElementById('pingHost').value.trim();
            const count = document.getElementById('pingCount').value;

            if (!host) return;

            pingSubmitBtn.disabled = true;
            pingOutput.textContent = `$ ping -c ${count} ${host}\n[+] Dispathing ICMP probes... awaiting network response...`;

            try {
                const res = await fetch('/api/ping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ host, count })
                });

                const data = await res.json();
                if (data.success) {
                    pingOutput.textContent = `$ ${data.command}\n${data.output}`;
                } else {
                    pingOutput.textContent = `[!] Error: ${data.error || 'Execution failed.'}`;
                }
            } catch (err) {
                pingOutput.textContent = `[!] Network transport failure: ${err.message}`;
            } finally {
                pingSubmitBtn.disabled = false;
            }
        });
    }

    // 4. SSRF Health Inspection Form Submission
    const ssrfForm = document.getElementById('ssrfForm');
    const ssrfResponse = document.getElementById('ssrfResponse');
    const ssrfSubmitBtn = document.getElementById('ssrfSubmitBtn');

    if (ssrfForm && ssrfResponse) {
        ssrfForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('ssrfUrl').value.trim();
            if (!url) return;

            ssrfSubmitBtn.disabled = true;
            ssrfResponse.textContent = `[+] Initiating connection to: ${url}\n[+] Performing DNS resolution and policy verification...`;

            try {
                const res = await fetch('/api/ssrf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });

                const data = await res.json();
                if (data.success) {
                    let formatted = `HTTP Status: ${data.status_code}\n`;
                    formatted += `Final Target: ${data.url_final}\n\n`;
                    formatted += `--- Response Headers ---\n`;
                    for (const [k, v] of Object.entries(data.headers || {})) {
                        formatted += `${k}: ${v}\n`;
                    }
                    formatted += `\n--- Response Body Preview ---\n`;
                    formatted += data.body || '[Empty Response]';
                    ssrfResponse.textContent = formatted;
                } else {
                    ssrfResponse.textContent = `[!] SSRF Error: ${data.error || 'Failed to inspect target.'}`;
                }
            } catch (err) {
                ssrfResponse.textContent = `[!] Client request error: ${err.message}`;
            } finally {
                ssrfSubmitBtn.disabled = false;
            }
        });
    }

    // 5. Admin Bot Simulation Form
    const botForm = document.getElementById('botForm');
    const botOutput = document.getElementById('botOutput');
    const botSubmitBtn = document.getElementById('botSubmitBtn');

    if (botForm && botOutput) {
        botForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetUrl = document.getElementById('botUrl').value.trim();
            if (!targetUrl) return;

            botSubmitBtn.disabled = true;
            botOutput.textContent = `[+] Dispatching automated admin crawler to: ${targetUrl}\n[+] Initializing headless context with administrative cookie...`;

            try {
                const res = await fetch('/api/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: targetUrl })
                });

                const data = await res.json();
                if (data.status === 'success') {
                    let text = `[✓] SUCCESS: Administrator crawler completed inspection!\n\n`;
                    text += `Status: ${data.message}\n`;
                    text += `Captured Cookie: ${data.leaked_cookie}\n`;
                    text += `Flag: ${data.flag}\n`;
                    botOutput.textContent = text;
                } else {
                    botOutput.textContent = `[-] Notice: ${data.message || 'Inspection completed with no exploit execution.'}`;
                }
            } catch (err) {
                botOutput.textContent = `[!] Admin bot communication error: ${err.message}`;
            } finally {
                botSubmitBtn.disabled = false;
            }
        });
    }
});
