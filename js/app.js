/* app.js — owns view state and wires the DOM to Store + UI + Cal.
   Photos and notes now come from Supabase (async), so data loads after the
   user signs in. auth.js calls window.paw_load() on login and
   window.paw_clear() on logout. */

(function () {
  const $ = (id) => document.getElementById(id);
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };

  const PHOTOS_PER_WEEK = 2;
  const today = new Date();

  // ----- state -----
  let photos = [];
  let messages = [];
  let profile = Store.getProfile();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let diaryMode = false;
  let diaryPage = 0;
  let lastDir = 'next';

  function scatterFor(week, slot, weeks) {
    const rots = [-6, 5, -3, 6, -4, 4];
    const baseLeft = slot === 1 ? 8 : 48;
    const top = Math.min(((week - 1) / weeks) * 100 + 5, 78);
    return { x: baseLeft + (week % 2) * 10, y: top, rot: rots[(week + slot) % rots.length] };
  }
  function nextFreeSlot(y, m) {
    for (let w = 1; w <= Cal.weeksIn(y, m); w++) {
      const n = photos.filter(p => p.year === y && p.month === m && p.week === w).length;
      if (n < PHOTOS_PER_WEEK) return { week: w, slot: n + 1 };
    }
    return null;
  }

  // ----- theme -----
  function applyTheme(t) {
    document.body.dataset.theme = t;
    Store.setTheme(t);
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === t));
  }

  // ----- shrink image to a JPEG blob for upload -----
  function shrinkToBlob(img) {
    const max = 640;
    let { width, height } = img;
    if (width > height && width > max) { height *= max / width; width = max; }
    else if (height > max) { width *= max / height; height = max; }
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    c.getContext('2d').drawImage(img, 0, 0, width, height);
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.78));
  }

  // ----- load / clear (called by auth.js) -----
  async function load() {
    try {
      photos = await Store.getEntries();
      messages = await Store.getNotes();
    } catch (e) {
      UI.toast('Could not load your diary: ' + (e && e.message ? e.message : 'unknown error'));
      photos = []; messages = [];
    }
    render();
    maybeNotify();
  }
  function clearData() { photos = []; messages = []; render(); }

  // ----- data actions -----
  function persistArrangement(item) {
    if (!item) return;
    if ('text' in item) {
      Store.updateNote(item.id, { x: item.x, y: item.y, rot: item.rot }).catch(() => UI.toast("Couldn't save position."));
    } else {
      Store.updateEntry(item.id, { x: item.x, y: item.y, w: item.w, rot: item.rot }).catch(() => UI.toast("Couldn't save position."));
    }
  }

  function deletePhoto(id) {
    const p = photos.find(x => x.id === id);
    UI.confirmDialog(
      { title: 'Remove this photo?', text: "The photo and its note will be gone for good.", okLabel: 'Remove' },
      async () => {
        try {
          await Store.deleteEntry(id, p ? p.image_path : null);
          photos = photos.filter(x => x.id !== id);
          render();
        } catch { UI.toast("Couldn't delete — try again."); }
      }
    );
  }
  function deleteMessage(id) {
    UI.confirmDialog(
      { title: 'Remove this note?', text: 'This month note will be deleted.', okLabel: 'Remove' },
      async () => {
        try {
          await Store.deleteNote(id);
          messages = messages.filter(m => m.id !== id);
          render();
        } catch { UI.toast("Couldn't delete — try again."); }
      }
    );
  }

  function openMonthNote() {
    UI.openNotePanel(`${Cal.MONTHS[viewMonth]} ${viewYear}`, async (text) => {
      const draft = {
        year: viewYear, month: viewMonth, text,
        x: 24 + Math.random() * 34, y: 4 + Math.random() * 9, rot: Math.random() * 8 - 4,
      };
      try {
        const note = await Store.addNote(draft);
        messages.push(note);
        render();
      } catch { UI.toast("Couldn't save the note."); }
    });
  }

  // ----- render -----
  function render() {
    const monthSelect = $('monthSelect');
    if (monthSelect && !diaryMode) monthSelect.value = viewMonth;

    if (diaryMode && diaryPage === 0) {
      UI.renderCover({ year: viewYear, photos, profile, onNavigate: turnPage });
      updateStatus(0, 0);
      checkReminder();
      return;
    }

    const month = diaryMode ? diaryPage - 1 : viewMonth;
    const { weeks, count } = UI.renderBoard({
      year: viewYear, month, diaryMode, lastDir, photos, messages,
      onDeletePhoto: deletePhoto,
      onDeleteMessage: deleteMessage,
      onArrange: persistArrangement,
      onAddMessage: openMonthNote,
      onNavigate: turnPage,
    });

    updateStatus(weeks, count);
    checkReminder();
  }

  function updateStatus(weeks, count) {
    const box = $('status');
    if (!box) return;
    if (diaryMode) { box.innerHTML = ''; return; }
    const total = weeks * PHOTOS_PER_WEEK;
    if (count >= total) {
      const hasNext = viewMonth < 11;
      box.innerHTML = `<span class="done">✓ ${Cal.MONTHS[viewMonth]} complete!</span>` +
        (hasNext ? ` <button id="nextMonthBtn" class="link-btn">Go to ${Cal.MONTHS[viewMonth + 1]} →</button>` : '');
      on('nextMonthBtn', 'click', () => { lastDir = 'next'; viewMonth++; render(); });
    } else {
      box.innerHTML = `<span class="count">${count} of ${total} photos this month</span>`;
    }
  }

  // ----- navigation -----
  function turnPage(delta) {
    if (diaryMode) {
      const p = diaryPage + delta;
      if (p < 0 || p > 12) return;
      lastDir = delta > 0 ? 'next' : 'prev';
      diaryPage = p; render(); return;
    }
    const m = viewMonth + delta;
    if (m < 0 || m > 11) return;
    lastDir = delta > 0 ? 'next' : 'prev';
    viewMonth = m; render();
  }

  // ----- reminder -----
  function currentWeekMissing() {
    const y = today.getFullYear(), m = today.getMonth(), w = Cal.weekOfDate(today);
    return !photos.some(p => p.year === y && p.month === m && p.week === w);
  }
  function checkReminder() {
    const box = $('reminder');
    if (!box) return;
    if (!diaryMode && currentWeekMissing()) {
      box.innerHTML = `📸 Week ${Cal.weekOfDate(today)} of ${Cal.MONTHS[today.getMonth()]} — no photo yet. ` +
        `<button id="jumpBtn" class="link-btn">Add it now</button>`;
      box.style.display = 'block';
      on('jumpBtn', 'click', () => { viewMonth = today.getMonth(); render(); const ci = $('captionInput'); if (ci) ci.focus(); });
    } else { box.style.display = 'none'; }
  }
  function maybeNotify() {
    if (window.Notification && Notification.permission === 'granted' && currentWeekMissing()) {
      const key = `${today.getFullYear()}-${today.getMonth()}-${Cal.weekOfDate(today)}`;
      if (Store.getNotified() !== key) {
        new Notification('📸 Photo a Week', { body: `Add your week ${Cal.weekOfDate(today)} photo!` });
        Store.setNotified(key);
      }
    }
  }

  // ----- share links -----
  function currentMonth() { return diaryMode && diaryPage > 0 ? diaryPage - 1 : viewMonth; }
  function segValue(id) { const a = document.querySelector('#' + id + ' .seg-btn.active'); return a ? a.dataset.v : null; }

  function openSharePanel() {
    const scrim = $('sharePanel');
    if (!scrim) return;
    $('shareResult').hidden = true;
    scrim.hidden = false;
    // segmented toggles
    scrim.querySelectorAll('.seg').forEach(seg => {
      seg.querySelectorAll('.seg-btn').forEach(btn => {
        btn.onclick = () => { seg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
      });
    });
    $('shareClose').onclick = () => { scrim.hidden = true; };
    scrim.onclick = (e) => { if (e.target === scrim) scrim.hidden = true; };
    $('shareCreate').onclick = doCreateShare;
    refreshShareList();
  }

  async function doCreateShare() {
    const scope = segValue('shareScope') || 'month';
    const ttl = segValue('shareTtl') || 'once';
    const m = currentMonth();
    const inScope = (p) => scope === 'year' ? p.year === viewYear : (p.year === viewYear && p.month === m);
    const entries = photos.filter(inScope);
    const notes = messages.filter(inScope);
    if (entries.length === 0 && notes.length === 0) { UI.toast('Nothing to share here yet — add a photo first.'); return; }

    const opts = { once: { viewOnce: true, ttlDays: null }, '7': { ttlDays: 7 }, '30': { ttlDays: 30 }, none: { ttlDays: null } }[ttl];
    const label = scope === 'year' ? `${viewYear}` : `${Cal.MONTHS[m]} ${viewYear}`;

    const btn = $('shareCreate'); btn.disabled = true; btn.textContent = 'Creating…';
    try {
      const token = await Store.createShare({
        scope, year: viewYear, month: m, ttlDays: opts.ttlDays, viewOnce: !!opts.viewOnce,
        ownerName: (profile && profile.name) || '', theme: Store.getTheme(), label, entries, notes,
      });
      const link = new URL('share.html?s=' + token, location.href).href;
      $('shareLink').value = link;
      $('shareResult').hidden = false;
      $('shareCopy').onclick = () => {
        navigator.clipboard.writeText(link).then(() => UI.toast('Link copied!'),
          () => { $('shareLink').select(); UI.toast('Select and copy the link.'); });
      };
      refreshShareList();
    } catch (err) {
      UI.toast('Could not create link: ' + (err && err.message ? err.message : 'try again'));
    } finally {
      btn.disabled = false; btn.textContent = 'Create link';
    }
  }

  async function refreshShareList() {
    const box = $('shareList');
    if (!box) return;
    let shares = [];
    try { shares = await Store.getShares(); } catch { box.innerHTML = ''; return; }
    if (!shares.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="share-list-title">Your active links</div>` + shares.map(s => {
      let status = 'No limit';
      if (s.view_once) status = s.viewed ? 'Viewed (used up)' : 'View once';
      else if (s.expires_at) {
        const exp = new Date(s.expires_at);
        status = exp < new Date() ? 'Expired' : 'Until ' + exp.toLocaleDateString();
      }
      return `<div class="share-row">
        <span class="share-row-label">${escapeAttr(s.title || 'Untitled')}</span>
        <span class="share-row-status">${status}</span>
        <button class="link-btn revoke" data-t="${s.token}">Revoke</button>
      </div>`;
    }).join('');
    box.querySelectorAll('.revoke').forEach(b => b.onclick = async () => {
      try { await Store.revokeShare(b.dataset.t); refreshShareList(); UI.toast('Link revoked.'); }
      catch { UI.toast('Could not revoke.'); }
    });
  }
  function escapeAttr(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // ----- init (DOM wiring) -----
  function init() {
    const monthSelect = $('monthSelect');
    if (monthSelect) {
      monthSelect.innerHTML = Cal.MONTHS.map((name, m) => `<option value="${m}">${name} ${viewYear}</option>`).join('');
      monthSelect.value = viewMonth;
      monthSelect.addEventListener('change', () => { lastDir = 'next'; viewMonth = +monthSelect.value; render(); });
    }
    on('prevMonth', 'click', () => turnPage(-1));
    on('nextMonth', 'click', () => turnPage(1));

    document.querySelectorAll('.swatch').forEach(s => s.addEventListener('click', () => applyTheme(s.dataset.theme)));
    applyTheme(Store.getTheme());

    const fileInput = $('fileInput');
    const captionInput = $('captionInput');
    const songInput = $('songInput');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        const note = captionInput ? captionInput.value.trim() : '';
        if (!note) { UI.toast('Write a note for this week first.'); if (captionInput) captionInput.focus(); fileInput.value = ''; return; }
        const slot = nextFreeSlot(viewYear, viewMonth);
        if (!slot) { UI.toast(`${Cal.MONTHS[viewMonth]} is full — move to the next month.`); fileInput.value = ''; return; }
        const song = songInput ? songInput.value.trim() : '';

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = async () => {
            const pos = scatterFor(slot.week, slot.slot, Cal.weeksIn(viewYear, viewMonth));
            UI.toast('Uploading…');
            try {
              const blob = await shrinkToBlob(img);
              const entry = await Store.addEntry({
                year: viewYear, month: viewMonth, week: slot.week,
                caption: note, song, x: pos.x, y: pos.y, w: 150, rot: pos.rot,
              }, blob);
              photos.push(entry);
              render();
            } catch (err) {
              UI.toast('Upload failed: ' + (err && err.message ? err.message : 'try again'));
            }
            if (captionInput) captionInput.value = '';
            if (songInput) songInput.value = '';
            fileInput.value = '';
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    on('monthNoteBtn', 'click', openMonthNote);

    on('diaryBtn', 'click', () => {
      diaryMode = !diaryMode; diaryPage = 0; lastDir = 'next';
      document.body.classList.toggle('diary-on', diaryMode);
      const b = $('diaryBtn'); if (b) b.textContent = diaryMode ? '✏️ Edit' : '📖 Diary';
      render();
    });

    on('downloadBtn', 'click', () => {
      const label = diaryMode && diaryPage > 0 ? `${Cal.MONTHS[diaryPage - 1]} ${viewYear}` : `${Cal.MONTHS[viewMonth]} ${viewYear}`;
      UI.downloadMonth(label);
    });

    on('shareBtn', 'click', openSharePanel);

    on('bellBtn', 'click', async () => {
      if (!('Notification' in window)) { UI.toast('Notifications are not supported here.'); return; }
      const perm = await Notification.requestPermission();
      UI.toast(perm === 'granted' ? "Reminders on — you'll get a nudge at the start of each week." : 'Reminders off — the in-app banner still reminds you.');
    });

    render(); // empty until data loads after login

    if (!Store.hasOnboarded()) {
      UI.showOnboarding(
        { themes: ['coquette', 'matcha', 'butter', 'peach', 'midnight', 'paper'], currentTheme: Store.getTheme(), onTheme: applyTheme },
        (newProfile) => { profile = newProfile; Store.saveProfile(profile); Store.markOnboarded(); render(); }
      );
    }
  }

  // expose load/clear for auth.js
  window.paw_load = load;
  window.paw_clear = clearData;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();