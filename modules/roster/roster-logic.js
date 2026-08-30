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

  global.RosterLogic = {
    parseDateStr,
    toDateStr,
    isWeekday,
    getAssignmentsForDate,
    getAssignmentForFloor,
  };
})(window);
