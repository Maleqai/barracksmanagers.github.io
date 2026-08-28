/* ============================================================
   Cleaning Roster — month grid renderer.
   Relies on window.RosterLogic (roster-logic.js).
   ============================================================ */

(function () {
  "use strict";

  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  let roomsData = null;
  const now = new Date();
  let viewYear = now.getUTCFullYear();
  let viewMonth = now.getUTCMonth(); // 0-indexed

  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const floorColumns = document.getElementById("floorColumns");

  function todayStr() {
    return window.RosterLogic.toDateStr(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    );
  }

  function renderCalendar() {
    monthLabel.textContent = `${MONTH_LABELS[viewMonth]} ${viewYear}`;
    grid.innerHTML = "";

    DOW_LABELS.forEach((label) => {
      const el = document.createElement("div");
      el.className = "dow";
      el.textContent = label;
      grid.appendChild(el);
    });

    const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
    const startOffset = firstOfMonth.getUTCDay(); // 0 = Sun
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const todayString = todayStr();

    for (let i = 0; i < startOffset; i++) {
      const el = document.createElement("div");
      el.className = "day-cell empty";
      grid.appendChild(el);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(Date.UTC(viewYear, viewMonth, day));
      const dateStr = window.RosterLogic.toDateStr(cellDate);
      const isWeekend = !window.RosterLogic.isWeekday(cellDate);

      const cell = document.createElement("div");
      cell.className = "day-cell" + (isWeekend ? " weekend" : "") + (dateStr === todayString ? " today" : "");

      const num = document.createElement("div");
      num.className = "date-num";
      num.textContent = String(day);
      cell.appendChild(num);

      if (!isWeekend) {
        const assignment = window.RosterLogic.getAssignment(dateStr, roomsData);
        if (assignment) {
          const badge = document.createElement("span");
          badge.className = "room-assignment";
          badge.textContent = `Rm ${assignment.room}`;
          badge.title = `${assignment.floor} — Room ${assignment.room}`;
          cell.appendChild(badge);

          const floorLine = document.createElement("div");
          floorLine.className = "event-title-mini";
          floorLine.textContent = assignment.floor;
          cell.appendChild(floorLine);
        } else {
          const note = document.createElement("div");
          note.className = "event-title-mini";
          note.textContent = "Not started";
          note.title = "Rotation hasn't started yet";
          cell.appendChild(note);
        }
      }

      grid.appendChild(cell);
    }
  }

  function renderFloors() {
    floorColumns.innerHTML = "";
    const todayString = todayStr();
    const todayAssignment = window.RosterLogic.getAssignment(todayString, roomsData);
    const todayRoom = todayAssignment ? todayAssignment.room : null;

    roomsData.floors.forEach((floor) => {
      const wrap = document.createElement("div");
      const h4 = document.createElement("h4");
      h4.textContent = floor.name;
      wrap.appendChild(h4);

      const ul = document.createElement("ul");
      floor.rooms.forEach((room) => {
        const li = document.createElement("li");
        li.textContent = room === todayRoom ? `Room ${room} — on duty today` : `Room ${room}`;
        if (room === todayRoom) li.className = "assigned-today";
        ul.appendChild(li);
      });
      wrap.appendChild(ul);
      floorColumns.appendChild(wrap);
    });
  }

  document.getElementById("prevMonth").addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar();
  });

  document.getElementById("todayBtn").addEventListener("click", () => {
    viewYear = now.getUTCFullYear();
    viewMonth = now.getUTCMonth();
    renderCalendar();
  });

  fetch("rooms.json")
    .then((r) => r.json())
    .then((data) => {
      roomsData = data;
      renderCalendar();
      renderFloors();
    })
    .catch((err) => {
      grid.innerHTML = `<p class="empty-state">Couldn't load rooms.json (${err.message}). If you're viewing this file directly from disk, serve it with a local web server instead — see the README.</p>`;
    });
})();
