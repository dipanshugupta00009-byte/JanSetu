/* JanSetu - register page */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  async function loadDistricts() {
    try { const d = await J.api('/problems/options'); $('rg-district').innerHTML = '<option value="">Select district</option>' + d.districts.map((x) => '<option value="' + J.esc(x) + '">' + J.esc(x) + '</option>').join(''); }
    catch (e) {}
  }

  async function init() {
    J.renderHeader(); J.renderFooter();
    const me = await J.fetchMe();
    if (me.authed) { window.location.href = '/dashboard.html'; return; }
    await loadDistricts();

    $('rg-role').addEventListener('change', () => {
      const v = $('rg-role').value;
      $('rg-org-field').classList.toggle('hide', !(v === 'institution' || v === 'industry'));
    });

    $('reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = $('rg-role').value;
      const name = $('rg-name').value.trim();
      const email = $('rg-email').value.trim();
      const phone = $('rg-phone').value.trim();
      const org = $('rg-org').value.trim();
      const district = $('rg-district').value;
      const p1 = $('rg-password').value;
      const p2 = $('rg-password2').value;
      if (!name) return J.toast('Please enter your name.', true);
      if ((!email && !phone)) return J.toast('Email or mobile number is required.', true);
      if (role === 'citizen' && email && !/^[^\s@]+@gmail\.com$/i.test(email)) return J.toast('Citizen accounts require a Gmail address ending with @gmail.com.', true);
      if (((role === 'institution') || (role === 'industry')) && !org) return J.toast('Organisation name is required for this role.', true);
      if (p1 !== p2) return J.toast('Passwords do not match.', true);
      if (p1.length < 8) return J.toast('Password must be at least 8 characters.', true);
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating account�';
      try {
        const data = await J.api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, phone, role, org_name: org, district, password: p1, language: J.getLang() }) });
        J.invalidateMe();
        const next = new URLSearchParams(window.location.search).get('next') || '/dashboard.html';
        window.location.href = next;
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Create Account � ???? ?????';
        J.toast(err.message, true);
      }
    });
  }
// ---- Sign in with Google / Gmail (direct Gmail connection option) ----
  async function loadGsi() {
    if (document.getElementById('gsi-client')) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = 'gsi-client';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load the Google sign-in script.'));
      document.head.appendChild(s);
    });
  }

  async function handleGoogleCredential(response) {
    const btnEl = $('google-btn');
    const btn = btnEl ? btnEl.querySelector('button') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in�'; }
    try {
      const data = await J.api('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential, language: J.getLang() }) });
      J.invalidateMe();
      const next = new URLSearchParams(window.location.search).get('next') || '/dashboard.html';
      window.location.href = next;
    } catch (err) {
      if (btn) { btn.disabled = false; }
      J.toast(err.message, true);
    }
  }

  async function initGoogleAuth() {
    try {
      const cfg = await J.api('/auth/google/config');
      if (!cfg || !cfg.enabled || !cfg.client_id) return;
      await loadGsi();
      window.google.accounts.id.initialize({
        client_id: cfg.client_id,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
      });
      const gAuth = $('google-auth');
      const gBtn = $('google-btn');
      if (gAuth && gBtn) {
        gAuth.classList.remove('hide');
        window.google.accounts.id.renderButton(gBtn, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 300,
        });
      }
    } catch (e) { /* Google sign-in unavailable � skip silently */ }
  }
  initGoogleAuth();
  document.addEventListener('DOMContentLoaded', init);
})();
