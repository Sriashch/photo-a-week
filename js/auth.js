/* auth.js — the login gate.
   Shows a sign-in / sign-up screen until the user is authenticated, then
   reveals the app. Runs on top of the existing app, which loads underneath. */

(function () {
  const $ = (id) => document.getElementById(id);
  const scrim = $('authScrim');
  if (!scrim || typeof SB === 'undefined') return;

  let mode = 'signin'; // 'signin' | 'signup'

  function setError(msg) {
    const box = $('authError');
    if (box) { box.textContent = msg || ''; box.style.display = msg ? 'block' : 'none'; }
  }

  function paint() {
    setError('');
    $('authTitle').textContent = mode === 'signin' ? 'Welcome back' : 'Create your diary';
    $('authSubmit').textContent = mode === 'signin' ? 'Log in' : 'Sign up';
    $('authToggle').innerHTML = mode === 'signin'
      ? `New here? <button class="link-btn" id="authSwap">Create an account</button>`
      : `Already have one? <button class="link-btn" id="authSwap">Log in</button>`;
    const swap = $('authSwap');
    if (swap) swap.onclick = () => { mode = (mode === 'signin' ? 'signup' : 'signin'); paint(); };
  }

  function showLogin() {
    scrim.hidden = false;
    document.body.classList.add('logged-out');
    const so = $('authSignOut'); if (so) so.hidden = true;
    if (window.paw_clear) window.paw_clear();
    paint();
  }

  function showApp(user) {
    scrim.hidden = true;
    document.body.classList.remove('logged-out');
    const so = $('authSignOut');
    if (so) { so.hidden = false; so.title = user && user.email ? `Signed in as ${user.email}` : 'Sign out'; }
    if (window.paw_load) window.paw_load();   // fetch this user's photos + notes
  }

  async function submit() {
    const email = ($('authEmail').value || '').trim();
    const password = $('authPassword').value || '';
    if (!email || !password) { setError('Enter your email and password.'); return; }
    if (password.length < 6) { setError('Password needs at least 6 characters.'); return; }

    $('authSubmit').disabled = true;
    setError('');
    try {
      if (mode === 'signup') {
        const { error } = await SB.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        const { data: { session } } = await SB.auth.getSession();
        if (!session) { setError('Check your email to confirm your account, then log in.'); mode = 'signin'; paint(); }
      } else {
        const { error } = await SB.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err && err.message ? err.message : 'Something went wrong — try again.');
    } finally {
      $('authSubmit').disabled = false;
    }
  }

  // wire the static controls
  $('authSubmit').addEventListener('click', submit);
  $('authPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const signOutBtn = $('authSignOut');
  if (signOutBtn) signOutBtn.addEventListener('click', () => SB.auth.signOut());

  // react to auth changes (login, logout, token refresh)
  SB.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) showApp(session.user);
    else showLogin();
  });

  // initial check on load
  (async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (session && session.user) showApp(session.user);
    else showLogin();
  })();
})();