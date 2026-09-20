/**
 * JanSetu – Comprehensive Automated Test Suite
 * Validates Security Controls (OWASP) + Full Stakeholder Features End-to-End.
 * Usage: node scripts/test-all.js
 */
const assert = require('assert');

const BASE = 'http://localhost:3000';

function cookieHeader(res) {
  const sc = res.headers.get('set-cookie');
  if (!sc) return '';
  return sc.split(',').map((c) => c.split(';')[0].trim()).join('; ');
}

function getCsrf(cookieStr) {
  const m = cookieStr.match(/jancsrf=([^;]+)/);
  return m ? m[1] : '';
}

let passCount = 0;
function test(name, fn) {
  return fn()
    .then(() => {
      passCount++;
      console.log(`  ✓ [PASS] ${name}`);
    })
    .catch((err) => {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
      throw err;
    });
}

async function run() {
  console.log('====================================================');
  console.log('  JanSetu – Enterprise Security & Feature Test Suite');
  console.log('====================================================\n');

  // =========================================================================
  // 1. SECURITY TESTS
  // =========================================================================
  console.log('--- SECTION 1: SECURITY & DEFENSE-IN-DEPTH CONTROLS ---');

  await test('Security Headers (CSP, Frame-Options, Nosniff, Permissions)', async () => {
    const res = await fetch(BASE + '/');
    assert.strictEqual(res.status, 200);
    const csp = res.headers.get('content-security-policy');
    assert.ok(csp, 'CSP header should be present');
    assert.ok(csp.includes("'self'"), 'CSP includes self');
    assert.ok(csp.includes('https://unpkg.com'), 'CSP allows unpkg');
    assert.ok(csp.includes('https://cdn.jsdelivr.net'), 'CSP allows jsdelivr');
    assert.ok(csp.includes('https://*.tile.openstreetmap.org'), 'CSP allows OSM tiles');
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY', 'X-Frame-Options is DENY');
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff', 'Nosniff is set');
    assert.ok(res.headers.get('permissions-policy'), 'Permissions-Policy is set');
  });

  await test('Authentication Enforcement: 401 on Protected Endpoints', async () => {
    const unauthedEndpoints = [
      { url: '/api/dashboard/my-problems', method: 'GET' },
      { url: '/api/evaluator/queue', method: 'GET' },
      { url: '/api/institution/projects', method: 'GET' },
      { url: '/api/admin/users', method: 'GET' },
      { url: '/api/admin/audit-logs', method: 'GET' },
    ];
    for (const ep of unauthedEndpoints) {
      const res = await fetch(BASE + ep.url, { method: ep.method });
      assert.strictEqual(res.status, 401, `Expected 401 for unauthenticated ${ep.url}`);
    }
  });

  await test('Role-Based Access Control: 403 on Privilege Escalation Attempts', async () => {
    // Login as citizen
    const citRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ram@example.com', password: 'Demo@123' }),
    });
    const citCookies = cookieHeader(citRes);

    // Citizen attempting Evaluator endpoint
    const evTry = await fetch(BASE + '/api/evaluator/queue', { headers: { 'Cookie': citCookies } });
    assert.strictEqual(evTry.status, 403, 'Citizen should be forbidden from evaluator queue');

    // Citizen attempting Admin endpoint
    const admTry = await fetch(BASE + '/api/admin/users', { headers: { 'Cookie': citCookies } });
    assert.strictEqual(admTry.status, 403, 'Citizen should be forbidden from admin users');

    // Citizen attempting HEI adopt endpoint
    const heiTry = await fetch(BASE + '/api/institution/bank', { headers: { 'Cookie': citCookies } });
    assert.strictEqual(heiTry.status, 403, 'Citizen should be forbidden from HEI desk');
  });

  await test('CSRF Protection: 403 when CSRF Token is Missing or Mismatched', async () => {
    const citRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ram@example.com', password: 'Demo@123' }),
    });
    const citCookies = cookieHeader(citRes);

    // POST without CSRF header
    const noCsrf = await fetch(BASE + '/api/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': citCookies },
      body: JSON.stringify({ title: 'Testing CSRF without token', description: 'Sample description for testing' }),
    });
    assert.strictEqual(noCsrf.status, 403, 'Mutating request without CSRF token must return 403');

    // POST with wrong CSRF header
    const badCsrf = await fetch(BASE + '/api/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': citCookies, 'X-CSRF-Token': 'invalid-token-12345' },
      body: JSON.stringify({ title: 'Testing CSRF with wrong token', description: 'Sample description for testing' }),
    });
    assert.strictEqual(badCsrf.status, 403, 'Mutating request with invalid CSRF token must return 403');
  });

  await test('XSS Injection Neutralization in Problem Submissions', async () => {
    const citRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ram@example.com', password: 'Demo@123' }),
    });
    const citCookies = cookieHeader(citRes);
    const csrf = getCsrf(citCookies);

    const xssPayload = {
      title: 'Water tank issue <script>alert("XSS")</script>',
      description: 'Dangerous payload <<SCRIPT>script>alert(1)<</SCRIPT>/script> and javascript:alert(document.cookie)',
      category: 'water',
      district: 'Ranchi',
    };

    const res = await fetch(BASE + '/api/problems', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': citCookies,
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify(xssPayload),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(!data.problem.title.includes('<script>'), 'Title must not contain script tags');
    assert.ok(!data.problem.description.includes('<script>'), 'Description must not contain script tags');
    assert.ok(!data.problem.description.includes('javascript:'), 'Description must not contain javascript: protocol');
  });

  await test('File Upload Security: Reject Executables and Double Extensions', async () => {
    const citRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ram@example.com', password: 'Demo@123' }),
    });
    const citCookies = cookieHeader(citRes);
    const csrf = getCsrf(citCookies);

    // 1. Rejected extension (.exe)
    const formExe = new FormData();
    formExe.append('file', new Blob(['fake executable content'], { type: 'application/x-msdownload' }), 'malware.exe');
    const resExe = await fetch(BASE + '/api/upload', {
      method: 'POST',
      headers: { 'Cookie': citCookies, 'X-CSRF-Token': csrf },
      body: formExe,
    });
    assert.strictEqual(resExe.status, 400, 'Uploading .exe must be rejected');

    // 2. Rejected double extension (.php.jpg)
    const formDouble = new FormData();
    formDouble.append('file', new Blob(['fake script in disguise'], { type: 'image/jpeg' }), 'script.php.jpg');
    const resDouble = await fetch(BASE + '/api/upload', {
      method: 'POST',
      headers: { 'Cookie': citCookies, 'X-CSRF-Token': csrf },
      body: formDouble,
    });
    assert.strictEqual(resDouble.status, 400, 'Uploading double extension file must be rejected');

    // 3. Allowed file (.png with image/png)
    const formPng = new FormData();
    formPng.append('file', new Blob(['fake image bytes'], { type: 'image/png' }), 'evidence.png');
    const resPng = await fetch(BASE + '/api/upload', {
      method: 'POST',
      headers: { 'Cookie': citCookies, 'X-CSRF-Token': csrf },
      body: formPng,
    });
    assert.strictEqual(resPng.status, 201, 'Uploading valid .png must succeed');
    const pngData = await resPng.json();
    assert.ok(pngData.url.startsWith('/uploads/'), 'URL points to /uploads/');
  });

  await test('Password Complexity Enforcement on Registration', async () => {
    // Weak password: only 5 chars
    const weak1 = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Weak Pass User', email: 'weak1@test.com', password: 'short' }),
    });
    assert.strictEqual(weak1.status, 400, 'Password < 8 chars must fail');

    // Weak password: letters only, no digits/symbols
    const weak2 = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Weak Pass User', email: 'weak2@test.com', password: 'onlylettershere' }),
    });
    assert.strictEqual(weak2.status, 400, 'Password without digits/symbols must fail');

    // Registration without OTP must fail
    const noOtp = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Security Tested User', email: 'secuser' + Date.now() + '@gmail.com', password: 'StrongPass@2026' }),
    });
    assert.strictEqual(noOtp.status, 400, 'Registration without OTP must fail');

    // Send OTP and register with strong password
    const secEmail = 'secuser' + Date.now() + '@gmail.com';
    const otpRes = await fetch(BASE + '/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: secEmail, role: 'citizen' }),
    });
    assert.strictEqual(otpRes.status, 200, 'Send OTP must succeed');
    const otpData = await otpRes.json();

    const strong = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Security Tested User', email: secEmail, otp: otpData.devOtp, password: 'StrongPass@2026' }),
    });
    assert.strictEqual(strong.status, 201, 'Strong password registration with valid OTP must succeed');
  });

  await test('Registration Requires a Gmail Address for Every Role', async () => {
    const nonGmail = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Non Gmail Citizen', email: 'citizen' + Date.now() + '@example.com', password: 'StrongPass@2026' }),
    });
    assert.strictEqual(nonGmail.status, 400, 'Citizen registration with a non-Gmail address must fail');

    // Non-Gmail addresses must be rejected for every role, not just citizens
    const evalEmail = 'evaluator' + Date.now() + '@example.com';
    const evalOtp = await fetch(BASE + '/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: evalEmail, role: 'evaluator' }),
    });
    assert.strictEqual(evalOtp.status, 400, 'Send OTP for a non-Gmail evaluator address must fail');

    const nonGmailEvaluator = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Non Gmail Evaluator', role: 'evaluator', email: evalEmail, otp: '123456', password: 'StrongPass@2026' }),
    });
    assert.strictEqual(nonGmailEvaluator.status, 400, 'Evaluator registration with a non-Gmail address must fail');

    // The same evaluator role still works with a Gmail address
    const gmailEvaluator = 'evaluator' + Date.now() + '@gmail.com';
    const gmailOtp = await fetch(BASE + '/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: gmailEvaluator, role: 'evaluator' }),
    });
    assert.strictEqual(gmailOtp.status, 200, 'Send OTP for a Gmail evaluator address must succeed');
    const gmailData = await gmailOtp.json();

    const evaluator = await fetch(BASE + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gmail Evaluator', role: 'evaluator', email: gmailEvaluator, otp: gmailData.devOtp, password: 'StrongPass@2026' }),
    });
    assert.strictEqual(evaluator.status, 201, 'Evaluator registration with a Gmail address and OTP must succeed');
  });

  await test('Security Audit Trails: Failed Logins Recorded in Audit Logs', async () => {
    // Intentionally fail a login
    await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ram@example.com', password: 'WrongPassword!123' }),
    });

    // Login as admin to view audit logs
    const admRes = await fetch(BASE + '/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Jansetu@2024' }),
    });
    const admCookies = cookieHeader(admRes);

    const logsRes = await fetch(BASE + '/api/admin/audit-logs', { headers: { 'Cookie': admCookies } });
    const logs = await logsRes.json();
    const hasLoginFailure = logs.some((l) => l.action === 'login_failure');
    assert.ok(hasLoginFailure, 'Audit log must capture login_failure event');
  });

  // =========================================================================
  // 2. END-TO-END FUNCTIONAL FEATURE TESTS
  // =========================================================================
  console.log('\n--- SECTION 2: END-TO-END STAKEHOLDER FEATURES ---');

  await test('All 11 Frontend Pages Accessible (HTTP 200)', async () => {
    const pages = [
      '/', '/report.html', '/problems.html', '/track.html',
      '/impact.html', '/dashboard.html', '/evaluator.html',
      '/institution.html', '/industry.html', '/projects.html',
      '/admin-login.html', '/admin.html'
    ];
    for (const p of pages) {
      const res = await fetch(BASE + p);
      assert.strictEqual(res.status, 200, `Page ${p} should return 200 OK`);
    }
  });

  await test('Citizen Journey: Submit Problem, Endorse, & Track', async () => {
    const citRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'ram@example.com', password: 'Demo@123' }),
    });
    const citCookies = cookieHeader(citRes);
    const csrf = getCsrf(citCookies);

    // 1. Submit problem
    const probRes = await fetch(BASE + '/api/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': citCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({
        title: 'Solar street light inverter damaged in Tamar block',
        description: 'The solar panel inverter installed under district rural lighting failed 2 months ago. Night market and pedestrians are affected.',
        category: 'electricity',
        district: 'Ranchi',
        block: 'Tamar',
        village: 'Tamar',
      }),
    });
    assert.strictEqual(probRes.status, 201);
    const probData = await probRes.json();
    const pid = probData.problem.public_id;
    const internalId = probData.problem.id;

    // 2. Endorse (vote)
    const voteRes = await fetch(BASE + '/api/problems/' + encodeURIComponent(pid) + '/vote', {
      method: 'POST',
      headers: { 'Cookie': citCookies, 'X-CSRF-Token': csrf },
    });
    assert.strictEqual(voteRes.status, 200);

    // 3. Track
    const trackRes = await fetch(BASE + '/api/problems/' + encodeURIComponent(pid));
    assert.strictEqual(trackRes.status, 200);
    const trackData = await trackRes.json();
    assert.strictEqual(trackData.problem.public_id, pid);
    assert.strictEqual(trackData.problem.votes, 1);
  });

  await test('Evaluator Journey: Review Queue, 4-Metric Rubric, & Approve', async () => {
    const evRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'sinha@example.com', password: 'Demo@123' }),
    });
    const evCookies = cookieHeader(evRes);
    const csrf = getCsrf(evCookies);

    // Get queue
    const qRes = await fetch(BASE + '/api/evaluator/queue', { headers: { 'Cookie': evCookies } });
    assert.strictEqual(qRes.status, 200);
    const queue = await qRes.json();
    assert.ok(queue.length > 0, 'Queue should have pending items');
    const targetProblem = queue[0];

    // Submit review
    const revRes = await fetch(BASE + '/api/evaluator/review/' + targetProblem.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': evCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({
        decision: 'approve',
        impact: 5,
        feasibility: 5,
        innovation: 4,
        resources: 3,
        comments: 'Strong community impact and feasible technical prototype scope.',
      }),
    });
    assert.strictEqual(revRes.status, 200);
    const revData = await revRes.json();
    assert.strictEqual(revData.problem.status, 'approved');
  });

  await test('HEI & Project Lifecycle: Adopt Problem, Milestones, & Discussion', async () => {
    const heiRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'nirmal@example.com', password: 'Demo@123' }),
    });
    const heiCookies = cookieHeader(heiRes);
    const csrf = getCsrf(heiCookies);

    // 1. Get adoptable bank
    const bankRes = await fetch(BASE + '/api/institution/bank', { headers: { 'Cookie': heiCookies } });
    assert.strictEqual(bankRes.status, 200);
    const bank = await bankRes.json();
    assert.ok(bank.length > 0, 'Adoptable bank has approved problems');
    const targetProblem = bank[0];

    // 2. Pick the problem statement AND submit the solution proposal in one step
    const adoptRes = await fetch(BASE + '/api/institution/adopt/' + targetProblem.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': heiCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({
        title: 'Solar hybrid water pumping for Bandgaon handpump',
        team: ['Rohan (B.Tech EE)', 'Anjali (M.Tech Energy)'],
        approach: 'Install a solar-powered pump with a storage tank and IoT level monitoring for the community handpump.',
        impact: 'About 250 families get clean drinking water within the village.',
        resources: '2kW solar panels, inverter, tank, ₹1.2 lakh, 12 weeks.',
        risks: 'Panchayat land permission and monsoon installation window.',
      }),
    });
    assert.strictEqual(adoptRes.status, 201);
    const adoptData = await adoptRes.json();
    const projectId = adoptData.project.id;
    assert.strictEqual(adoptData.milestone.type, 'proposal', 'Solution proposal stored as first milestone');
    assert.ok(adoptData.project.team.length >= 1, 'Student team saved on the project');
    assert.ok(adoptData.project.milestones.some((m) => m.type === 'proposal'), 'Proposal visible on the project');

    // 3. Post milestone
    const msRes = await fetch(BASE + '/api/projects/' + projectId + '/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': heiCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({
        title: 'Component Procurement and Inverter Circuit Design',
        type: 'prototype',
        notes: 'Inverter testing completed in campus lab.',
      }),
    });
    assert.strictEqual(msRes.status, 201);

    // 4. Send discussion message
    const msgRes = await fetch(BASE + '/api/projects/' + projectId + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': heiCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({ body: 'Lab testing successful. Preparing for Tamar field trial.' }),
    });
    assert.strictEqual(msgRes.status, 201);

    // 5. Verify project detail returns milestones and messages
    const detRes = await fetch(BASE + '/api/projects/' + projectId, { headers: { 'Cookie': heiCookies } });
    assert.strictEqual(detRes.status, 200);
    const detData = await detRes.json();
    assert.ok(detData.project.milestones.length >= 1, 'Project has milestones');
    assert.ok(detData.messages.length >= 1, 'Project has messages');
  });

  await test('Industry Journey: Active Projects, CSR Co-funding Offer, & Collabs Retrieval', async () => {
    const indRes = await fetch(BASE + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'meena@example.com', password: 'Demo@123' }),
    });
    const indCookies = cookieHeader(indRes);
    const csrf = getCsrf(indCookies);

    // 1. Get active projects
    const actRes = await fetch(BASE + '/api/industry/active-projects', { headers: { 'Cookie': indCookies } });
    assert.strictEqual(actRes.status, 200);
    const actProjects = await actRes.json();
    assert.ok(actProjects.length > 0, 'Industry can browse active projects');
    const targetProj = actProjects[0];

    // 2. Submit collaboration offer
    const colRes = await fetch(BASE + '/api/industry/collaborate/' + targetProj.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': indCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({
        title: 'CSR Solar Hardware Grant',
        description: 'Supplying 2kW solar inverters and battery packs for testing.',
        funding_amount: 75000,
      }),
    });
    assert.strictEqual(colRes.status, 201);

    // 3. Retrieve industry collabs
    const myColRes = await fetch(BASE + '/api/industry/collabs', { headers: { 'Cookie': indCookies } });
    assert.strictEqual(myColRes.status, 200);
    const myCollabs = await myColRes.json();
    assert.ok(myCollabs.length > 0, 'Industry collabs list returns records');
  });

  await test('Admin Journey: KPI Stats, User Role Change, & CSV Export', async () => {
    const admRes = await fetch(BASE + '/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Jansetu@2024' }),
    });
    const admCookies = cookieHeader(admRes);
    const csrf = getCsrf(admCookies);

    // 1. Stats
    const statsRes = await fetch(BASE + '/api/admin/stats', { headers: { 'Cookie': admCookies } });
    assert.strictEqual(statsRes.status, 200);
    const stats = await statsRes.json();
    assert.ok(stats.totalProblems >= 5, 'Stats show total problems');

    // 2. Users list & Role update
    const usersRes = await fetch(BASE + '/api/admin/users', { headers: { 'Cookie': admCookies } });
    assert.strictEqual(usersRes.status, 200);
    const users = await usersRes.json();
    const citizenUser = users.find((u) => u.role === 'citizen');
    assert.ok(citizenUser, 'Found citizen user to promote');

    const roleRes = await fetch(BASE + '/api/admin/users/' + citizenUser.id + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': admCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({ role: 'evaluator' }),
    });
    assert.strictEqual(roleRes.status, 200);
    const roleData = await roleRes.json();
    assert.strictEqual(roleData.user.role, 'evaluator', 'User promoted to evaluator');

    // Revert role back to citizen
    await fetch(BASE + '/api/admin/users/' + citizenUser.id + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Cookie': admCookies, 'X-CSRF-Token': csrf },
      body: JSON.stringify({ role: 'citizen' }),
    });

    // 3. CSV Export
    const csvRes = await fetch(BASE + '/api/admin/export.csv', { headers: { 'Cookie': admCookies } });
    assert.strictEqual(csvRes.status, 200);
    assert.strictEqual(csvRes.headers.get('content-type'), 'text/csv; charset=utf-8');
    const csvContent = await csvRes.text();
    assert.ok(csvContent.includes('public_id,title,category'), 'CSV has correct header');
  });

  console.log('\n====================================================');
  console.log(`  RESULTS: All ${passCount} Tests Passed Successfully! 🚀`);
  console.log('====================================================\n');
}

run().catch(() => process.exit(1));
