/* ============================================================
   Cleaning Roster — month grid renderer.
   Relies on window.RosterLogic (roster-logic.js).
   ============================================================ */

(function () {
  "use strict";

  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  let roomsData = null;
  let tasksData = null;
  let notesData = null;
  const now = new Date();
  let viewYear = now.getUTCFullYear();
  let viewMonth = now.getUTCMonth(); // 0-indexed

  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const floorColumns = document.getElementById("floorColumns");
  const taskGrid = document.getElementById("taskGrid");
  const notesList = document.getElementById("notesList");

  function todayStr() {
    return window.RosterLogic.toDateStr(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    );
  }

  // "Floor 1" -> "1F". Falls back to the first letter of the name
  // if it doesn't contain a number (e.g. a custom floor name).
  function floorShortLabel(floorName) {
    const match = floorName.match(/\d+/);
    return match ? `${match[0]}F` : floorName.charAt(0).toUpperCase();
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
        const assignments = window.RosterLogic.getAssignmentsForDate(dateStr, roomsData);
        const anyAssigned = assignments.some((a) => a.room);

        if (anyAssigned) {
          const list = document.createElement("div");
          list.className = "duty-list";
          assignments.forEach((a, i) => {
            const row = document.createElement("div");
            row.className = `room-assignment floor-${(i % 3) + 1}`;
            row.title = `${a.floor}${a.room ? " — Room " + a.room : " — no assignment"}`;

            const tag = document.createElement("span");
            tag.className = "floor-tag";
            tag.textContent = floorShortLabel(a.floor);
            row.appendChild(tag);

            const num = document.createElement("span");
            num.className = "room-num";
            num.textContent = a.room || "—";
            row.appendChild(num);

            list.appendChild(row);
          });
          cell.appendChild(list);
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
    const todayAssignments = window.RosterLogic.getAssignmentsForDate(todayString, roomsData);

    roomsData.floors.forEach((floor) => {
      const todayRoom = (todayAssignments.find((a) => a.floor === floor.name) || {}).room;

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

  function renderTasks() {
    taskGrid.innerHTML = "";
    WEEKDAY_NAMES.forEach((day) => {
      const col = document.createElement("div");
      const h4 = document.createElement("h4");
      h4.textContent = day;
      col.appendChild(h4);

      const ul = document.createElement("ul");
      (tasksData.tasks[day] || []).forEach((task) => {
        const li = document.createElement("li");
        li.textContent = task;
        ul.appendChild(li);
      });
      col.appendChild(ul);
      taskGrid.appendChild(col);
    });
  }

  function renderNotes() {
    notesList.innerHTML = "";
    notesData.notes.forEach((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      notesList.appendChild(li);
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

  Promise.all([
    fetch("rooms.json").then((r) => r.json()),
    fetch("tasks.json").then((r) => r.json()),
    fetch("notes.json").then((r) => r.json()),
  ])
    .then(([rooms, tasks, notes]) => {
      roomsData = rooms;
      tasksData = tasks;
      notesData = notes;
      renderCalendar();
      renderFloors();
      renderTasks();
      renderNotes();
    })
    .catch((err) => {
      grid.innerHTML = `<p class="empty-state">Couldn't load roster data (${err.message}). If you're viewing this file directly from disk, serve it with a local web server instead — see the README.</p>`;
    });
})();
