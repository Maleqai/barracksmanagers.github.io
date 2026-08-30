#!/usr/bin/env python3
"""
Pulls "duty complete" confirmations from a Google Form's published response
sheet and turns them into modules/roster/completions.json -- the file the
roster page reads to show a checkmark next to a room that's confirmed done.

Why a Google Form: residents mark their duty complete there (no login, easy
to reach via a QR code posted in the hallway); this script -- run on a
schedule by .github/workflows/sync-completions.yml -- pulls the responses
in and cross-references each one against the actual rotation (so a
submission only counts if that floor really was on duty that day).

Setup (see data/README.md for the full walkthrough): create the Form, link
it to a Sheet, publish that Sheet's response tab to the web as CSV, and put
that URL in data/completions-config.json's "formResponsesCsvUrl". Until
that's filled in, this script just writes an empty completions list rather
than failing.

Run locally with:  python3 scripts/sync_completions.py
"""

import csv
import io
import json
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Must match the Google Form question text exactly (see data/README.md).
FLOOR_QUESTION_HEADER = "Which floor's duty are you confirming as complete?"
TIMESTAMP_HEADER = "Timestamp"

# How far back to keep completions in the published JSON. Full history
# always remains in the Google Sheet itself -- this just keeps the file
# the site downloads from growing forever.
RETENTION_DAYS = 60

# Common formats Google Sheets writes timestamps in, depending on the
# sheet's locale. Tried in order; first match wins.
TIMESTAMP_FORMATS = [
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %I:%M:%S %p",
    "%Y-%m-%d %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
]


class SyncError(Exception):
    pass


def parse_date_str(s):
    y, m, d = (int(p) for p in s.split("-"))
    return datetime(y, m, d, tzinfo=timezone.utc).date()


def is_weekday(d):
    return d.weekday() < 5  # Mon=0 .. Sun=6


def weekday_index_since(start, target):
    count = 0
    cur = start
    while cur < target:
        cur = cur.fromordinal(cur.toordinal() + 1)
        if is_weekday(cur):
            count += 1
    return count


def load_rooms():
    path = ROOT / "modules" / "roster" / "rooms.json"
    if not path.exists():
        raise SyncError(
            f"Missing {path.relative_to(ROOT)} -- run scripts/build_data.py first."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def assigned_room_for(floor_name, target_date, rooms_data):
    start = parse_date_str(rooms_data["rotationStart"])
    if not is_weekday(target_date) or target_date < start:
        return None
    floor = next((f for f in rooms_data["floors"] if f["name"] == floor_name), None)
    if not floor or not floor["rooms"]:
        return None
    idx = weekday_index_since(start, target_date)
    return floor["rooms"][idx % len(floor["rooms"])]


def parse_timestamp(raw):
    raw = raw.strip()
    for fmt in TIMESTAMP_FORMATS:
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def fetch_csv(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.URLError as e:
        raise SyncError(f"Couldn't fetch the published Sheet CSV: {e}")
    # Google publishes as UTF-8; be lenient about a possible BOM.
    text = raw.decode("utf-8-sig", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def build_completions(rows, rooms_data):
    if not rows:
        return []

    headers = set(rows[0].keys())
    if TIMESTAMP_HEADER not in headers or FLOOR_QUESTION_HEADER not in headers:
        raise SyncError(
            "The published sheet doesn't have the expected columns.\n"
            f"  Expected: '{TIMESTAMP_HEADER}' and '{FLOOR_QUESTION_HEADER}'\n"
            f"  Found: {sorted(headers)}\n"
            "This usually means the Form question's wording doesn't match "
            "exactly -- see data/README.md for the exact text to use, or "
            "update FLOOR_QUESTION_HEADER in this script to match your form."
        )

    valid_floors = {f["name"] for f in rooms_data["floors"]}
    latest = {}  # (room, date) -> completion dict, keeping the newest timestamp
    skipped = 0

    for i, row in enumerate(rows, start=2):
        floor = (row.get(FLOOR_QUESTION_HEADER) or "").strip()
        ts_raw = row.get(TIMESTAMP_HEADER) or ""
        note = (row.get("Notes") or row.get("Notes (optional)") or "").strip()

        ts = parse_timestamp(ts_raw)
        if ts is None:
            print(f"WARNING: row {i}: couldn't parse timestamp '{ts_raw}', skipping.", file=sys.stderr)
            skipped += 1
            continue
        if floor not in valid_floors:
            print(f"WARNING: row {i}: '{floor}' isn't a known floor, skipping.", file=sys.stderr)
            skipped += 1
            continue

        submission_date = ts.date()
        room = assigned_room_for(floor, submission_date, rooms_data)
        if room is None:
            print(
                f"WARNING: row {i}: {floor} had no duty assigned on {submission_date} "
                "(weekend or before rotation start), skipping.",
                file=sys.stderr,
            )
            skipped += 1
            continue

        key = (room, submission_date.isoformat())
        existing = latest.get(key)
        if existing is None or ts.isoformat() > existing["timestamp"]:
            latest[key] = {
                "room": room,
                "floor": floor,
                "date": submission_date.isoformat(),
                "timestamp": ts.isoformat(),
                "note": note,
            }

    print(f"Parsed {len(rows)} response rows, {skipped} skipped, {len(latest)} unique room/date completions.")

    cutoff = datetime.now(timezone.utc).date().toordinal() - RETENTION_DAYS
    completions = [c for c in latest.values() if parse_date_str(c["date"]).toordinal() >= cutoff]
    completions.sort(key=lambda c: (c["date"], c["room"]))
    return completions


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8")
    print(f"Wrote {path.relative_to(ROOT)}")


def main():
    config_path = DATA / "completions-config.json"
    if not config_path.exists():
        raise SyncError(f"Missing {config_path.relative_to(ROOT)}")
    config = json.loads(config_path.read_text(encoding="utf-8"))
    url = (config.get("formResponsesCsvUrl") or "").strip()
    form_url = (config.get("formUrl") or "").strip()

    output = {
        "_comment": (
            "Generated by scripts/sync_completions.py from the published "
            "Google Form responses sheet -- do not edit this file directly."
        ),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "formUrl": form_url,
        "completions": [],
    }

    if not url:
        print("data/completions-config.json: formResponsesCsvUrl is empty -- writing an empty completions list.")
        write_json(ROOT / "modules" / "roster" / "completions.json", output)
        return

    try:
        rooms_data = load_rooms()
        rows = fetch_csv(url)
        output["completions"] = build_completions(rows, rooms_data)
    except SyncError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    write_json(ROOT / "modules" / "roster" / "completions.json", output)


if __name__ == "__main__":
    main()
