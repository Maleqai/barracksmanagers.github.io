/* ============================================================
   Cleaning Roster — shared rotation logic.
   Used by modules/roster/index.html AND assets/js/dashboard.js,
   so the "today's duty" widget on the homepage and the full
   roster module always agree.

   Rotation rule: each floor runs its OWN independent rotation
   through its own room list (data/roster.csv), one room per
   weekday (Mon–Fri), all counted from the same rotationStart
   date. So a given weekday has one assigned room per floor —
   e.g. Floor 1 room 101, Floor 2 room 201, Floor 3 room 301 all
   on the same Monday. Weekends have no assignment on any floor.
   ============================================================ */

(function (global) {
  "use strict";

  function parseDateStr(s) {
    // "YYYY-MM-DD" -> UTC midnight Date, so day-of-week math is
    // unaffected by the viewer's local timezone.
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function toDateStr(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function isWeekday(date) {
    const dow = date.getUTCDay(); // 0 = Sun ... 6 = Sat
    return dow >= 1 && dow <= 5;
  }

  // Number of weekdays strictly between `start` and `target`
  // (both UTC-midnight Dates, target >= start). start itself
  // counts as index 0.
  function weekdayIndexSince(start, target) {
    let count = 0;
    const cur = new Date(start.getTime());
    while (cur.getTime() < target.getTime()) {
      cur.setUTCDate(cur.getUTCDate() + 1);
      if (isWeekday(cur)) count++;
    }
    return count;
  }

  // Returns an array, one entry per floor: { floor, room } —
  // room is null if the date is a weekend, before rotationStart,
  // or that floor has no rooms configured.
  function getAssignmentsForDate(dateStr, data) {
    const target = parseDateStr(dateStr);
    const weekday = isWeekday(target);
    const start = parseDateStr(data.rotationStart);
    const started = target.getTime() >= start.getTime();
    const idx = weekday && started ? weekdayIndexSince(start, target) : null;

    return data.floors.map((floor) => {
      if (idx === null || floor.rooms.length === 0) {
        return { floor: floor.name, room: null };
      }
      return { floor: floor.name, room: floor.rooms[idx % floor.rooms.length] };
    });
  }

  // Convenience: just this one floor's assignment for a date.
  function getAssignmentForFloor(dateStr, data, floorName) {
    return getAssignmentsForDate(dateStr, data).find((a) => a.floor === floorName) || null;
  }

  // completionsData is the parsed modules/roster/completions.json.
  // Returns a Map keyed by "room|date" -> completion record, for O(1)
  // lookups while rendering a month grid.
  function buildCompletionsIndex(completionsData) {
    const index = new Map();
    (completionsData.completions || []).forEach((c) => {
      index.set(`${c.room}|${c.date}`, c);
    });
    return index;
  }

  // Returns the completion record for this room+date, or null if it
  // hasn't been marked done.
  function getCompletion(index, room, dateStr) {
    return index.get(`${room}|${dateStr}`) || null;
  }

  // unavailabilityData is the parsed modules/roster/unavailability.json.
  // Returns a Map keyed by room -> array of {room, floor, startDate,
  // endDate, note}, so a room can have more than one reported range.
  function buildUnavailabilityIndex(unavailabilityData) {
    const index = new Map();
    (unavailabilityData.unavailable || []).forEach((u) => {
      if (!index.has(u.room)) index.set(u.room, []);
      index.get(u.room).push(u);
    });
    return index;
  }

  // Returns the unavailability entry covering this room+date (startDate
  // <= dateStr <= endDate), or null if that room isn't reported
  // unavailable on that date. Date strings are "YYYY-MM-DD", so plain
  // string comparison sorts the same as chronological order.
  function getUnavailability(index, room, dateStr) {
    const ranges = index.get(room);
    if (!ranges) return null;
    return ranges.find((r) => dateStr >= r.startDate && dateStr <= r.endDate) || null;
  }

  // Every reported entry whose range hasn't fully ended yet (endDate >=
  // todayStr), soonest-starting first. Powers the roster page's
  // "currently & upcoming unavailable" list.
  function getUpcomingUnavailability(unavailabilityData, todayStr) {
    return (unavailabilityData.unavailable || [])
      .filter((u) => u.endDate >= todayStr)
      .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  }

  global.RosterLogic = {
    parseDateStr,
    toDateStr,
    isWeekday,
    getAssignmentsForDate,
    getAssignmentForFloor,
    buildCompletionsIndex,
    getCompletion,
    buildUnavailabilityIndex,
    getUnavailability,
    getUpcomingUnavailability,
  };
})(window);
