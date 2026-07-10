/* validation.test.js — tests the upload guard rules.
   These mirror validateFile() in app.js. Keeping them in one place means the
   rules are checkable without a browser. */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { validateFile, MAX_FILE_BYTES } = require('../js/validate.js');

const fake = (name, type, size) => ({ name, type, size });

describe('validateFile — size', () => {
  test('accepts a normal photo', () => {
    assert.equal(validateFile(fake('a.jpg', 'image/jpeg', 2_000_000)), null);
  });

  test('accepts a file exactly at the limit', () => {
    assert.equal(validateFile(fake('a.jpg', 'image/jpeg', MAX_FILE_BYTES)), null);
  });

  test('rejects one byte over the limit', () => {
    const msg = validateFile(fake('a.jpg', 'image/jpeg', MAX_FILE_BYTES + 1));
    assert.match(msg, /under 15MB/);
  });

  test('the size message tells the user the actual size', () => {
    const msg = validateFile(fake('a.jpg', 'image/jpeg', 20 * 1048576));
    assert.match(msg, /20\.0MB/);
  });
});

describe('validateFile — type', () => {
  test('accepts jpeg, png, webp, gif', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      assert.equal(validateFile(fake('a', t, 100)), null, t);
    }
  });

  test('rejects a PDF', () => {
    assert.match(validateFile(fake('cv.pdf', 'application/pdf', 100)), /JPG, PNG/);
  });

  test('rejects a video', () => {
    assert.match(validateFile(fake('clip.mp4', 'video/mp4', 100)), /JPG, PNG/);
  });
});

describe('validateFile — HEIC gets its own message', () => {
  test('detects HEIC by mime type', () => {
    const msg = validateFile(fake('IMG_1234.HEIC', 'image/heic', 100));
    assert.match(msg, /iPhone/);
    assert.match(msg, /Most Compatible/);
  });

  test('detects HEIC by extension even when the browser reports no type', () => {
    const msg = validateFile(fake('IMG_1234.heic', '', 100));
    assert.match(msg, /iPhone/);
  });

  test('detects HEIF', () => {
    assert.match(validateFile(fake('x.heif', 'image/heif', 100)), /iPhone/);
  });
});

describe('validateFile — order of checks', () => {
  test('size is checked before type (a huge PDF complains about size)', () => {
    const msg = validateFile(fake('big.pdf', 'application/pdf', 50 * 1048576));
    assert.match(msg, /under 15MB/);
  });
});