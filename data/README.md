# Updating the site's data

This folder is the only thing you should have to edit to update the
cleaning roster or the event calendar. Everything in `modules/*/*.json`
is now **generated automatically** from these files by
`scripts/build_data.py` (run by `.github/workflows/sync-data.yml` on
every push) -- don't hand-edit the JSON anymore, it'll just get
overwritten the next time this runs.

## Before you fill these in: a review step, not a data dump

These files are what the public site publishes. Before putting anything
here that came out of a GovCloud export or other official system, strip
it down to just what's meant for public release:

- **Roster**: room numbers only. Don't include resident names -- keep
  the name-to-room mapping in whatever internal system you already use
  for that, and only publish which room is on duty, not who lives there.
- **Calendar**: keep event titles and descriptions generic enough for a
  public, unauthenticated website (no unit movement specifics, no
  information your OPSEC/security office wouldn't want posted publicly).

If you're not sure whether something is fine to post here, ask your
S6/security office first -- it's much easier to leave something out now
than to walk it back once it's been on a public page.

## `roster.csv`

Two columns: `room`, `floor`. One row per room. Rooms are grouped by
floor in the order they first appear. **Each floor runs its own
independent rotation** through its own room list -- so on any given
weekday, every floor has one room on duty at the same time (e.g. Floor 1
room 101, Floor 2 room 201, and Floor 3 room 301 might all be on duty
the same Monday). It's not one shared room across the whole building.

```csv
room,floor
101,Floor 1
102,Floor 1
201,Floor 2
```

To add a room, add a row. To remove one, delete its row (e.g. a room
that's a supply closet, not living space -- the current list skips
X08 on every floor for exactly that reason). To reorder a floor's
rotation, reorder that floor's rows.

## `roster-config.json`

Just one setting: `rotationStart`, a `YYYY-MM-DD` date that should fall
on a Monday. Every floor's rotation is counted from this same date,
independently -- on `rotationStart` itself, each floor is on the first
room in its list. This is kept separate from the CSV because it's a
policy choice (when did/does the rotation start), not room data.

## `roster-tasks.csv`

Two columns: `weekday` (one of `Monday` through `Friday`) and `task`.
One row per checklist item -- the same weekly cleaning checklist applies
to every floor, so this isn't per-room. Add or remove rows to change the
checklist for a given day; a task with a comma in it needs quotes around
it (`"Windows, doors, windowsill wiped"`).

## `roster-notes.json`

A `notes` list of standing instructions shown below the checklist (e.g.
the stairwell assignment rule, the laundry room note). Edit the list to
add, remove, or reword a note -- each entry is one paragraph.

## `events.csv`

Four columns: `date` (`YYYY-MM-DD`), `title`, `description` (optional,
can be blank), `type` (optional -- `inspection`, `meeting`, `drill`, or
anything else; purely informational right now).

```csv
date,title,description,type
2026-09-01,Monthly Health & Welfare Inspection,Standard walkthrough of all rooms.,inspection
```

To add an event, add a row (any order -- they get sorted automatically).
To remove one, delete its row.

## `beautification-config.json` — area beautification (lawn care) rotation

Four settings:

```json
{
  "anchorDate": "2026-09-11",
  "startTime": "07:00",
  "intervalDays": 14,
  "roomsPerDraw": 5
}
```

- `anchorDate`: any known occurrence date (`YYYY-MM-DD`) -- doesn't need
  to be a Monday, and doesn't need to be the very first one that ever
  happened, just one real date on the schedule. Every other occurrence is
  calculated from this one.
- `startTime`: 24-hour `HH:MM`, just for display -- occurrences are
  tracked by date, not time of day.
- `intervalDays`: gap between occurrences (`14` = every 2 weeks).
- `roomsPerDraw`: how many rooms get picked each occurrence.

There's no separate room list here -- the pool of eligible rooms is
pulled automatically from `roster.csv` (all floors combined), so it
always matches the actual current room list.

**How the picking works:** each occurrence, 5 rooms are picked at random
from every room *except* the 5 picked at the previous occurrence (a
one-cycle/2-week cooldown, so nobody gets picked twice in a row). Because
this is a static site with no database, there's nowhere to actually store
"which rooms were picked last time" -- instead, the site recomputes the
*entire* history from `anchorDate` forward, every time anyone loads the
page, using a seeded random-number generator. Given the same config, that
always produces the exact same sequence of picks for the exact same
dates, so every resident's browser shows identical results without any
of them needing to talk to each other or a server. If you ever change
`anchorDate`, the whole schedule reshuffles from scratch.

To change how many rooms get picked, or how often, just edit the numbers
above and commit -- no code changes needed.

## `completions-config.json` — letting residents mark their duty done

This powers the checkmarks on the roster page: residents fill out a
**Google Form** (no login needed, so it's fine on a public site), Google
drops each response into a linked **Google Sheet**, and a scheduled
GitHub Action (`scripts/sync_completions.py`, run hourly by
`.github/workflows/sync-completions.yml`) reads that Sheet and publishes
`modules/roster/completions.json`. It only ever publishes **room number +
timestamp** — never who submitted it — matching how the rest of this site
avoids posting resident names.

Until you set this up, `formUrl` and `formResponsesCsvUrl` should stay as
empty strings (`""`). The sync script checks for that and just publishes
an empty completions list instead of erroring, and the site quietly hides
the "report your duty" link/button. Nothing breaks by leaving this unset.

### One-time setup (you'll need your own Google account)

1. **Create the Form.** Go to [forms.google.com](https://forms.google.com)
   and start a blank form. Give it a title like "Barracks Cleaning Duty —
   Mark Complete."
2. **Add exactly these two questions:**
   - A **required**, **multiple choice** question with this *exact*
     wording (the sync script matches on it verbatim):
     ```
     Which floor's duty are you confirming as complete?
     ```
     with options `Floor 1`, `Floor 2`, `Floor 3` (match your floor
     names in `roster.csv` exactly if you ever rename them).
   - An **optional**, **short answer** question titled `Notes (optional)`
     — e.g. "trash still needs to go out," anything worth flagging to
     the next manager. This is optional to fill out and optional to
     include on the form at all; if you skip it, notes will just always
     be blank.
   - Don't add a name/email question. The Form doesn't need to know who's
     submitting, and Google Forms can auto-collect the respondent's email
     if "Collect email addresses" is turned on in Settings — leave that
     **off**.
3. **Link it to a Sheet.** In the Form editor, go to the **Responses**
   tab, click the green Sheets icon, and create a new spreadsheet. This
   is where every submission lands, with a `Timestamp` column Google
   adds automatically.
4. **Set the Sheet's timezone to match the barracks' local timezone.**
   In the Sheet, go to **File → Settings** and set the timezone. The
   site displays each timestamp as-is (no timezone conversion), so this
   needs to match wherever residents and managers actually are, or the
   times shown on the roster page will be off.
5. **Publish the Sheet's response tab to the web as CSV.** Still in the
   Sheet: **File → Share → Publish to web**. Under "Link," pick the
   specific sheet/tab that holds the form responses (usually named "Form
   Responses 1"), and under the format dropdown choose **Comma-separated
   values (.csv)** instead of the default web page option. Click
   **Publish**. Copy the URL it gives you — this is a public,
   read-only, no-login-required link to just that sheet's data as CSV.
   (This doesn't expose anything sensitive: the sheet only ever
   contains a timestamp, a floor name, and an optional note.)
6. **Get the Form's own shareable link.** Back in the Form editor, click
   **Send**, then the link icon, and copy that URL (optionally shorten
   it). This is the link residents actually fill out — it's what gets
   put on the "report your duty" button, and it's a good candidate for a
   QR code posted physically on each floor so residents can scan and
   submit from their phone without typing anything.
7. **Fill in this file.** Edit `data/completions-config.json`:
   ```json
   {
     "formUrl": "<the Form link from step 6>",
     "formResponsesCsvUrl": "<the published CSV link from step 5>"
   }
   ```
   Commit that change the same way as any other data update (see below).
   Within an hour (or immediately if you manually run the "Sync duty
   completions" workflow from the Actions tab), the roster page will
   start showing checkmarks and the report button will appear.

### Checking it's working

Go to the repo's **Actions** tab and look for **"Sync duty
completions"** — it runs once an hour on its own, plus once immediately
after any commit that touches `completions-config.json`. A green check
means it ran fine (even if there were 0 new responses); a red X usually
means the Form's question wording doesn't match `FLOOR_QUESTION_HEADER`
in `scripts/sync_completions.py` exactly — click into the failed run's
log for specifics, or open `scripts/sync_completions.py` and adjust the
constant to match your form's actual wording. You can also trigger a
sync manually anytime from the Actions tab (**Sync duty completions →
Run workflow**) instead of waiting for the hourly schedule.

A submission only produces a checkmark if that floor genuinely had a
room on duty that day (weekends and dates before `rotationStart` are
ignored), so a resident submitting on the wrong day just gets quietly
skipped rather than showing a false checkmark on some other room.

## `sop-content.json` — the searchable Barracks SOP

This is the source for the "Barracks SOP" module (`modules/sop/`), which
renders the full SOP text on the site and lets residents search it by
keyword. Structure:

```json
{
  "title": "...",
  "sourceDoc": "... memo number/date, shown under the title ...",
  "references": ["AR 420-1, ...", "..."],
  "sections": [
    {
      "id": "unique-anchor-id",
      "heading": "6. Standards",
      "text": "optional single paragraph",
      "items": ["optional", "bullet", "list"],
      "children": [ /* nested nodes, same shape, for sub-sections */ ]
    }
  ],
  "buildings": {
    "note": "optional caption shown above the building list",
    "areaMapImage": "assets/some-map.jpg",
    "list": [
      { "building": "25412", "unit": "...", "placardImage": "assets/some-placard.jpg" }
    ]
  }
}
```

Every node (each entry in `sections`, and each entry in its optional
`children`) needs a unique `id` (used as the page anchor a search result
jumps to) and a `heading`, plus at least one of `text`, `items`, or
`children`. `scripts/build_data.py` validates all of this -- duplicate or
missing ids, empty headings, etc. all fail the build with a specific
error rather than silently publishing something broken.

To edit the SOP's wording: find the relevant node by its `heading` and
edit its `text`/`items` directly in GitHub's web editor, then commit --
same flow as any other data file (see below). To add a brand new
sub-section, copy an existing node's shape (`id`, `heading`, and
`text`/`items`) and add it to the right `children` array.

Images referenced by `placardImage` / `areaMapImage` (paths relative to
`modules/sop/`) live directly in `modules/sop/assets/` -- they're
committed as-is, not generated, so add/replace files there directly if
you need to update a placard or the area map.

**What was already reviewed and generalized from the source PDF:** the
SOP memo's original Point of Contact block named a specific individual
along with their personal duty phone number and `.mil` email address --
that's been generalized on the site to "contact your Barracks Manager,
Floor Manager, or First Sergeant" instead, since a public website is a
much wider audience than the memo's original one. The building/unit
association from Annex B and Annex D (the aerial map) was kept as-is at
the barracks manager's request. If you update this file from a newer
version of the source SOP, re-check whether it introduces any new named
individual's personal contact info, and generalize that the same way --
same review standard as the roster/calendar data above.

## How an update actually reaches the live site

1. Edit the relevant CSV (Excel, Google Sheets, or a text editor all
   work fine -- just make sure you save/export as **CSV**, not `.xlsx`).
2. On github.com, go to this repo, open the `data` folder, and use
   **Add file -> Upload files** to upload the updated CSV (or edit it
   directly in GitHub's web editor -- click the file, then the pencil
   icon). Commit the change.
3. That commit automatically triggers the "Sync data" GitHub Action,
   which regenerates `modules/roster/rooms.json`,
   `modules/roster/tasks.json`, `modules/roster/notes.json`,
   `modules/calendar/events.json`, `modules/sop/sop.json`, and
   `modules/beautification/config.json`, and commits them back --
   usually within a minute. GitHub Pages then rebuilds the live site
   automatically, same as any other commit.
4. You can watch progress under the repo's **Actions** tab. A red X
   means something in the CSV was invalid -- click into the failed run
   to see exactly which file/line/field caused it; nothing gets
   published to the live site until it's fixed.

(This is a separate, faster pipeline from the duty-completion sync above
-- that one runs on its own hourly schedule against a Google Sheet
instead of a CSV you upload. See the `completions-config.json` section
above for that setup.)
