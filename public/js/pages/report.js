/* JanSetu - report problem page (geotag, media, voice, draft) */
(function () {
  const J = window.JanSetu;
  let map = null, marker = null, uploadedMedia = [];
  const draftKey = 'jansetu_draft_v1';
  const $ = (id) => document.getElementById(id);
  const DRAFT_FIELDS = ['pv-title', 'pv-desc', 'pv-tags', 'pv-block', 'pv-village', 'pv-address', 'pv-district', 'pv-category', 'pv-anonymous'];

  function saveDraft() {
    const d = { lat: $('pv-lat').value, lng: $('pv-lng').value, media: uploadedMedia };
    DRAFT_FIELDS.forEach((id) => { const el = $(id); d[id] = el.type === 'checkbox' ? el.checked : el.value; });
    try { localStorage.setItem(draftKey, JSON.stringify(d)); J.toast('Draft saved on this device.'); } catch (e) { J.toast('Could not save draft.', true); }
  }

  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (!d) return;
      DRAFT_FIELDS.forEach((id) => {
        const el = $(id); if (!el || d[id] == null) return;
        if (el.type === 'checkbox') el.checked = !!d[id];
        else if (el.tagName === 'SELECT') { if ([...el.options].some((o) => o.value === d[id])) el.value = d[id]; }
        else el.value = d[id];
      });
      if (d.lat && d.lng) { $('pv-lat').value = d.lat; $('pv-lng').value = d.lng; setPin(parseFloat(d.lat), parseFloat(d.lng)); }
      uploadedMedia = d.media || []; renderFileList();
    } catch (e) {}
  }

  async function loadOptions() {
    const data = await J.api('/problems/options');
    $('pv-category').innerHTML = data.categories.map((c) => '<option value="' + c.key + '">' + J.catIcon(c.key) + ' ' + J.esc(c.label) + '</option>').join('');
    $('pv-district').innerHTML = '<option value="">Select district</option>' + data.districts.map((d) => '<option value="' + J.esc(d) + '">' + J.esc(d) + '</option>').join('');
  }

  function setPin(lat, lng) {
    if (!map) return;
    if (marker) map.removeLayer(marker);
    marker = L.marker([lat, lng]).addTo(map);
    $('pv-lat').value = lat.toFixed(6); $('pv-lng').value = lng.toFixed(6);
  }

  function initMap() {
    map = L.map('map').setView([23.3441, 85.3096], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
    map.on('click', (e) => { setPin(e.latlng.lat, e.latlng.lng); $('geo-hint').textContent = 'Pin dropped: ' + e.latlng.lat.toFixed(5) + ', ' + e.latlng.lng.toFixed(5); });
    fetch('/api/public/stats').then((r) => r.json()).then((d) => {
      (d.mapPoints || []).slice(0, 60).forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 4, color: '#2170e6', fillOpacity: 0.5 }).addTo(map).bindPopup('<b>' + J.esc(p.title) + '</b><br/>' + J.esc(p.district));
      });
    }).catch(() => {});
  }

  function autoDetect() {
    if (!navigator.geolocation) { J.toast('Geolocation not supported by this browser.', true); return; }
    $('geo-autodetect').textContent = 'Detecting…';
    navigator.geolocation.getCurrentPosition(
      (pos) => { setPin(pos.coords.latitude, pos.coords.longitude); map.setView([pos.coords.latitude, pos.coords.longitude], 14); $('geo-autodetect').textContent = '🎯 Auto-detect my location'; $('geo-hint').textContent = 'Location detected automatically.'; },
      () => { J.toast('Could not detect location. Drop the pin manually on the map.', true); $('geo-autodetect').textContent = '🎯 Auto-detect my location'; },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }
  async function handleFiles(files) {
    for (const file of files) {
      if (uploadedMedia.length >= 5) { J.toast('Maximum 5 files.', true); break; }
      if (file.size > 15 * 1024 * 1024) { J.toast(file.name + ' is larger than 15 MB.', true); continue; }
      const fd = new FormData(); fd.append('file', file);
      try { const data = await J.api('/upload', { method: 'POST', body: fd }); uploadedMedia.push(data.url); J.toast('File added: ' + file.name); }
      catch (e) { J.toast('Upload failed: ' + e.message, true); }
    }
    renderFileList();
  }

  function renderFileList() {
    const box = $('pv-file-list');
    box.innerHTML = uploadedMedia.length
      ? uploadedMedia.map((u, i) => '<span class="pill">📎 file ' + (i + 1) + ' <button type="button" style="border:none;background:none;cursor:pointer;color:#c02b2b;font-weight:700" data-rm="' + i + '" aria-label="remove">✕</button></span>').join('')
      : '<span class="hint">No files added yet.</span>';
    box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { uploadedMedia.splice(Number(b.dataset.rm), 1); renderFileList(); }));
  }

  function voiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { J.toast('Voice input is not supported in this browser. Use Chrome.', true); return; }
    const rec = new SR();
    rec.lang = J.getLang() === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false; rec.maxAlternatives = 1;
    $('voice-status').textContent = '🎙️ Listening… speak now';
    rec.onresult = (evt) => { const transcript = evt.results[0][0].transcript; $('pv-desc').value += ($('pv-desc').value ? ' ' : '') + transcript; $('voice-status').textContent = '✓ Captured: ' + transcript.slice(0, 60); };
    rec.onerror = () => { $('voice-status').textContent = 'Voice input failed - try again.'; };
    rec.onend = () => { setTimeout(() => { $('voice-status').textContent = ''; }, 4000); };
    rec.start();
  }
  async function submit(e) {
    e.preventDefault();
    const title = $('pv-title').value.trim();
    const desc = $('pv-desc').value.trim();
    const category = $('pv-category').value;
    const district = $('pv-district').value;
    const lat = $('pv-lat').value, lng = $('pv-lng').value;
    if (title.length < 8) return J.toast('Title is too short (min 8 characters).', true);
    if (desc.length < 20) return J.toast('Please describe the problem in more detail.', true);
    const me = await J.fetchMe();
    if (!me.authed) { window.location.href = '/login.html?next=/report.html'; return; }
    const submitBtn = document.querySelector('#report-form button[type=submit]');
    submitBtn.disabled = true; submitBtn.textContent = 'Submitting…';
    try {
      const data = await J.api('/problems', { method: 'POST', body: JSON.stringify({
        title: title, description: desc, category: category, tags: $('pv-tags').value,
        district: district, block: $('pv-block').value, village: $('pv-village').value, address: $('pv-address').value,
        lat: lat || null, lng: lng || null, media: uploadedMedia,
        is_anonymous: $('pv-anonymous').checked, language: J.getLang(),
      })});
      localStorage.removeItem(draftKey);
      if (data.duplicate_of) {
        $('pv-similar').innerHTML = '<div class="alert info">⚠️ A very similar problem already exists: <b>' + J.esc(data.duplicate_of.title) + '</b> (<b>' + J.esc(data.duplicate_of.public_id) + '</b>). Your report has been linked to it.</div>';
      }
      J.toast(data.message || 'Submitted! 🎉');
      setTimeout(() => { window.location.href = '/track.html?id=' + encodeURIComponent(data.problem.public_id); }, 1400);
    } catch (err) {
      submitBtn.disabled = false; submitBtn.textContent = '🚀 Submit for Review';
      J.toast(err.message, true);
    }
  }

  async function init() {
    J.renderHeader('nav.report'); J.renderFooter();
    await loadOptions(); initMap(); loadDraft();
    const me = await J.fetchMe();
    if (!me.authed) $('auth-warning').classList.remove('hide');
    $('report-form').addEventListener('submit', submit);
    $('pv-draft').addEventListener('click', saveDraft);
    $('geo-autodetect').addEventListener('click', autoDetect);
    $('geo-reset').addEventListener('click', () => { if (marker) { map.removeLayer(marker); marker = null; } $('pv-lat').value = ''; $('pv-lng').value = ''; });
    $('voice-btn').addEventListener('click', voiceInput);
    $('pv-files').addEventListener('change', (e) => handleFiles([...e.target.files]));
  }
  document.addEventListener('DOMContentLoaded', init);
})();
