/* storage.js — everything that touches localStorage lives here.
   Keeping the data layer in one file means a real backend can replace
   just this file later, without rewriting the UI. */

const Store = (() => {
  const KEYS = {
    photos:   'photoAWeek',
    messages: 'photoAWeekMsgs',
    theme:    'photoAWeekTheme',
    onboard:  'photoAWeekOnboarded',
    notified: 'photoAWeekNotified',
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false; // quota exceeded, etc.
    }
  }

  return {
    // photos
    getPhotos()      { return read(KEYS.photos, []); },
    savePhotos(list) { return write(KEYS.photos, list); },

    // month messages
    getMessages()      { return read(KEYS.messages, []); },
    saveMessages(list) { return write(KEYS.messages, list); },

    // theme
    getTheme()   { return read(KEYS.theme, 'coquette'); },
    setTheme(t)  { write(KEYS.theme, t); },

    // onboarding
    hasOnboarded() { return read(KEYS.onboard, false) === true; },
    markOnboarded() { write(KEYS.onboard, true); },

    // last-notified week key (so we only nudge once per week)
    getNotified()   { return read(KEYS.notified, ''); },
    setNotified(k)  { write(KEYS.notified, k); },
  };
})();