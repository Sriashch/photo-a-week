/* auth.js — the login gate with sign-in, sign-up, and password reset.
   Modes: 'signin' | 'signup' | 'recovery'. The form body is rendered per
   mode so sign-up can show a confirm field + strength meter. */

(function () {
  const $ = (id) => document.getElementById(id);
  const scrim = $('authScrim');
  if (!scrim || typeof SB === 'undefined') return;

  let mode = 'signin';

  /* ---------- helpers ---------- */
  const emailValid = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  function scorePassword(p) {
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    s = Math.min(s, 4);
    const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#c0392b', '#e67e22', '#e0b000', '#7a9a4b', '#3a9d5d'];
    return { score: s, label: labels[s], color: colors[s] };
  }

  // turn a Supabase error into friendly wording
  function friendly(err) {
    const m = (err && err.message ? err.message : '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Email or password is incorrect.';
    if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'That email already has an account — log in instead.';
    if (m.includes('password should be')) return 'Password must be at least 6 characters.';
    if (m.includes('unable to validate email') || m.includes('invalid format')) return "That email doesn't look valid.";
    if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts — wait a moment and try again.';
    return err && err.message ? err.message : 'Something went wrong — try again.';
  }

  function setError(msg, kind) {
    const box = $('authError');
    if (!box) return;
    box.textContent = msg || '';
    box.style.display = msg ? 'block' : 'none';
    box.className = 'auth-error' + (kind === 'ok' ? ' ok' : '');
  }

  /* ---------- render the form for the current mode ---------- */
  function paint() {
    setError('');
    const title = $('authTitle'), lead = $('authLead'), form = $('authForm'), toggle = $('authToggle');

    if (mode === 'recovery') {
      title.textContent = 'Set a new password';
      lead.textContent = 'Choose a new password for your account.';
      form.innerHTML = pwField('newPass', 'New password') + strengthHtml() +
        pwField('newPass2', 'Confirm new password') +
        `<button id="authSubmit" class="pill-btn accent big">Save password</button>`;
      toggle.innerHTML = '';
      wireCommon();
      wireStrength('newPass');
      $('authSubmit').onclick = doRecovery;
      return;
    }

    const signup = mode === 'signup';
    title.textContent = signup ? 'Create your diary' : 'Welcome back';
    lead.textContent = signup ? 'One account, all your devices.' : 'Log in to see your diary on any device.';

    form.innerHTML =
      `<input type="email" id="authEmail" class="ob-input" placeholder="Email" autocomplete="email">` +
      pwField('authPassword', 'Password', signup ? 'new-password' : 'current-password') +
      (signup ? strengthHtml() + pwField('authPassword2', 'Confirm password', 'new-password') : '') +
      `<button id="authSubmit" class="pill-btn accent big">${signup ? 'Sign up' : 'Log in'}</button>` +
      (signup ? '' : `<button id="authForgot" class="link-btn auth-forgot">Forgot password?</button>`);

    toggle.innerHTML = signup
      ? `Already have one? <button class="link-btn" id="authSwap">Log in</button>`
      : `New here? <button class="link-btn" id="authSwap">Create an account</button>`;

    wireCommon();
    if (signup) wireStrength('authPassword');
    const swap = $('authSwap');
    if (swap) swap.onclick = () => { mode = signup ? 'signin' : 'signup'; paint(); };
    const forgot = $('authForgot');
    if (forgot) forgot.onclick = doForgot;
    $('authSubmit').onclick = submit;
  }

  // password input with a show/hide eye
  function pwField(id, placeholder, autocomplete) {
    return `<div class="pw-wrap">
      <input type="password" id="${id}" class="ob-input" placeholder="${placeholder}" autocomplete="${autocomplete || 'off'}">
      <button type="button" class="pw-toggle" data-for="${id}" aria-label="Show password">👁</button>
    </div>`;
  }
  function strengthHtml() {
    return `<div class="strength" id="strengthBox" hidden>
      <div class="strength-bar"><div class="strength-fill" id="strengthFill"></div></div>
      <span class="strength-label" id="strengthLabel"></span>
    </div>`;
  }

  function wireCommon() {
    // show/hide password toggles
    document.querySelectorAll('.pw-toggle').forEach(btn => {
      btn.onclick = () => {
        const inp = $(btn.dataset.for);
        if (!inp) return;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.textContent = show ? '🙈' : '👁';
      };
    });
    // Enter submits from any field
    $('authForm').querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = $('authSubmit'); if (b) b.click(); } });
    });
  }

  function wireStrength(pwId) {
    const inp = $(pwId), box = $('strengthBox'), fill = $('strengthFill'), label = $('strengthLabel');
    if (!inp || !box) return;
    inp.addEventListener('input', () => {
      const v = inp.value;
      if (!v) { box.hidden = true; return; }
      box.hidden = false;
      const s = scorePassword(v);
      fill.style.width = (s.score / 4 * 100) + '%';
      fill.style.background = s.color;
      label.textContent = s.label;
      label.style.color = s.color;
    });
  }

  /* ---------- actions ---------- */
  async function submit() {
    const email = ($('authEmail').value || '').trim();
    const password = $('authPassword').value || '';
    const signup = mode === 'signup';

    if (!emailValid(email)) { setError("That doesn't look like a valid email."); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (signup) {
      const p2 = ($('authPassword2') && $('authPassword2').value) || '';
      if (password !== p2) { setError("Passwords don't match."); return; }
    }

    const btn = $('authSubmit');
    btn.disabled = true; btn.textContent = signup ? 'Creating…' : 'Logging in…';
    setError('');
    try {
      if (signup) {
        const { error } = await SB.auth.signUp({ email, password });
        if (error) throw error;
        const { data: { session } } = await SB.auth.getSession();
        if (!session) { mode = 'signin'; paint(); setError('Account created! Check your email to confirm, then log in.', 'ok'); }
      } else {
        const { error } = await SB.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(friendly(err));
    } finally {
      if ($('authSubmit')) { $('authSubmit').disabled = false; $('authSubmit').textContent = signup ? 'Sign up' : 'Log in'; }
    }
  }

  async function doForgot() {
    const email = ($('authEmail') && $('authEmail').value || '').trim();
    if (!emailValid(email)) { setError('Enter your email above first, then tap “Forgot password?”'); return; }
    try {
      const redirectTo = location.href.split('#')[0];
      const { error } = await SB.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setError('Reset link sent — check your email.', 'ok');
    } catch (err) { setError(friendly(err)); }
  }

  async function doRecovery() {
    const p1 = $('newPass').value || '', p2 = $('newPass2').value || '';
    if (p1.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (p1 !== p2) { setError("Passwords don't match."); return; }
    const btn = $('authSubmit'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const { data, error } = await SB.auth.updateUser({ password: p1 });
      if (error) throw error;
      mode = 'signin';
      showApp(data.user);
    } catch (err) {
      setError(friendly(err));
      if ($('authSubmit')) { $('authSubmit').disabled = false; $('authSubmit').textContent = 'Save password'; }
    }
  }

  /* ---------- show/hide app ---------- */
  function showLogin() {
    scrim.hidden = false;
    document.body.classList.add('logged-out');
    const so = $('authSignOut'); if (so) so.hidden = true;
    if (window.paw_clear) window.paw_clear();
    if (mode !== 'recovery') paint();
  }
  function showApp(user) {
    scrim.hidden = true;
    document.body.classList.remove('logged-out');
    const so = $('authSignOut');
    if (so) { so.hidden = false; so.title = user && user.email ? `Signed in as ${user.email}` : 'Sign out'; }
    if (window.paw_load) window.paw_load();
  }

  const signOutBtn = $('authSignOut');
  if (signOutBtn) signOutBtn.addEventListener('click', () => SB.auth.signOut());

  SB.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { mode = 'recovery'; scrim.hidden = false; document.body.classList.add('logged-out'); paint(); return; }
    if (session && session.user) showApp(session.user);
    else showLogin();
  });

  (async () => {
    const { data: { session } } = await SB.auth.getSession();
    if (session && session.user) showApp(session.user);
    else showLogin();
  })();
})();