/* ============================================================
   Cleaning Roster — shared rotation logic.
   Used by modules/roster/index.html AND assets/js/dashboard.js,
   so the "today's duty" widget on the homepage and the full
   roster module always agree.

   Rotation rule: one room, cycling through every room across
   all floors in order, assigned to exactly one weekday
   (Mon–Fri) at a time. Weekends have no assignment.
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

  function getRotationList(data) {
    if (Array.isArray(data.rotationOrder) && data.rotationOrder.length > 0) {
      return data.rotationOrder;
    }
    return data.floors.flatMap((f) => f.rooms);
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

  function findFloorForRoom(room, floors) {
    const floor = floors.find((f) => f.rooms.includes(room));
    return floor ? floor.name : "";
  }

  // Returns { room, floor } or null if the date is a weekend,
  // or before rotationStart.
  function getAssignment(dateStr, data) {
    const target = parseDateStr(dateStr);
    if (!isWeekday(target)) return null;

    const start = parseDateStr(data.rotationStart);
    if (target.getTime() < start.getTime()) return null;

    const rotation = getRotationList(data);
    if (rotation.length === 0) return null;

    const idx = weekdayIndexSince(start, target) % rotation.length;
    const room = rotation[idx];
    return { room, floor: findFloorForRoom(room, data.floors) };
  }

  global.RosterLogic = {
    parseDateStr,
    toDateStr,
    isWeekday,
    getRotationList,
    getAssignment,
  };
})(window);
