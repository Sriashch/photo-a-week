/* share.js — the read-only viewer. Reads ?s=TOKEN, redeems it through the
   database function (which enforces expiry / view-once), and renders the
   snapshot. No login, no editing — it only ever sees what the link contains. */

(function () {
  const root = document.getElementById('shareRoot');
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; };

  function message(title, sub) {
    root.innerHTML = `<div class="share-card">
      <div class="share-mark">✦</div>
      <h2>${esc(title)}</h2>
      ${sub ? `<p>${esc(sub)}</p>` : ''}
      <a class="pill-btn accent big" href="./">Make your own →</a>
    </div>`;
  }

  function boardHtml(year, month, entries, notes) {
    const { head, cells, weeks } = Cal.buildGrid(year, month, null);
    const polas = entries.map(p => `
      <div class="polaroid" style="left:${p.x}%;top:${p.y}%;width:${p.w}px;--rot:${p.rot || 0}deg">
        <span class="week-tag">Week ${p.week}</span>
        <img src="${p.image}" alt="Week ${p.week}">
        <p class="note">${esc(p.caption)}</p>
        ${p.song ? `<p class="song">♫ ${esc(p.song)}</p>` : ''}
      </div>`).join('');
    const clouds = notes.map(m => `
      <div class="cloud" style="left:${m.x}%;top:${m.y}%;--rot:${m.rot || 0}deg"><p>${esc(m.text)}</p></div>`).join('');
    return `<section class="board">
      <div class="cal-header"><span class="cal-month">${Cal.MONTHS[month]}</span> <span class="cal-year">${year}</span></div>
      <div class="cal-weekdays">${head}</div>
      <div class="cal-body" style="min-height:${weeks * 100}px">
        <div class="cal-grid" style="grid-template-rows:repeat(${weeks},1fr)">${cells}</div>
        <div class="scatter">${polas}${clouds}</div>
      </div>
    </section>`;
  }

  function render(title, payload) {
    if (payload.theme) document.body.dataset.theme = payload.theme;
    const entries = payload.entries || [];
    const notes = payload.notes || [];

    // which months to show
    let months;
    if (payload.scope === 'month' && payload.month != null) {
      months = [payload.month];
    } else {
      months = [...new Set(entries.map(e => e.month).concat(notes.map(n => n.month)))].sort((a, b) => a - b);
      if (months.length === 0) months = [payload.month != null ? payload.month : 0];
    }

    const who = payload.ownerName ? `${payload.ownerName}'s` : 'A';
    const scopeLabel = payload.scope === 'year' ? `${payload.year}` : `${Cal.MONTHS[months[0]]} ${payload.year}`;

    const boards = months.map(m => boardHtml(payload.year, m, entries.filter(e => e.month === m), notes.filter(n => n.month === m))).join('');

    root.innerHTML = `
      <header class="share-header">
        <div class="brand"><span class="brand-mark">✦</span><span class="brand-name">${esc(who)} ${esc(scopeLabel)}</span></div>
        <p class="share-note">Shared from Photo a Week · view only</p>
      </header>
      <main class="gallery">${boards}</main>
      <footer class="share-foot"><a class="pill-btn accent" href="./">Make your own diary →</a></footer>`;
  }

  (async function init() {
    if (typeof SB === 'undefined') { message("Couldn't load", 'Please try again in a moment.'); return; }
    const token = new URLSearchParams(location.search).get('s');
    if (!token) { message('Link is incomplete', 'This share link is missing its code.'); return; }

    let data;
    try {
      const res = await SB.rpc('redeem_share', { share_token: token });
      if (res.error) throw res.error;
      data = res.data;
    } catch {
      message("Couldn't open this link", 'Something went wrong — please try again.');
      return;
    }

    if (!data || data.error) {
      const map = {
        not_found: ['Link not found', "This link is invalid or has been revoked."],
        expired:   ['Link expired', "This share link is no longer active."],
        used:      ['Already viewed', "This was a one-time link and has already been opened."],
      };
      const [t, s] = map[data && data.error] || ['Can’t open this link', 'Please ask for a new one.'];
      message(t, s);
      return;
    }

    render(data.title, data.payload);
  })();
})();