/* app.js — owns the view state and wires the DOM to Store + UI + Cal.
   Everything is bound after DOMContentLoaded, and each binding checks the
   element exists first, so a missing element can never halt the whole app. */

(function () {
  const $ = (id) => document.getElementById(id);
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };

  const PHOTOS_PER_WEEK = 2;
  const today = new Date();

  // ----- state -----
  let photos = Store.getPhotos();
  let messages = Store.getMessages();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let diaryMode = false;
  let lastDir = 'next';

  // ----- one-time migration of older photo shapes -----
  (function migrate() {
    let dirty = false;
    photos.forEach(p => {
      if (p.x == null && p.year != null) {
        const s = scatterFor(p.week || 1, 1, Cal.weeksIn(p.year, p.month));
        p.x = s.x; p.y = s.y; p.rot = s.rot; dirty = true;
      }
      if (p.w == null) { p.w = 150; dirty = true; }
    });
    if (dirty) Store.savePhotos(photos);
  })();

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
    document.querySelectorAll('.swatch').forEach(s =>
      s.classList.toggle('active', s.dataset.theme === t));
  }

  // ----- image shrink -----
  function shrinkImage(img) {
    const max = 640;
    let { width, height } = img;
    if (width > height && width > max) { height *= max / width; width = max; }
    else if (height > max) { width *= max / height; height = max; }
    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    c.getContext('2d').drawImage(img, 0, 0, width, height);
    return c.toDataURL('image/jpeg', 0.78);
  }

  // ----- data callbacks passed to UI -----
  function persistArrangement() { Store.savePhotos(photos); Store.saveMessages(messages); }
  function deletePhoto(id)   { photos = photos.filter(p => p.id !== id); Store.savePhotos(photos); render(); }
  function deleteMessage(id) { messages = messages.filter(m => m.id !== id); Store.saveMessages(messages); render(); }

  function openMonthNote() {
    UI.openNotePanel(`${Cal.MONTHS[viewMonth]} ${viewYear}`, (text) => {
      messages.push({
        id: Date.now(), year: viewYear, month: viewMonth, text,
        x: 24 + Math.random() * 34, y: 4 + Math.random() * 9, rot: Math.random() * 8 - 4,
      });
      Store.saveMessages(messages);
      render();
    });
  }

  // ----- render -----
  function render() {
    const monthSelect = $('monthSelect');
    if (monthSelect) monthSelect.value = viewMonth;

    const { weeks, count } = UI.renderBoard({
      year: viewYear, month: viewMonth, diaryMode, lastDir, photos, messages,
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
      on('nextMonthBtn', 'click', () => { turnPage(1); });
    } else {
      box.innerHTML = `<span class="count">${count} of ${total} photos this month</span>`;
    }
  }

  // ----- navigation -----
  function turnPage(delta) {
    const m = viewMonth + delta;
    if (m < 0 || m > 11) return;
    lastDir = delta > 0 ? 'next' : 'prev';
    viewMonth = m;
    render();
  }

  // ----- reminder (fires while the app is open) -----
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
      on('jumpBtn', 'click', () => {
        viewMonth = today.getMonth();
        render();
        const ci = $('captionInput'); if (ci) ci.focus();
      });
    } else {
      box.style.display = 'none';
    }
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

  // ----- wire everything up -----
  function init() {
    // month dropdown
    const monthSelect = $('monthSelect');
    if (monthSelect) {
      monthSelect.innerHTML = Cal.MONTHS
        .map((name, m) => `<option value="${m}">${name} ${viewYear}</option>`).join('');
      monthSelect.value = viewMonth;
      monthSelect.addEventListener('change', () => { lastDir = 'next'; viewMonth = +monthSelect.value; render(); });
    }

    on('prevMonth', 'click', () => turnPage(-1));
    on('nextMonth', 'click', () => turnPage(1));

    // theme swatches
    document.querySelectorAll('.swatch').forEach(s =>
      s.addEventListener('click', () => applyTheme(s.dataset.theme)));
    applyTheme(Store.getTheme());

    // add photo
    const fileInput = $('fileInput');
    const captionInput = $('captionInput');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        const note = captionInput ? captionInput.value.trim() : '';
        if (!note) { UI.toast('Write a note for this week first.'); if (captionInput) captionInput.focus(); fileInput.value = ''; return; }
        const slot = nextFreeSlot(viewYear, viewMonth);
        if (!slot) { UI.toast(`${Cal.MONTHS[viewMonth]} is full — move to the next month.`); fileInput.value = ''; return; }

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const pos = scatterFor(slot.week, slot.slot, Cal.weeksIn(viewYear, viewMonth));
            photos.push({
              id: Date.now(), year: viewYear, month: viewMonth, week: slot.week,
              caption: note, image: shrinkImage(img),
              x: pos.x, y: pos.y, w: 150, rot: pos.rot,
            });
            if (!Store.savePhotos(photos)) UI.toast('Storage is full — delete an older photo.');
            if (captionInput) captionInput.value = '';
            fileInput.value = '';
            render();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    on('monthNoteBtn', 'click', openMonthNote);

    // diary toggle
    on('diaryBtn', 'click', () => {
      diaryMode = !diaryMode;
      document.body.classList.toggle('diary-on', diaryMode);
      const b = $('diaryBtn');
      if (b) b.textContent = diaryMode ? '✏️ Edit' : '📖 Diary';
      render();
    });

    // download month image
    on('downloadBtn', 'click', () => UI.downloadMonth(`${Cal.MONTHS[viewMonth]} ${viewYear}`));

    // reminders permission
    on('bellBtn', 'click', async () => {
      if (!('Notification' in window)) { UI.toast('Notifications are not supported here.'); return; }
      const perm = await Notification.requestPermission();
      UI.toast(perm === 'granted'
        ? "Reminders on — you'll get a nudge at the start of each week."
        : 'Reminders off — the in-app banner still reminds you.');
    });

    // first render
    render();
    maybeNotify();

    // onboarding (after first paint so the board is visible behind it)
    if (!Store.hasOnboarded()) {
      UI.showOnboarding(() => Store.markOnboarded());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();