/* calendar.test.js — run with:  node --test
   Tests the pure date logic. No browser, no network, no database. */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const Cal = require('../js/calendar.js');

describe('daysIn', () => {
  test('months have the right lengths', () => {
    assert.equal(Cal.daysIn(2026, 0), 31);   // January
    assert.equal(Cal.daysIn(2026, 3), 30);   // April
    assert.equal(Cal.daysIn(2026, 11), 31);  // December
  });

  test('February in a common year has 28 days', () => {
    assert.equal(Cal.daysIn(2026, 1), 28);
  });

  test('February in a leap year has 29 days', () => {
    assert.equal(Cal.daysIn(2024, 1), 29);
  });

  test('century leap rule: 2000 is a leap year, 1900 is not', () => {
    assert.equal(Cal.daysIn(2000, 1), 29);
    assert.equal(Cal.daysIn(1900, 1), 28);
  });
});

describe('weeksIn — the "months have 4 weeks" assumption is wrong', () => {
  test('a 28-day February starting Sunday needs exactly 4 rows', () => {
    // Feb 2015: starts Sunday, 28 days
    assert.equal(Cal.firstOffset(2015, 1), 0);
    assert.equal(Cal.weeksIn(2015, 1), 4);
  });

  test('July 2026 needs 5 rows', () => {
    assert.equal(Cal.weeksIn(2026, 6), 5);
  });

  test('a 31-day month starting Saturday needs 6 rows', () => {
    // May 2021 starts on a Saturday
    assert.equal(Cal.firstOffset(2021, 4), 6);
    assert.equal(Cal.weeksIn(2021, 4), 6);
  });

  test('never fewer than 4 or more than 6 rows, for every month 2020-2030', () => {
    for (let y = 2020; y <= 2030; y++) {
      for (let m = 0; m < 12; m++) {
        const w = Cal.weeksIn(y, m);
        assert.ok(w >= 4 && w <= 6, `${y}-${m + 1} gave ${w} weeks`);
      }
    }
  });
});

describe('weekOfDate', () => {
  test('the 1st of a month starting on Sunday is week 1', () => {
    assert.equal(Cal.weekOfDate(new Date(2026, 1, 1)), 1); // Feb 1 2026 = Sunday
  });

  test('week number never exceeds the month\'s week count', () => {
    for (let y = 2024; y <= 2027; y++) {
      for (let m = 0; m < 12; m++) {
        const last = new Date(y, m, Cal.daysIn(y, m));
        assert.ok(
          Cal.weekOfDate(last) <= Cal.weeksIn(y, m),
          `${y}-${m + 1}: last day is week ${Cal.weekOfDate(last)} but month has ${Cal.weeksIn(y, m)}`
        );
      }
    }
  });

  test('week number increases through the month', () => {
    const d1 = new Date(2026, 6, 1);
    const d20 = new Date(2026, 6, 20);
    assert.ok(Cal.weekOfDate(d20) > Cal.weekOfDate(d1));
  });
});

describe('buildGrid', () => {
  test('always produces weeks * 7 cells', () => {
    for (let m = 0; m < 12; m++) {
      const { cells, weeks } = Cal.buildGrid(2026, m, null);
      const count = (cells.match(/cal-cell/g) || []).length;
      assert.equal(count, weeks * 7, `month ${m + 1}`);
    }
  });

  test('marks today exactly once when today is in the month', () => {
    const today = new Date(2026, 6, 10);
    const { cells } = Cal.buildGrid(2026, 6, today);
    assert.equal((cells.match(/class="cal-num today"/g) || []).length, 1);
  });

  test('marks nothing when today is in a different month', () => {
    const today = new Date(2026, 6, 10);
    const { cells } = Cal.buildGrid(2026, 5, today);
    assert.equal((cells.match(/today/g) || []).length, 0);
  });

  test('handles a null today without throwing', () => {
    assert.doesNotThrow(() => Cal.buildGrid(2026, 0, null));
  });

  test('January shows December\'s trailing days, not November\'s', () => {
    // Jan 2027 starts Friday -> 5 leading muted cells from Dec (27,28,29,30,31)
    const { cells } = Cal.buildGrid(2027, 0, null);
    assert.ok(cells.includes('>31<'), 'should show Dec 31 as a leading muted day');
  });
});

describe('zodiac', () => {
  test('mid-month signs', () => {
    assert.equal(Cal.zodiac(0, 15).name, 'Capricorn');   // Jan 15
    assert.equal(Cal.zodiac(7, 10).name, 'Leo');         // Aug 10
    assert.equal(Cal.zodiac(4, 5).name, 'Taurus');       // May 5
  });

  test('boundaries: the last day of a sign', () => {
    assert.equal(Cal.zodiac(0, 19).name, 'Capricorn');   // Jan 19
    assert.equal(Cal.zodiac(0, 20).name, 'Aquarius');    // Jan 20
    assert.equal(Cal.zodiac(7, 22).name, 'Leo');         // Aug 22
    assert.equal(Cal.zodiac(7, 23).name, 'Virgo');       // Aug 23
  });

  test('late December wraps back to Capricorn', () => {
    assert.equal(Cal.zodiac(11, 21).name, 'Sagittarius');
    assert.equal(Cal.zodiac(11, 22).name, 'Capricorn');
    assert.equal(Cal.zodiac(11, 31).name, 'Capricorn');
  });

  test('every day of every month returns a sign with an emoji', () => {
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= Cal.daysIn(2026, m); d++) {
        const z = Cal.zodiac(m, d);
        assert.ok(z && z.name && z.emoji, `no sign for month ${m} day ${d}`);
      }
    }
  });
});