/* ============================================================
   Area Beautification — module page renderer.
   Relies on window.BeautificationLogic (beautification-logic.js).
   ============================================================ */

(function () {
  "use strict";

  const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const nextDateEl = document.getElementById("beautNextDate");
  const nextTimeEl = document.getElementById("beautNextTime");
  const nextRoomsEl = document.getElementById("beautNextRooms");
  const scheduleEl = document.getElementById("beautSchedule");

  function todayStr() {
    const now = new Date();
    return window.BeautificationLogic.toDateStr(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    );
  }

  // "2026-09-11" -> "Friday, September 11, 2026"
  function formatLongDate(dateStr) {
    const d = window.BeautificationLogic.parseDateStr(dateStr);
    const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
    return `${dow}, ${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }

  function roomPills(rooms) {
    return rooms
      .slice()
      .sort()
      .map((r) => `<span class="beaut-room-pill">${r}</span>`)
      .join("");
  }

  fetch("config.json")
    .then((r) => r.json())
    .then((config) => {
      const today = todayStr();
      const schedule = window.BeautificationLogic.getSchedule(config, today, 6);
      const next = schedule[0];

      nextDateEl.textContent = formatLongDate(next.date);
      nextTimeEl.textContent = `Starts at ${window.BeautificationLogic.formatTime(config.startTime)}`;
      nextRoomsEl.innerHTML = roomPills(next.rooms);

      scheduleEl.innerHTML = schedule
        .slice(1)
        .map(
          (draw) => `
          <li class="beaut-schedule-row">
            <span class="beaut-schedule-date">${formatLongDate(draw.date)}</span>
            <div class="beaut-room-pills">${roomPills(draw.rooms)}</div>
          </li>`
        )
        .join("");
    })
    .catch((err) => {
      nextDateEl.textContent = "Unavailable";
      scheduleEl.innerHTML = `<li class="empty-state">Couldn't load the schedule (${err.message}). If you're viewing this file directly from disk, serve it with a local web server instead — see the README.</li>`;
    });
})();
