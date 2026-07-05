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

    // photos
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
        <span class="resize-handle" title="Resize"></span>`;
      card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); onDeletePhoto(p.id); });
      layer.appendChild(card);
      if (!diaryMode) makeInteractive(card, p, layer, { resizable: true, onChange: onArrange });
    });

    // message clouds
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

    // empty / nudge states (edit mode only)
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

    // diary page-turn controls
    if (diaryMode) {
      board.insertAdjacentHTML('beforeend', `
        <button class="page-arrow left" ${month === 0 ? 'disabled' : ''} aria-label="Previous page">‹</button>
        <button class="page-arrow right" ${month === 11 ? 'disabled' : ''} aria-label="Next page">›</button>
        <div class="page-label">${Cal.MONTHS[month]} · page ${month + 1} of 12</div>`);
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

  /* ---------- onboarding ---------- */
  function showOnboarding(onDone) {
    const scrim = $('onboard');
    if (!scrim) { onDone(); return; }
    scrim.hidden = false;
    $('onboardStart').onclick = () => { scrim.hidden = true; onDone(); };
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

  return { toast, renderBoard, openNotePanel, showOnboarding, downloadMonth };
})();