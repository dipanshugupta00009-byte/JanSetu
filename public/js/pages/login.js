/* JanSetu - login page */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  async function init() {
    J.renderHeader(); J.renderFooter();
    const me = await J.fetchMe();
    if (me.authed) { window.location.href = '/dashboard.html'; return; }
    $('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Logging in�';
      try {
        const data = await J.api('/auth/login', { method: 'POST', body: JSON.stringify({ login: $('lg-login').value.trim(), password: $('lg-password').value }) });
        J.invalidateMe();
        const next = new URLSearchParams(window.location.search).get('next') || '/dashboard.html';
        window.location.href = next;
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Login � ?????';
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
