/* storage.js — data layer.
   Photos (entries) and month notes live in Supabase, behind login and
   row-level security. Theme, profile and small flags stay in the browser
   (they're per-device UI preferences, not shared data).

   Every Supabase call is async, so functions here return Promises. */

const Store = (() => {
  const BUCKET = 'photos';
  const SIGNED_TTL = 8 * 60 * 60; // signed photo URLs valid 8h; we refetch on reload

  /* ---------- local prefs (unchanged) ---------- */
  const KEYS = {
    theme:    'photoAWeekTheme',
    onboard:  'photoAWeekOnboarded',
    notified: 'photoAWeekNotified',
    profile:  'photoAWeekProfile',
  };
  const readLocal = (k, fb) => { try { const r = localStorage.getItem(k); return r === null ? fb : JSON.parse(r); } catch { return fb; } };
  const writeLocal = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  /* ---------- auth helper ---------- */
  async function currentUser() {
    const { data: { user } } = await SB.auth.getUser();
    return user || null;
  }

  /* ---------- photos (entries table + storage bucket) ---------- */

  // map a DB row + signed url into the shape the UI expects
  function rowToPhoto(row, signedUrl) {
    return {
      id: row.id, year: row.year, month: row.month, week: row.week,
      caption: row.caption || '', song: row.song || '',
      image: signedUrl || '', image_path: row.image_path,
      x: row.x, y: row.y, w: row.w, rot: row.rot,
    };
  }

  async function getEntries() {
    const { data: rows, error } = await SB.from('entries').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const paths = rows.map(r => r.image_path).filter(Boolean);
    const urlByPath = {};
    if (paths.length) {
      const { data: signed } = await SB.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
      (signed || []).forEach(s => { if (s && s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl; });
    }
    return rows.map(r => rowToPhoto(r, urlByPath[r.image_path]));
  }

  // data = {year,month,week,caption,song,x,y,w,rot}; blob = the image file
  async function addEntry(data, blob) {
    const user = await currentUser();
    if (!user) throw new Error('Not signed in.');

    const path = `${user.id}/${Date.now()}.jpg`;
    const up = await SB.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (up.error) throw up.error;

    const insert = await SB.from('entries').insert({
      year: data.year, month: data.month, week: data.week,
      caption: data.caption, song: data.song, image_path: path,
      x: data.x, y: data.y, w: data.w, rot: data.rot,
    }).select().single();
    if (insert.error) throw insert.error;

    const { data: signed } = await SB.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
    return rowToPhoto(insert.data, signed ? signed.signedUrl : '');
  }

  async function updateEntry(id, fields) {
    const { error } = await SB.from('entries').update(fields).eq('id', id);
    if (error) throw error;
  }

  async function deleteEntry(id, imagePath) {
    const { error } = await SB.from('entries').delete().eq('id', id);
    if (error) throw error;
    if (imagePath) await SB.storage.from(BUCKET).remove([imagePath]);
  }

  /* ---------- month notes (notes table) ---------- */
  async function getNotes() {
    const { data, error } = await SB.from('notes').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(n => ({ id: n.id, year: n.year, month: n.month, text: n.text, x: n.x, y: n.y, rot: n.rot }));
  }
  async function addNote(data) {
    const insert = await SB.from('notes').insert({
      year: data.year, month: data.month, text: data.text, x: data.x, y: data.y, rot: data.rot,
    }).select().single();
    if (insert.error) throw insert.error;
    const n = insert.data;
    return { id: n.id, year: n.year, month: n.month, text: n.text, x: n.x, y: n.y, rot: n.rot };
  }
  async function updateNote(id, fields) {
    const { error } = await SB.from('notes').update(fields).eq('id', id);
    if (error) throw error;
  }
  async function deleteNote(id) {
    const { error } = await SB.from('notes').delete().eq('id', id);
    if (error) throw error;
  }

  /* ---------- share links ---------- */
  // Build a self-contained snapshot (with long-lived signed photo URLs) and
  // save it as a share row. Returns the token.
  async function createShare({ scope, year, month, ttlDays, viewOnce, ownerName, theme, label, entries, notes }) {
    const paths = entries.map(e => e.image_path).filter(Boolean);
    const ttlSeconds = ttlDays ? ttlDays * 86400 : 30 * 86400; // sign 30d for view-once/no-expiry
    const urlByPath = {};
    if (paths.length) {
      const { data: signed } = await SB.storage.from(BUCKET).createSignedUrls(paths, ttlSeconds);
      (signed || []).forEach(s => { if (s && s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl; });
    }
    const payloadEntries = entries.map(e => ({
      year: e.year, month: e.month, week: e.week, caption: e.caption, song: e.song,
      image: urlByPath[e.image_path] || e.image, x: e.x, y: e.y, w: e.w, rot: e.rot,
    }));
    const payload = {
      scope, year, month: scope === 'month' ? month : null,
      ownerName: ownerName || '', theme: theme || 'coquette',
      entries: payloadEntries, notes,
    };
    const expires_at = ttlDays ? new Date(Date.now() + ttlDays * 86400000).toISOString() : null;
    const { data, error } = await SB.from('shares')
      .insert({ title: label || null, payload, expires_at, view_once: !!viewOnce })
      .select('token').single();
    if (error) throw error;
    return data.token;
  }

  async function getShares() {
    const { data, error } = await SB.from('shares')
      .select('token,title,expires_at,view_once,viewed,created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function revokeShare(token) {
    const { error } = await SB.from('shares').delete().eq('token', token);
    if (error) throw error;
  }

  return {
    currentUser,
    getEntries, addEntry, updateEntry, deleteEntry,
    getNotes, addNote, updateNote, deleteNote,
    createShare, getShares, revokeShare,
    // local prefs
    getTheme()   { return readLocal(KEYS.theme, 'coquette'); },
    setTheme(t)  { writeLocal(KEYS.theme, t); },
    hasOnboarded() { return readLocal(KEYS.onboard, false) === true; },
    markOnboarded() { writeLocal(KEYS.onboard, true); },
    getNotified()  { return readLocal(KEYS.notified, ''); },
    setNotified(k) { writeLocal(KEYS.notified, k); },
    getProfile()   { return readLocal(KEYS.profile, {}); },
    saveProfile(p) { return writeLocal(KEYS.profile, p); },
  };
})();