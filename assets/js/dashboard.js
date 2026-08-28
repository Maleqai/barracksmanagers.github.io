/* ============================================================
   Dashboard — renders the module grid from modules.json, and
   the "today's duty" / "next event" widgets by pulling from
   each module's own data files. Relies on window.RosterLogic
   (modules/roster/roster-logic.js) for the duty widget.
   ============================================================ */

(function () {
  "use strict";

  function todayStr() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function renderModuleGrid(modules) {
    const grid = document.getElementById("moduleGrid");
    if (modules.length === 0) {
      grid.innerHTML = `<p class="empty-state">No modules registered yet — add one in modules.json.</p>`;
      return;
    }
    grid.innerHTML = modules
      .map(
        (m) => `
        <a class="card module-card" href="${m.path}">
          <span class="icon">${m.icon || "🔧"}</span>
          <h3>${m.name}</h3>
          <p>${m.description || ""}</p>
        </a>`
      )
      .join("");
  }

  function renderTodayRoom() {
    fetch("modules/roster/rooms.json")
      .then((r) => r.json())
      .then((data) => {
        const assignment = window.RosterLogic
          ? window.RosterLogic.getAssignment(todayStr(), data)
          : null;
        const roomEl = document.getElementById("todayRoom");
        const subEl = document.getElementById("todayRoomSub");
        if (assignment) {
          roomEl.textContent = `Room ${assignment.room}`;
          subEl.textContent = assignment.floor;
        } else {
          roomEl.textContent = "No duty today";
          subEl.textContent = "Weekend, or rotation hasn't started yet";
        }
      })
      .catch(() => {
        document.getElementById("todayRoom").textContent = "Unavailable";
      });
  }

  function renderNextEvent() {
    fetch("modules/calendar/events.json")
      .then((r) => r.json())
      .then((events) => {
        const today = todayStr();
        const upcoming = events
          .filter((e) => e.date >= today)
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        const titleEl = document.getElementById("nextEventTitle");
        const subEl = document.getElementById("nextEventSub");
        if (upcoming.length > 0) {
          titleEl.textContent = upcoming[0].title;
          subEl.textContent = upcoming[0].date;
        } else {
          titleEl.textContent = "No upcoming events";
          subEl.textContent = "";
        }
      })
      .catch(() => {
        document.getElementById("nextEventTitle").textContent = "Unavailable";
      });
  }

  fetch("modules.json")
    .then((r) => r.json())
    .then(renderModuleGrid)
    .catch(() => {
      document.getElementById("moduleGrid").innerHTML =
        `<p class="empty-state">Couldn't load modules.json. If you're viewing this file directly from disk, serve it with a local web server instead — see the README.</p>`;
    });

  renderTodayRoom();
  renderNextEvent();
})();
