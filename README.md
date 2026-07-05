# 📸 Photo a Week

A little scrapbook for your year — add one photo a week, arrange it on a calendar like a real diary, and flip through the whole thing at the end.

**[▶ Live demo](https://Sriashch.github.io/photo-a-week/)** · built with plain HTML, CSS & JavaScript.

![Photo a Week](screenshot.png)

## What it does

- **A photo (or two) each week**, dropped onto that month's calendar with a short handwritten note.
- **Drag and resize** every frame — arrange the month however you like. It saves as you go.
- **Month notes** float on the board as little clouds.
- **Diary mode** turns the calendar into a book you page through, opening on a "2026" cover.
- **Six themes** — coquette, matcha, butter, peach, midnight, and a clean white — that recolour the whole app.
- **Save any month as an image** to post.
- **A gentle weekly reminder** when you open it and haven't added that week's photo yet.

## How it's built

Vanilla JavaScript, no framework — split into small files by job:

| File | Job |
|------|-----|
| `index.html` | Page structure |
| `css/styles.css` | All styling and themes |
| `js/storage.js` | Reading/writing saved data |
| `js/calendar.js` | Date maths + building the calendar grid |
| `js/ui.js` | Rendering the board, drag/resize, panels |
| `js/app.js` | State and wiring it all together |

Photos are saved in the browser with `localStorage`, so the app needs no backend and deploys as a static site. The tradeoff: your photos live in one browser and don't sync across devices — a real database is the planned next step (see Roadmap).

## Run it locally

No build step. Clone and open the file:

```bash
git clone https://github.com/Sriashch/photo-a-week.git
cd photo-a-week
open index.html      # or just double-click it
```

## Roadmap

- [ ] Backend so photos sync across devices
- [ ] Real reminders that fire even when the app is closed (service worker + push)
- [ ] Draggable stickers
- [ ] End-of-year "wrapped" recap that stitches all 12 months into one image

## Author

Built by **Srishti Bhattacharya** — [GitHub](https://github.com/Sriashch)