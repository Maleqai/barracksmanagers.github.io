# Barracks Manager Automation

A static, no-build website that automates recurring barracks manager tasks.
Built to grow: each task lives in its own self-contained **module**, and new
ones can be added over time without touching existing ones — see
[CONTRIBUTING.md](CONTRIBUTING.md).

## Current modules

- **📅 Event Calendar** (`modules/calendar/`) — month-view calendar of
  upcoming inspections, drills, meetings, and other events. Edit
  `modules/calendar/events.json` to add or change events.
- **🧹 Cleaning Roster** (`modules/roster/`) — a rotating weekday cleaning
  assignment across all rooms on 3 floors. One room is on duty per weekday
  (Mon–Fri); the rotation cycles through every room across all floors, then
  repeats. Edit `modules/roster/rooms.json` to change room numbers, floors,
  or the rotation's start date.

The homepage (`index.html`) shows a quick "today's cleaning duty" / "next
event" summary and links out to every registered module (via
`modules.json`).

## Project structure

```
index.html              Dashboard — module grid + today's summary
modules.json             Registry of modules shown on the dashboard
assets/css/style.css     Shared styling for all pages
assets/js/dashboard.js   Dashboard logic
modules/
  calendar/
    index.html
    calendar.js
    events.json          Editable event data
  roster/
    index.html
    roster.js
    roster-logic.js       Shared rotation logic (used by dashboard too)
    rooms.json            Editable room/floor data
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
