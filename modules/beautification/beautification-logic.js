/* ============================================================
   Area Beautification — deterministic "random" room draw logic.
   Shared by the dashboard widget and this module's own page.

   There's no server or database backing this site, so the draw
   history can't be stored anywhere -- instead, every occurrence's
   picks are recomputed from scratch, every time, by replaying the
   whole schedule from the anchor date forward using a seeded
   pseudo-random generator. Same config + same date in = same
   rooms out, for every visitor's browser, forever. The one-cycle
   cooldown (a room picked this time is excluded from the very
   next draw) falls naturally out of that replay.
   ============================================================ */

(function () {
  "use strict";

  function toDateStr(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseDateStr(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  // mulberry32: a small, fast, deterministic PRNG. Not cryptographic --
  // doesn't need to be, this is picking cleaning duty, not encrypting
  // anything -- just needs to be identical across every browser given
  // the same seed, which Math.random() does NOT guarantee.
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Deterministic string hash (FNV-1a) so the PRNG seed depends on both
  // the anchor date and the occurrence index -- if you ever change the
  // anchor date in the config, the whole schedule reshuffles rather than
  // silently colliding with whatever a previous schedule drew at the
  // same index.
  function hashSeed(anchorDate, index) {
    const str = `${anchorDate}#${index}`;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededShuffle(array, seed) {
    const rand = mulberry32(seed);
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  // Occurrence index 0 = anchorDate itself, 1 = anchorDate + intervalDays, etc.
  function occurrenceDate(config, index) {
    const anchor = parseDateStr(config.anchorDate);
    return new Date(
      Date.UTC(
        anchor.getUTCFullYear(),
        anchor.getUTCMonth(),
        anchor.getUTCDate() + index * config.intervalDays
      )
    );
  }

  // Which occurrence index is "next" (today or in the future) as of todayStr.
  function nextOccurrenceIndex(config, todayStr) {
    const anchor = parseDateStr(config.anchorDate);
    const today = parseDateStr(todayStr);
    const diffDays = Math.round((today - anchor) / 86400000);
    if (diffDays <= 0) return 0;
    return Math.ceil(diffDays / config.intervalDays);
  }

  // Replays every draw from occurrence 0 through upToIndexInclusive in one
  // pass, applying the one-cycle cooldown, and returns each draw as
  // { index, date, rooms }.
  function computeDraws(config, upToIndexInclusive) {
    const draws = [];
    let previousPicks = [];
    for (let i = 0; i <= upToIndexInclusive; i++) {
      const pool = config.rooms.filter((r) => previousPicks.indexOf(r) === -1);
      // Safety net: if the pool were ever too small to draw from (it
      // won't be, at 42 rooms and a draw of 5), fall back to the full
      // list rather than erroring out on residents.
      const eligible = pool.length >= config.roomsPerDraw ? pool : config.rooms;
      const seed = hashSeed(config.anchorDate, i);
      const picks = seededShuffle(eligible, seed).slice(0, config.roomsPerDraw);
      draws.push({ index: i, date: toDateStr(occurrenceDate(config, i)), rooms: picks });
      previousPicks = picks;
    }
    return draws;
  }

  // Returns `count` upcoming draws starting with the next occurrence at
  // or after todayStr.
  function getSchedule(config, todayStr, count) {
    const startIndex = nextOccurrenceIndex(config, todayStr);
    const draws = computeDraws(config, startIndex + count - 1);
    return draws.slice(startIndex, startIndex + count);
  }

  function formatTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }

  window.BeautificationLogic = {
    toDateStr,
    parseDateStr,
    occurrenceDate,
    nextOccurrenceIndex,
    computeDraws,
    getSchedule,
    formatTime,
  };
})();
