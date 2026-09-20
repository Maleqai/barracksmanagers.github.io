#!/usr/bin/env python3
"""
Pulls "I'll be on leave/TDY" reports from a Google Form's published response
sheet and turns them into modules/roster/unavailability.json -- the file the
roster page (and dashboard) read to flag a room that can't complete its
cleaning duty for a date range.

Why a Google Form: same reasoning as scripts/sync_completions.py -- no
login, easy to reach via a QR code, and this script (run on a schedule by
.github/workflows/sync-unavailability.yml) cross-references each submitted
room number against the actual roster (so a typo'd room number gets flagged
and skipped rather than silently accepted).

This is purely informational: the site flags the affected room(s) so the
floor manager can see it and make other arrangements. It does NOT reassign
or skip that day's rotation -- the assignment itself is untouched.

Setup (see data/README.md for the full walkthrough): create the Form, link
it to a Sheet, publish that Sheet's response tab to the web as CSV, and put
that URL in data/unavailability-config.json's "formResponsesCsvUrl". Until
that's filled in, this script just writes an empty unavailability list
rather than failing.

Run locally with:  python3 scripts/sync_unavailability.py
"""

import csv
import io
import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Must match the Google Form question text exactly (see data/README.md).
ROOM_QUESTION_HEADER = "Which room number will be unavailable?"
START_DATE_HEADER = "First day you'll be unavailable (leave/TDY start date)"
END_DATE_HEADER = "Last day you'll be unavailable (leave/TDY end date)"
TIMESTAMP_HEADER = "Timestamp"

# How far past its end date to keep an unavailability entry in the
# published JSON. Full history always remains in the Google Sheet itself --
# this just keeps the file the site downloads from growing forever.
RETENTION_DAYS = 60

# Common formats a Google Form "Date" question can show up as in the linked
# Sheet, depending on the Sheet's locale. Tried in order; first match wins.
DATE_FORMATS = [
    "%m/%d/%Y",
    "%Y-%m-%d",
    "%d/%m/%Y",
]


class SyncError(Exception):
    pass


def parse_date_cell(raw):
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def load_rooms():
    path = ROOT / "modules" / "roster" / "rooms.json"
    if not path.exists():
        raise SyncError(
            f"Missing {path.relative_to(ROOT)} -- run scripts/build_data.py first."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def room_to_floor_map(rooms_data):
    mapping = {}
    for floor in rooms_data["floors"]:
        for room in floor["rooms"]:
            mapping[room] = floor["name"]
    return mapping


def fetch_csv(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.URLError as e:
        raise SyncError(f"Couldn't fetch the published Sheet CSV: {e}")
    # Google publishes as UTF-8; be lenient about a possible BOM.
    text = raw.decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def build_unavailable(rows, rooms_data):
    if not rows:
        return []

    headers = set(rows[0].keys())
    required = {TIMESTAMP_HEADER, ROOM_QUESTION_HEADER, START_DATE_HEADER, END_DATE_HEADER}
    if not required.issubset(headers):
        raise SyncError(
            "The published sheet doesn't have the expected columns.\n"
            f"  Expected: {sorted(required)}\n"
            f"  Found: {sorted(headers)}\n"
            "This usually means the Form question wording doesn't match "
            "exactly -- see data/README.md for the exact text to use, or "
            "update the *_HEADER constants in this script to match your "
            "form."
        )

    room_floor = room_to_floor_map(rooms_data)
    latest = {}  # (room, startDate, endDate) -> entry dict, keeping the newest submission
    skipped = 0

    for i, row in enumerate(rows, start=2):
        room = (row.get(ROOM_QUESTION_HEADER) or "").strip()
        ts_raw = row.get(TIMESTAMP_HEADER) or ""
        note = (row.get("Notes") or row.get("Notes (optional)") or "").strip()

        ts = None
        for fmt in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y %I:%M:%S %p", "%Y-%m-%d %H:%M:%S"):
            try:
                ts = datetime.strptime(ts_raw.strip(), fmt)
                break
            except ValueError:
                continue
        if ts is None:
            print(f"WARNING: row {i}: couldn't parse timestamp '{ts_raw}', skipping.", file=sys.stderr)
            skipped += 1
            continue

        if room not in room_floor:
            print(f"WARNING: row {i}: '{room}' isn't a known room number, skipping.", file=sys.stderr)
            skipped += 1
            continue

        start = parse_date_cell(row.get(START_DATE_HEADER))
        end = parse_date_cell(row.get(END_DATE_HEADER))
        if start is None or end is None:
            print(
                f"WARNING: row {i}: couldn't parse start/end date "
                f"('{row.get(START_DATE_HEADER)}' / '{row.get(END_DATE_HEADER)}'), skipping.",
                file=sys.stderr,
            )
            skipped += 1
            continue
        if end < start:
            print(
                f"WARNING: row {i}: end date {end.isoformat()} is before start date "
                f"{start.isoformat()}, skipping.",
                file=sys.stderr,
            )
            skipped += 1
            continue

        key = (room, start.isoformat(), end.isoformat())
        existing = latest.get(key)
        if existing is None or ts.isoformat() > existing["_ts"]:
            latest[key] = {
                "room": room,
                "floor": room_floor[room],
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "note": note,
                "_ts": ts.isoformat(),
            }

    print(f"Parsed {len(rows)} response rows, {skipped} skipped, {len(latest)} unique unavailability entries.")

    cutoff = datetime.now(timezone.utc).date().toordinal() - RETENTION_DAYS
    entries = [
        {k: v for k, v in e.items() if k != "_ts"}
        for e in latest.values()
        if datetime.fromisoformat(e["endDate"]).toordinal() >= cutoff
    ]
    entries.sort(key=lambda e: (e["startDate"], e["room"]))
    return entries


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")
    print(f"Wrote {path.relative_to(ROOT)}")


def main():
    config_path = DATA / "unavailability-config.json"
    if not config_path.exists():
        raise SyncError(f"Missing {config_path.relative_to(ROOT)}")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    url = (config.get("formResponsesCsvUrl") or "").strip()
    form_url = (config.get("formUrl") or "").strip()

    output = {
        "_comment": (
            "Generated by scripts/sync_unavailability.py from the published "
            "Google Form responses sheet -- do not edit this file directly."
        ),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "formUrl": form_url,
        "unavailable": [],
    }

    if not url:
        print("data/unavailability-config.json: formResponsesCsvUrl is empty -- writing an empty unavailability list.")
        write_json(ROOT / "modules" / "roster" / "unavailability.json", output)
        return

    try:
        rooms_data = load_rooms()
        rows = fetch_csv(url)
        output["unavailable"] = build_unavailable(rows, rooms_data)
    except SyncError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    write_json(ROOT / "modules" / "roster" / "unavailability.json", output)


if __name__ == "__main__":
    main()
