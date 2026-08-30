# Adding a new module

This site is built so new automation tasks can be bolted on without touching
existing modules. Each module is self-contained folder under `modules/`.

## Steps

1. **Create a folder**: `modules/<your-module-id>/`
2. **Add an `index.html`** in that folder. Copy the structure from
   `modules/roster/index.html` or `modules/calendar/index.html` as a
   starting point — link the shared stylesheet with
   `<link rel="stylesheet" href="../../assets/css/style.css" />` and add a
   `<a href="../../index.html">` link back to the dashboard.
3. **Add any data or logic files your module needs** inside its own folder
   (e.g. a `.json` file for editable data, a `.js` file for behavior). Keep
   them scoped to the module — don't reach into another module's files.
4. **Register the module** by adding an entry to `modules.json` at the repo
   root:

   ```json
   {
     "id": "your-module-id",
     "name": "Human-Readable Name",
     "description": "One sentence describing what it does.",
     "icon": "🔧",
     "path": "modules/your-module-id/index.html"
   }
   ```

   The dashboard (`index.html` + `assets/js/dashboard.js`) reads this file
   and automatically renders a card linking to your module — no other
   changes needed.

## Conventions

- **No build step.** Everything is plain HTML/CSS/JS so it deploys straight
  to GitHub Pages. Keep new modules build-free too.
- **Editable data lives in files, not hardcoded in JS**, so anyone can
  update schedules/rosters/events by editing a file and committing — no code
  changes required for routine updates. Prefer the CSV-in/JSON-out pattern
  used by the roster and calendar modules (`data/*.csv` -> a script in
  `scripts/` -> `modules/<id>/*.json`, wired into
  `.github/workflows/sync-data.yml`) for any module a non-technical person
  will maintain — it keeps updates to "edit a spreadsheet" instead of
  "hand-edit JSON," and gives you a place to validate input and document
  what should (and shouldn't) go in it. See `data/README.md` for the
  existing example. A module whose data rarely changes, or is only ever
  edited by someone comfortable with JSON, can just keep a plain JSON file
  instead — it's the module's own JS reading it, so it does not need to
  match this pattern.
- **Shared look and feel**: use the CSS classes already defined in
  `assets/css/style.css` (`.card`, `.section-title`, `.month-nav`,
  `.calendar-grid`, `.day-cell`, `.event-list`, etc.) rather than
  introducing a new style system per module.
- **Dates as `YYYY-MM-DD` strings**, parsed as UTC, so day-of-week
  calculations don't shift based on the viewer's timezone (see
  `modules/roster/roster-logic.js` for the pattern).

## Local testing

Because pages load data via `fetch()`, opening `index.html` directly from
disk (`file://`) will fail in most browsers due to CORS restrictions on
local files. Run a local server from the repo root instead, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000/`.
