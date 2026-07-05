/* ui.js — all DOM rendering and interaction. Reads a context object from
   app.js (data + callbacks) so this file never touches storage directly. */

const UI = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; }, 250);
    }, 2600);
  }

  /* ---------- confirm dialog ---------- */
  function confirmDialog({ title, text, okLabel }, onYes) {
    const scrim = $('confirmPanel');
    if (!scrim) { if (confirm(text || 'Are you sure?')) onYes(); return; }
    $('confirmTitle').textContent = title || 'Remove this?';
    $('confirmText').textContent = text || "This can't be undone.";
    $('confirmOk').textContent = okLabel || 'Remove';
    scrim.hidden = false;

    const close = () => {
      scrim.hidden = true;
      $('confirmOk').onclick = null;
      $('confirmCancel').onclick = null;
      scrim.onclick = null;
    };
    $('confirmCancel').onclick = close;
    scrim.onclick = (e) => { if (e.target === scrim) close(); };
    $('confirmOk').onclick = () => { close(); onYes(); };
  }

  /* ---------- drag + resize ---------- */
  function makeInteractive(card, item, layer, { resizable, onChange }) {
    card.style.touchAction = 'none';

    card.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.delete-btn') || e.target.closest('.resize-handle')) return;
      e.preventDefault();
      const rect = layer.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      const sl = (item.x / 100) * rect.width;
      const st = (item.y / 100) * rect.height;
      card.setPointerCapture(e.pointerId);
      card.classList.add('dragging');

      const move = (ev) => {
        let nx = Math.max(-20, Math.min(sl + ev.clientX - sx, rect.width - 40));
        let ny = Math.max(-20, Math.min(st + ev.clientY - sy, rect.height - 40));
        item.x = (nx / rect.width) * 100;
        item.y = (ny / rect.height) * 100;
        card.style.left = item.x + '%';
        card.style.top  = item.y + '%';
      };
      const up = () => {
        card.classList.remove('dragging');
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerup', up);
        onChange();
      };
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerup', up);
    });

    if (resizable) {
      const handle = card.querySelector('.resize-handle');
      if (handle) {
        handle.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          const sx = e.clientX, sw = item.w;
          handle.setPointerCapture(e.pointerId);
          const move = (ev) => {
            item.w = Math.max(90, Math.min(320, sw + ev.clientX - sx));
            card.style.width = item.w + 'px';
          };
          const up = () => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', up);
            onChange();
          };
          handle.addEventListener('pointermove', move);
          handle.addEventListener('pointerup', up);
        });
      }
    }
  }

  /* ---------- diary cover page ---------- */
  function renderCover(ctx) {
    const gallery = $('gallery');
    gallery.innerHTML = '';
    const { year, photos, profile, onNavigate } = ctx;

    const board = document.createElement('section');
    board.className = 'board book cover flip-next';

    const peekPhotos = photos
      .filter(p => p.year === year)
      .sort((a, b) => b.id - a.id)
      .slice(0, 4);
    const peeks = peekPhotos.map((p, i) =>
      `<img class="peek peek${i}" src="${p.image}" alt="">`).join('');

    const name = profile && profile.name ? profile.name : '';
    const zod = profile && profile.zodiac ? ` · ${profile.zodiac.emoji} ${profile.zodiac.name}` : '';
    const subline = (name ? `${name}'s year` : 'my year') + zod;

    board.innerHTML = `
      <div class="capture-target cover-inner">
        <div class="cover-card">
          <div class="cover-peeks">${peeks}</div>
          <img class="cover-art" src="assets/cover.png" alt="2026 recap">
          <div class="cover-sub">${esc(subline)}</div>
        </div>
      </div>
      <button class="page-arrow left" disabled aria-label="Previous">‹</button>
      <button class="page-arrow right" aria-label="Begin">›</button>
      <div class="page-label">cover · tap › to begin</div>`;
    gallery.appendChild(board);

    const r = board.querySelector('.page-arrow.right');
    if (r) r.addEventListener('click', () => onNavigate(1));
  }

  /* ---------- render the month board ---------- */
  function renderBoard(ctx) {
    const gallery = $('gallery');
    gallery.innerHTML = '';

    const { year, month, diaryMode, lastDir, photos, messages,
            onDeletePhoto, onDeleteMessage, onArrange, onAddMessage, onNavigate } = ctx;

    const { head, cells, weeks } = Cal.buildGrid(year, month, new Date());

    const board = document.createElement('section');
    board.className = 'board' + (diaryMode ? ' book' : '');
    if (diaryMode) board.classList.add(lastDir === 'prev' ? 'flip-prev' : 'flip-next');

    board.innerHTML = `
      <div class="capture-target">
        <div class="cal-header"><span class="cal-month">${Cal.MONTHS[month]}</span> <span class="cal-year">${year}</span></div>
        <div class="cal-weekdays">${head}</div>
        <div class="cal-body" style="min-height:${weeks * 100}px">
          <div class="cal-grid" style="grid-template-rows:repeat(${weeks},1fr)">${cells}</div>
          <div class="scatter"></div>
        </div>
      </div>`;
    gallery.appendChild(board);

    const layer = board.querySelector('.scatter');

    const monthPhotos = photos
      .filter(p => p.year === year && p.month === month)
      .sort((a, b) => a.week - b.week);

    monthPhotos.forEach(p => {
      const card = document.createElement('div');
      card.className = 'polaroid';
      card.style.left = p.x + '%';
      card.style.top = p.y + '%';
      card.style.width = p.w + 'px';
      card.style.setProperty('--rot', (p.rot || 0) + 'deg');
      card.innerHTML = `
        <button class="delete-btn" title="Remove">✕</button>
        <span class="week-tag">Week ${p.week}</span>
        <img src="${p.image}" alt="Week ${p.week}" draggable="false">
        <p class="note">${esc(p.caption)}</p>
        ${p.song ? `<p class="song">♫ ${esc(p.song)}</p>` : ''}
        <span class="resize-handle" title="Resize"></span>`;
      card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); onDeletePhoto(p.id); });
      layer.appendChild(card);
      if (!diaryMode) makeInteractive(card, p, layer, { resizable: true, onChange: onArrange });
    });

    const monthMsgs = messages.filter(m => m.year === year && m.month === month);
    monthMsgs.forEach(m => {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      cloud.style.left = m.x + '%';
      cloud.style.top = m.y + '%';
      cloud.style.setProperty('--rot', (m.rot || 0) + 'deg');
      cloud.innerHTML = `<button class="delete-btn" title="Remove">✕</button><p>${esc(m.text)}</p>`;
      cloud.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); onDeleteMessage(m.id); });
      layer.appendChild(cloud);
      if (!diaryMode) makeInteractive(cloud, m, layer, { resizable: false, onChange: onArrange });
    });

    if (!diaryMode && monthPhotos.length === 0) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = `Add your first photo for ${Cal.MONTHS[month]}. Drag frames to arrange them.`;
      layer.appendChild(hint);
    }
    if (!diaryMode && monthMsgs.length === 0) {
      const nudge = document.createElement('div');
      nudge.className = 'cloud nudge';
      nudge.style.left = '36%';
      nudge.style.top = '3%';
      nudge.innerHTML = `<p>＋ note for this month</p>`;
      nudge.addEventListener('click', onAddMessage);
      layer.appendChild(nudge);
    }

    if (diaryMode) {
      board.insertAdjacentHTML('beforeend', `
        <button class="page-arrow left" aria-label="Previous page">‹</button>
        <button class="page-arrow right" ${month === 11 ? 'disabled' : ''} aria-label="Next page">›</button>
        <div class="page-label">${Cal.MONTHS[month]} · page ${month + 2} of 13</div>`);
      const l = board.querySelector('.page-arrow.left');
      const r = board.querySelector('.page-arrow.right');
      if (l) l.addEventListener('click', () => onNavigate(-1));
      if (r) r.addEventListener('click', () => onNavigate(1));
    }

    return { weeks, count: monthPhotos.length };
  }

  /* ---------- month-note panel ---------- */
  function openNotePanel(monthLabel, onSave) {
    const scrim = $('notePanel');
    const title = $('notePanelTitle');
    const text = $('noteText');
    if (!scrim) return;
    title.textContent = `A note for ${monthLabel}`;
    text.value = '';
    scrim.hidden = false;
    setTimeout(() => text.focus(), 50);

    const close = () => {
      scrim.hidden = true;
      $('noteSave').onclick = null;
      $('noteCancel').onclick = null;
      scrim.onclick = null;
    };
    $('noteCancel').onclick = close;
    scrim.onclick = (e) => { if (e.target === scrim) close(); };
    $('noteSave').onclick = () => {
      const v = text.value.trim();
      if (!v) { text.focus(); return; }
      onSave(v);
      close();
    };
  }

  /* ---------- onboarding (name → theme → birthday) ---------- */
  function showOnboarding({ themes, currentTheme, onTheme }, onDone) {
    const scrim = $('onboard');
    const card = $('onboardCard');
    if (!scrim || !card) { onDone({}); return; }

    const draft = { name: '', birthday: '' };
    let step = 0;
    scrim.hidden = false;

    const dots = () => `<div class="ob-dots">${[0,1,2].map(i =>
      `<span class="${i === step ? 'on' : ''}"></span>`).join('')}</div>`;

    function zodiacLine() {
      if (!draft.birthday) return '';
      const d = new Date(draft.birthday);
      if (isNaN(d)) return '';
      const z = Cal.zodiac(d.getMonth(), d.getDate());
      return `<div class="ob-zodiac">${z.emoji} You're a ${z.name}</div>`;
    }

    function paint() {
      if (step === 0) {
        card.innerHTML = `
          <div class="onboard-mark">✦</div>
          <h2>Let's set up your diary.</h2>
          <p class="onboard-lead">First — what should we call you?</p>
          <input type="text" id="obName" class="ob-input" maxlength="24" placeholder="Your name" value="${draft.name}">
          <button id="obNext" class="pill-btn accent big">Next →</button>
          ${dots()}`;
        const input = $('obName');
        setTimeout(() => input && input.focus(), 50);
        input.addEventListener('input', () => { draft.name = input.value.trim(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
        $('obNext').onclick = next;
      } else if (step === 1) {
        card.innerHTML = `
          <div class="onboard-mark">✦</div>
          <h2>${draft.name ? draft.name + ', pick' : 'Pick'} your vibe.</h2>
          <p class="onboard-lead">This colours your whole diary. You can change it anytime.</p>
          <div class="ob-themes">${themes.map(t =>
            `<button class="ob-swatch ${t === currentTheme ? 'active' : ''}" data-t="${t}" title="${t}"
                     style="background:${swatchColor(t)}"></button>`).join('')}</div>
          <div class="ob-nav">
            <button id="obBack" class="pill-btn subtle">Back</button>
            <button id="obNext" class="pill-btn accent">Next →</button>
          </div>
          ${dots()}`;
        card.querySelectorAll('.ob-swatch').forEach(b =>
          b.addEventListener('click', () => {
            currentTheme = b.dataset.t;
            onTheme(currentTheme);
            card.querySelectorAll('.ob-swatch').forEach(x => x.classList.toggle('active', x === b));
          }));
        $('obBack').onclick = back;
        $('obNext').onclick = next;
      } else {
        card.innerHTML = `
          <div class="onboard-mark">✦</div>
          <h2>When's your birthday?</h2>
          <p class="onboard-lead">Optional — we'll add your zodiac to the cover. That's the only reason we ask.</p>
          <input type="date" id="obDob" class="ob-input" value="${draft.birthday}">
          <div id="obZodiac">${zodiacLine()}</div>
          <div class="ob-nav">
            <button id="obBack" class="pill-btn subtle">Back</button>
            <button id="obFinish" class="pill-btn accent">Start my diary →</button>
          </div>
          ${dots()}`;
        const dob = $('obDob');
        dob.addEventListener('change', () => {
          draft.birthday = dob.value;
          $('obZodiac').innerHTML = zodiacLine();
        });
        $('obBack').onclick = back;
        $('obFinish').onclick = finish;
      }
    }

    function next() { if (step < 2) { step++; paint(); } }
    function back() { if (step > 0) { step--; paint(); } }
    function finish() {
      const profile = { name: draft.name, birthday: draft.birthday };
      if (draft.birthday) {
        const d = new Date(draft.birthday);
        if (!isNaN(d)) profile.zodiac = Cal.zodiac(d.getMonth(), d.getDate());
      }
      scrim.hidden = true;
      onDone(profile);
    }

    paint();
  }

  // colour for a theme swatch (mirrors the CSS swatch colours)
  function swatchColor(t) {
    return {
      coquette: '#d98aa0', matcha: '#8a9a5b', butter: '#d8ab3f',
      peach: '#e0895f', midnight: '#26232f', paper: '#ffffff',
    }[t] || '#d98aa0';
  }

  /* ---------- save month as image ---------- */
  async function downloadMonth(monthLabel) {
    const target = document.querySelector('.capture-target');
    if (!target || typeof html2canvas === 'undefined') {
      toast("Couldn't save the image — check your connection.");
      return;
    }
    toast('Saving your month…');
    document.body.dataset.capturing = 'true';
    const bg = getComputedStyle(document.body).getPropertyValue('--board').trim() || '#ffffff';
    try {
      const canvas = await html2canvas(target, { backgroundColor: bg, scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `${monthLabel.replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('Saved! Check your downloads.');
    } catch {
      toast("Couldn't save the image this time.");
    } finally {
      delete document.body.dataset.capturing;
    }
  }

  return { toast, confirmDialog, renderBoard, renderCover, openNotePanel, showOnboarding, downloadMonth };
})();