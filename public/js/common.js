/* ============================================================
   JanSetu - shared frontend utilities (API, i18n, auth, UI)
   ============================================================ */
(function () {
  const J = (window.JanSetu = window.JanSetu || {});

  function getCookie(name) {
    const parts = document.cookie.split(';');
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (p.indexOf(name + '=') === 0) return decodeURIComponent(p.slice(name.length + 1));
    }
    return null;
  }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const csrf = getCookie('jancsrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const res = await fetch('/api' + path, Object.assign({}, opts, { headers, credentials: 'same-origin' }));
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json() : await res.text();
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || ('Request failed (' + res.status + ')');
      const err = new Error(msg); err.status = res.status; err.data = data;
      throw err;
    }
    return data;
  }
  J.api = api;

  const DICT = {
    'nav.home': { en: 'Home', hi: 'होम' },
    'nav.report': { en: 'Report Problem', hi: 'समस्या दर्ज करें' },
    'nav.problems': { en: 'Problem Bank', hi: 'समस्या बैंक' },
    'nav.track': { en: 'Track Status', hi: 'स्थिति देखें' },
    'nav.impact': { en: 'Impact', hi: 'प्रभाव' },
    'nav.dashboard': { en: 'My Dashboard', hi: 'मेरा डैशबोर्ड' },
    'nav.projects': { en: 'Projects', hi: 'परियोजनाएँ' },
    'nav.evaluator': { en: 'Review Queue', hi: 'समीक्षा क्यू' },
    'nav.institution': { en: 'HEI Desk', hi: 'संस्थान डेस्क' },
    'nav.industry': { en: 'Industry Desk', hi: 'उद्योग डेस्क' },
    'nav.admin': { en: 'Admin', hi: 'एडमिन' },
    'nav.adminview': { en: 'Admin Dashboard', hi: 'एडमिन डैशबोर्ड' },
    'nav.adminlogin': { en: 'Admin Login', hi: 'एडमिन लॉगिन' },
    'nav.login': { en: 'Login', hi: 'लॉगिन' },
    'nav.register': { en: 'Register', hi: 'पंजीकरण' },
    'nav.logout': { en: 'Logout', hi: 'लॉगआउट' },
    'brand.slogan': { en: 'Jharkhand Community Problem & Solution Platform', hi: 'झारखंड सामुदायिक समस्या एवं समाधान मंच' },
    'brand.nep': { en: 'NEP 2020 Aligned', hi: 'राष्ट्रीय शिक्षा नीति 2020' },
    'gov.name': { en: 'Government of Jharkhand', hi: 'झारखंड सरकार' },
    'hero.sub': { en: "Report ground-level civic and social problems of your village, block or district — and let Jharkhand's universities and industry partners develop real solutions with you.", hi: 'अपने गांव, प्रखंड या जिले की नागरिक और सामाजिक समस्याओं को दर्ज करें — झारखंड के विश्वविद्यालय और उद्योग साझेदार आपके साथ वास्तविक समाधान विकसित करेंगे।' },
  };
  let LANG = 'en';
  try { LANG = localStorage.getItem('jansetu_lang') === 'hi' ? 'hi' : 'en'; } catch (e) {}

  function t(key) { const e = DICT[key]; return e ? e[LANG] : key; }
  J.t = t;
  function applyLanguage() {
    document.documentElement.lang = LANG;
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('.lang-switch button').forEach((b) => b.classList.toggle('active', b.dataset.lang === LANG));
  }
  J.setLang = function (lang) {
    LANG = lang === 'hi' ? 'hi' : 'en';
    try { localStorage.setItem('jansetu_lang', LANG); } catch (e) {}
    applyLanguage();
  };
  J.getLang = function () { return LANG; };
  function initLangButtons() {
    document.querySelectorAll('.lang-switch button').forEach((b) => {
      b.addEventListener('click', () => window.JanSetu.setLang(b.dataset.lang));
      b.classList.toggle('active', b.dataset.lang === LANG);
    });
  }
  J.initLangButtons = initLangButtons;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  J.esc = esc;

  const STATUS_LABELS = {
    submitted: 'Not Assigned Yet (Under Review)',
    under_review: 'Under Review',
    info_needed: 'More Info Needed',
    approved: 'Wait for Selection',
    rejected: 'Rejected',
    escalated: 'Escalated',
    assigned: 'Assigned (Department Assigned)',
    in_progress: 'Propose Solution (In Progress)',
    piloted: 'Student Build & Pilot',
    deployed: 'Assign Completed (Deployed)',
    closed: 'Completed (Mark as Resolved)'
  };
  J.statusLabel = (s) => STATUS_LABELS[s] || String(s || '').replace(/_/g, ' ');
  J.statusBadge = (s) => '<span class="badge ' + esc(s) + '">' + esc(J.statusLabel(s)) + '</span>';

  function fmtDate(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); } }
  J.fmtDate = fmtDate;
  function fmtDateTime(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(iso); } }
  J.fmtDateTime = fmtDateTime;

  function catIcon(cat) { const map = { education: '🎓', health: '🏥', water: '💧', sanitation: '🚻', agriculture: '🌾', roads_transport: '🛣️', electricity: '⚡', environment: '🌳', infrastructure: '🏗️', accessibility: '♿', public_services: '🏛️', women_child: '👩‍👧', tribal_welfare: '🪕', digital: '📡', housing: '🏠', others: '📌' }; return map[cat] || map.others; }
  J.catIcon = catIcon;

  function sevClass(v) { if (v >= 60) return 'sev-high'; if (v >= 34) return 'sev-mid'; return 'sev-low'; }
  J.sevClass = sevClass;

  let toastTimer;
  function toast(msg, isError) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  J.toast = toast;
  let meCache = null;
  async function fetchMe(force) {
    if (meCache && !force) return meCache;
    try { meCache = await api('/auth/me'); return meCache; }
    catch (e) { meCache = { authed: false, user: null }; return meCache; }
  }
  J.fetchMe = fetchMe;
  J.invalidateMe = function () { meCache = null; };

  async function requireAuth(roles) {
    const me = await fetchMe();
    if (!me.authed) { window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname); throw new Error('not-authed'); }
    if (Array.isArray(roles) && roles.length && !roles.includes(me.user.role)) { toast('This section requires a different account role.', true); setTimeout(() => { window.location.href = '/dashboard.html'; }, 900); throw new Error('role-denied'); }
    return me.user;
  }
  J.requireAuth = requireAuth;

  async function logout() { try { await api('/auth/logout', { method: 'POST' }); } catch (e) {} J.invalidateMe(); window.location.href = '/login.html'; }
  J.logout = logout;
  function roleLinks(user) {
    const links = [ { href: '/', key: 'nav.home' }, { href: '/report.html', key: 'nav.report' }, { href: '/problems.html', key: 'nav.problems' }, { href: '/track.html', key: 'nav.track' }, { href: '/impact.html', key: 'nav.impact' } ];
    if (user) {
      links.push({ href: '/dashboard.html', key: 'nav.dashboard' });
      if (user.role === 'evaluator' || user.role === 'admin') links.push({ href: '/evaluator.html', key: 'nav.evaluator' });
      if (user.role === 'institution' || user.role === 'admin') links.push({ href: '/institution.html', key: 'nav.institution' });
      if (user.role === 'industry' || user.role === 'admin') links.push({ href: '/industry.html', key: 'nav.industry' });
      if (['institution', 'industry', 'admin', 'evaluator'].includes(user.role)) links.push({ href: '/projects.html', key: 'nav.projects' });
      if (user.role === 'admin') links.push({ href: '/admin.html', key: 'nav.adminview' });
      links.push({ href: '/login.html', key: 'nav.logout', action: 'logout' });
    } else {
      links.push({ href: '/admin-login.html', key: 'nav.adminlogin' });
      links.push({ href: '/login.html', key: 'nav.login' });
      links.push({ href: '/register.html', key: 'nav.register' });
    }
    return links;
  }

  function renderHeader(activeKey) {
    const holder = document.getElementById('app-header');
    if (!holder) return;
    fetchMe().then((me) => {
      const user = me.user;
      const links = roleLinks(user);
      const navHtml = links.map((l) => '<li><a href="' + l.href + '"' + (l.action ? ' id="logout-link"' : '') + (activeKey === l.key ? ' class="active"' : '') + '><span data-i18n="' + l.key + '">' + t(l.key) + '</span></a></li>').join('');
      holder.innerHTML = `
      <div class="gov-strip">
        <span>🇮🇳 <span data-i18n="gov.name">${t('gov.name')}</span></span>
        <span style="flex:1"></span>
        <span class="lang-switch">
          <button data-lang="en">English</button>
          <button data-lang="hi">हिन्दी</button>
        </span>
      </div>
      <header class="main">
        <div class="brand-row">
          <img src="/logo.png" alt="JanSetu" class="seal" />
          <div>
            <div class="title-b">JanSetu · जनसाथ</div>
            <div class="title-s"><span data-i18n="brand.slogan">${t('brand.slogan')}</span> · <span data-i18n="brand.nep">${t('brand.nep')}</span></div>
          </div>
          <div class="spacer"></div>
          ${user ? '<span class="user-chip">👤 ' + esc(user.name) + ' <span class="pill">' + esc(user.role) + '</span></span>' : ''}
        </div>
        <nav class="menu"><ul>${navHtml}</ul></nav>
      </header>`;
      initLangButtons();
      applyLanguage();
      const lo = document.getElementById('logout-link');
      if (lo) lo.addEventListener('click', (e) => { e.preventDefault(); logout(); });
    });
  }
  J.renderHeader = renderHeader;

  function renderFooter() {
    const holder = document.getElementById('app-footer');
    if (!holder) return;
    holder.innerHTML = `
      <footer class="foot">
        <div class="f-grid">
          <div><h4>JanSetu · जनसाथ</h4><p>Jharkhand Community Problem & Solution Platform. Connecting Citizens, HEIs and Industry under NEP 2020.</p></div>
          <div><h4>Quick Links</h4><p><a href="/report.html">Report a Problem</a><br/><a href="/problems.html">Problem Bank</a><br/><a href="/impact.html">Impact Dashboard</a></p></div>
          <div><h4>Stakeholders</h4><p>Citizens · Evaluators · HEIs · Industry<br/><a href="/admin-login.html">Administrator Login</a></p></div>
          <div><h4>Compliance</h4><p>NEP 2020 · SDG Mapping · DPDP Act 2023 · CSR Reporting</p></div>
        </div>
        <div class="copy">© ${new Date().getFullYear()} JanSetu Platform. All rights reserved.</div>
      </footer>`;
  }
  J.renderFooter = renderFooter;
})();

