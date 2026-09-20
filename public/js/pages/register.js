/* JanSetu - register page */
(function () {
  const J = window.JanSetu;
  const $ = (id) => document.getElementById(id);

  // ---- Gmail-only rule: every registration email must end with @gmail.com ----
  const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;
  const GMAIL_ONLY_MSG = 'Only Gmail addresses ending with @gmail.com are accepted.';
  function isGmailAddress(email) { return GMAIL_RE.test(String(email || '').trim()); }

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

    let cooldownTimer = null;
    function startCooldown(seconds) {
      const button = $('send-otp');
      button.disabled = true;
      let remaining = seconds;
      button.textContent = `Resend in ${remaining}s · पुनः भेजें (${remaining}s)`;
      if (cooldownTimer) clearInterval(cooldownTimer);
      cooldownTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
          button.disabled = false;
          button.textContent = 'Send verification code · कोड भेजें';
        } else {
          button.textContent = `Resend in ${remaining}s · पुनः भेजें (${remaining}s)`;
        }
      }, 1000);
    }

    $('reg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = $('rg-role').value;
      const name = $('rg-name').value.trim();
      const email = $('rg-email').value.trim();
      const phone = $('rg-phone').value.trim();
      const otp = $('rg-otp').value.trim();
      const org = $('rg-org').value.trim();
      const district = $('rg-district').value;
      const p1 = $('rg-password').value;
      const p2 = $('rg-password2').value;
      if (!name) return J.toast('Please enter your name.', true);
      if (!email) return J.toast('Email address is required for all accounts.', true);
      if (!isGmailAddress(email)) return J.toast(GMAIL_ONLY_MSG, true);
      if (!otp) return J.toast('Please click "Send verification code" and enter the 6-digit OTP code received.', true);
      if (((role === 'institution') || (role === 'industry')) && !org) return J.toast('Organisation name is required for this role.', true);
      if (p1 !== p2) return J.toast('Passwords do not match.', true);
      if (p1.length < 8) return J.toast('Password must be at least 8 characters.', true);
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Creating account…';
      try {
        const data = await J.api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, phone, otp, role, org_name: org, district, password: p1, language: J.getLang() }) });
        J.invalidateMe();
        const next = new URLSearchParams(window.location.search).get('next') || '/dashboard.html';
        window.location.href = next;
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Create Account · खाता बनाएँ';
        J.toast(err.message, true);
      }
    });

    $('send-otp').addEventListener('click', async () => {
      const email = $('rg-email').value.trim();
      const role = $('rg-role').value;
      if (!email) return J.toast('Please enter your email address first.', true);
      if (!isGmailAddress(email)) {
        return J.toast(GMAIL_ONLY_MSG, true);
      }
      const button = $('send-otp');
      button.disabled = true;
      button.textContent = 'Sending code…';
      try {
        const result = await J.api('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email, role }) });
        $('rg-otp-field').classList.remove('hide');
        $('otp-status').textContent = result.message;
        if (result.devOtp) {
          $('rg-otp').value = result.devOtp;
        }
        $('rg-otp').focus();
        J.toast(result.message);
        startCooldown(30);
      } catch (err) {
        button.disabled = false;
        button.textContent = 'Send verification code · कोड भेजें';
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
    if (!response || !response.credential) {
      return J.toast('Google sign-in did not return valid credentials. Please try again.', true);
    }
    J.toast('Signing in with Google…');
    try {
      const data = await J.api('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential, language: J.getLang() }) });
      J.invalidateMe();
      const next = new URLSearchParams(window.location.search).get('next') || '/dashboard.html';
      window.location.href = next;
    } catch (err) {
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
    } catch (e) {
      console.error('Google sign-in unavailable:', e);
      const gAuth = $('google-auth');
      if (gAuth) {
        gAuth.classList.remove('hide');
        const note = gAuth.querySelector('.sm-note');
        if (note) note.textContent = 'Google sign-in is unavailable for this website origin. Add this site to the Google OAuth authorised origins.';
      }
    }
  }
  initGoogleAuth();
  document.addEventListener('DOMContentLoaded', init);
})();
