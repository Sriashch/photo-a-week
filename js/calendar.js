/* calendar.js — pure date maths + grid building. No DOM state, no storage.
   This is the piece that correctly handles months with 4, 5 or 6 week-rows. */

const Cal = (() => {
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const firstOffset = (y, m) => new Date(y, m, 1).getDay();      // 0 Sun … 6 Sat
  const daysIn      = (y, m) => new Date(y, m + 1, 0).getDate();
  const weeksIn     = (y, m) => Math.ceil((firstOffset(y, m) + daysIn(y, m)) / 7);
  const weekOfDate  = (d)    => Math.ceil((d.getDate() + firstOffset(d.getFullYear(), d.getMonth())) / 7);

  // Build the calendar grid HTML for a month, marking today's cell.
  function buildGrid(y, m, todayDate) {
    const off = firstOffset(y, m);
    const dim = daysIn(y, m);
    const weeks = weeksIn(y, m);
    const prevDim = daysIn(y, (m - 1 + 12) % 12);

    const head = DOWS.map(d => `<div class="cal-dow">${d}</div>`).join('');

    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const dayNum = i - off + 1;
      if (dayNum < 1) {
        cells += `<div class="cal-cell muted"><span class="cal-num">${prevDim + dayNum}</span></div>`;
      } else if (dayNum > dim) {
        cells += `<div class="cal-cell muted"><span class="cal-num">${dayNum - dim}</span></div>`;
      } else {
        const isToday = todayDate &&
          y === todayDate.getFullYear() &&
          m === todayDate.getMonth() &&
          dayNum === todayDate.getDate();
        cells += `<div class="cal-cell"><span class="cal-num ${isToday ? 'today' : ''}">${dayNum}</span></div>`;
      }
    }
    return { head, cells, weeks };
  }

  return { MONTHS, DOWS, firstOffset, daysIn, weeksIn, weekOfDate, buildGrid };
})();