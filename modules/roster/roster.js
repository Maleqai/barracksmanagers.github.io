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
  let completionsIndex = new Map();
  const now = new Date();
  let viewYear = now.getUTCFullYear();
  let viewMonth = now.getUTCMonth(); // 0-indexed

  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const floorColumns = document.getElementById("floorColumns");
  const taskGrid = document.getElementById("taskGrid");
  const notesList = document.getElementById("notesList");
  const todayStatusList = document.getElementById("todayStatusList");
  const reportLinkWrap = document.getElementById("reportLinkWrap");

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

  // completions.json timestamps have no timezone suffix -- they're the
  // Google Sheet's local time as-is (see data/README.md: the Sheet
  // should be set to the barracks' local timezone). A timezone-less
  // ISO string is parsed by JS as local time in whatever timezone the
  // browser itself is in, which lines up correctly as long as whoever's
  // viewing the site is in the same timezone as the barracks.
  function formatTime(isoTimestamp) {
    const d = new Date(isoTimestamp);
    if (isNaN(d.getTime())) return isoTimestamp;
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
            const completion = a.room ? window.RosterLogic.getCompletion(completionsIndex, a.room, dateStr) : null;

            const row = document.createElement("div");
            row.className = `room-assignment floor-${(i % 3) + 1}` + (completion ? " is-done" : "");
            row.title = completion
              ? `${a.floor} — Room ${a.room} — marked done at ${formatTime(completion.timestamp)}`
              : `${a.floor}${a.room ? " — Room " + a.room : " — no assignment"}`;

            const tag = document.createElement("span");
            tag.className = "floor-tag";
            tag.textContent = floorShortLabel(a.floor);
            row.appendChild(tag);

            const num = document.createElement("span");
            num.className = "room-num";
            num.textContent = a.room || "—";
            row.appendChild(num);

            if (completion) {
              const check = document.createElement("span");
              check.className = "done-check";
              check.textContent = "✓";
              row.appendChild(check);
            }

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

  function renderTodayStatus() {
    if (!todayStatusList) return;
    todayStatusList.innerHTML = "";
    const todayString = todayStr();
    const assignments = window.RosterLogic.getAssignmentsForDate(todayString, roomsData);
    const anyAssigned = assignments.some((a) => a.room);

    if (!anyAssigned) {
      todayStatusList.innerHTML = `<li class="empty-state">No duty today — weekend, or rotation hasn't started yet.</li>`;
      return;
    }

    assignments.forEach((a) => {
      const completion = a.room ? window.RosterLogic.getCompletion(completionsIndex, a.room, todayString) : null;
      const li = document.createElement("li");
      li.className = "today-status-row" + (completion ? " is-done" : " is-pending");
      li.innerHTML = completion
        ? `<strong>${a.floor} — Room ${a.room}:</strong> ✓ Done at ${formatTime(completion.timestamp)}`
        : `<strong>${a.floor} — Room ${a.room}:</strong> Not yet marked done`;
      todayStatusList.appendChild(li);
    });
  }

  function renderReportLink(formUrl) {
    if (!reportLinkWrap) return;
    if (formUrl) {
      reportLinkWrap.innerHTML = `<a class="report-duty-btn" href="${formUrl}" target="_blank" rel="noopener">Report your floor's duty as complete &rarr;</a>`;
    } else {
      reportLinkWrap.innerHTML = "";
    }
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
    fetch("completions.json").then((r) => r.json()),
  ])
    .then(([rooms, tasks, notes, completions]) => {
      roomsData = rooms;
      tasksData = tasks;
      notesData = notes;
      completionsIndex = window.RosterLogic.buildCompletionsIndex(completions);
      renderReportLink(completions.formUrl);
      renderTodayStatus();
      renderCalendar();
      renderFloors();
      renderTasks();
      renderNotes();
    })
    .catch((err) => {
      grid.innerHTML = `<p class="empty-state">Couldn't load roster data (${err.message}). If you're viewing this file directly from disk, serve it with a local web server instead — see the README.</p>`;
    });
})();
