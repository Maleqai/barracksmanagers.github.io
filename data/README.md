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

## How an update actually reaches the live site

1. Edit the relevant CSV (Excel, Google Sheets, or a text editor all
   work fine -- just make sure you save/export as **CSV**, not `.xlsx`).
2. On github.com, go to this repo, open the `data` folder, and use
   **Add file -> Upload files** to upload the updated CSV (or edit it
   directly in GitHub's web editor -- click the file, then the pencil
   icon). Commit the change.
3. That commit automatically triggers the "Sync data" GitHub Action,
   which regenerates `modules/roster/rooms.json` and
   `modules/calendar/events.json` and commits them back -- usually
   within a minute. GitHub Pages then rebuilds the live site
   automatically, same as any other commit.
4. You can watch progress under the repo's **Actions** tab. A red X
   means something in the CSV was invalid -- click into the failed run
   to see exactly which file/line/field caused it; nothing gets
   published to the live site until it's fixed.
