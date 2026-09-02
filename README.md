# Barracks Manager Automation

A static, no-build website that automates recurring barracks manager tasks.
Built to grow: each task lives in its own self-contained **module**, and new
ones can be added over time without touching existing ones — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Current modules

- **📅 Event Calendar** (`modules/calendar/`) — month-view calendar of
  upcoming inspections, drills, meetings, and other events.
- **🧹 Cleaning Roster** (`modules/roster/`) — a rotating weekday cleaning
  assignment across all rooms on 3 floors. Each floor runs its own
  independent rotation through its own room list, one room per floor per
  weekday (Mon–Fri); also shows the weekly task checklist and standing
  notes from the posted paper roster. Residents can mark their floor's
  duty complete via a linked Google Form (no login required), which shows
  up on the roster and the dashboard as a checkmark and timestamp —
  anonymous by design, room + time only, no names.
- **📖 Barracks SOP** (`modules/sop/`) — the full Barracks Standard
  Operating Procedures, searchable by keyword, with jump-to-section
  results. Generated from `data/sop-content.json`; see that file's
  section in [`data/README.md`](data/README.md) for how to edit it and
  what was reviewed/generalized before publishing.
- **🌱 Area Beautification** (`modules/beautification/`) — every 2 weeks,
  5 rooms are picked for lawn-care/beautification duty, with a one-cycle
  cooldown so nobody's picked twice in a row. The pick is deterministic
  (identical for every visitor, no database needed) and shows both the
  next occurrence and a few cycles of upcoming schedule.

The homepage (`index.html`) shows a quick "today's cleaning duty" / "next
event" summary and links out to every registered module (via
`modules.json`).

## Updating the roster or calendar

Don't hand-edit `modules/roster/rooms.json` or `modules/calendar/events.json`
directly — they're generated automatically. Instead, edit the plain CSV
files in [`data/`](data/README.md) and push/upload the change; a GitHub
Action converts them and publishes the result within about a minute. See
[`data/README.md`](data/README.md) for the exact format and, importantly,
what to review before publishing anything sourced from an official system.

## Duty-completion tracking

`modules/roster/completions.json` is generated on an **hourly schedule**
(`.github/workflows/sync-completions.yml` running `scripts/sync_completions.py`)
by pulling responses from a Google Form linked to a published Google
Sheet — this is a separate pipeline from the CSV sync above, since it
runs on a timer rather than only on a commit. See the
[`completions-config.json` section of `data/README.md`](data/README.md#completions-configjson--letting-residents-mark-their-duty-done)
for the full one-time Google Form/Sheet setup walkthrough; until that's
done, the site simply shows no checkmarks and hides the report button.

## Project structure

```
index.html               Dashboard — module grid + today's summary
modules.json              Registry of modules shown on the dashboard
assets/css/style.css      Shared styling for all pages
assets/js/dashboard.js    Dashboard logic
data/                     Editable CSV/JSON data + the sync pipelines' docs
  roster.csv               Room/floor list
  roster-config.json        Rotation start date
  roster-tasks.csv          Weekly cleaning checklist by weekday
  roster-notes.json         Standing notes shown on the roster page
  completions-config.json   Google Form/Sheet links for duty tracking
  events.csv                Calendar events
  sop-content.json          Full Barracks SOP text, structured for search
  beautification-config.json  Area beautification schedule (anchor date, interval, room count)
scripts/
  build_data.py            Converts data/*.csv,*.json into modules/*/*.json
  sync_completions.py      Pulls Form responses into completions.json
.github/workflows/
  sync-data.yml            Runs build_data.py automatically on push
  sync-completions.yml     Runs sync_completions.py hourly + on push
modules/
  calendar/
    index.html
    calendar.js
    events.json           Generated — don't edit directly
  roster/
    index.html
    roster.js
    roster-logic.js       Shared rotation + completion logic (used by dashboard too)
    rooms.json            Generated — don't edit directly
    tasks.json            Generated — don't edit directly
    notes.json            Generated — don't edit directly
    completions.json      Generated — don't edit directly
  sop/
    index.html
    sop.js                Renders the SOP text and powers the keyword search
    sop.json              Generated — don't edit directly
    assets/               Annex B/D images, committed as-is (not generated)
  beautification/
    index.html
    beautification.js         Renders the module page
    beautification-logic.js   Shared deterministic-draw logic (used by dashboard too)
    config.json                Generated — don't edit directly
```

## Running locally

Because pages fetch their data files with JavaScript, open the site through
a local web server rather than double-clicking `index.html` (the `file://`
protocol blocks those requests in most browsers):

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Deploying with GitHub Pages

1. In this repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to "Deploy from a
   branch", branch `main`, folder `/ (root)`.
3. Save. GitHub will publish the site at
   `https://<your-username>.github.io/barracksmanagers.github.io/`.

   (Note: because this repo isn't named exactly `<your-username>.github.io`,
   it's treated as a project site rather than a root user site — the URL
   will include the repo name. If you'd rather have it at the bare
   `https://<your-username>.github.io/` root, rename the repository to
   match your GitHub username exactly.)

## Adding the next module

See [CONTRIBUTING.md](CONTRIBUTING.md) for the step-by-step pattern —
new folder under `modules/`, its own data/logic files, one entry added to
`modules.json`.
