/* ============================================================
   Event Calendar — month grid + upcoming events list.
   ============================================================ */

(function () {
  "use strict";

  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  let events = [];
  const now = new Date();
  let viewYear = now.getUTCFullYear();
  let viewMonth = now.getUTCMonth();

  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const detailPanel = document.getElementById("detailPanel");
  const upcomingList = document.getElementById("upcomingList");

  function toDateStr(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function todayStr() {
    return toDateStr(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  }

  function eventsOn(dateStr) {
    return events.filter((e) => e.date === dateStr);
  }

  function formatDateStr(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  }

  function showDetail(dateStr) {
    const dayEvents = eventsOn(dateStr);
    if (dayEvents.length === 0) {
      detailPanel.innerHTML = "";
      return;
    }
    detailPanel.innerHTML = `
      <div class="detail-panel">
        <div class="detail-date">${formatDateStr(dateStr)}</div>
        ${dayEvents
          .map((e) => `<h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.description || "")}</p>`)
          .join("")}
      </div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
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
    const startOffset = firstOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const todayString = todayStr();

    for (let i = 0; i < startOffset; i++) {
      const el = document.createElement("div");
      el.className = "day-cell empty";
      grid.appendChild(el);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(Date.UTC(viewYear, viewMonth, day));
      const dateStr = toDateStr(cellDate);
      const dow = cellDate.getUTCDay();
      const isWeekend = dow === 0 || dow === 6;
      const dayEvents = eventsOn(dateStr);

      const cell = document.createElement("div");
      cell.className =
        "day-cell" +
        (isWeekend ? " weekend" : "") +
        (dateStr === todayString ? " today" : "") +
        (dayEvents.length > 0 ? " has-event" : "");

      const num = document.createElement("div");
      num.className = "date-num";
      num.textContent = String(day);
      cell.appendChild(num);

      dayEvents.slice(0, 2).forEach((e) => {
        const line = document.createElement("div");
        line.className = "event-title-mini";
        line.innerHTML = `<span class="event-dot"></span>${escapeHtml(e.title)}`;
        cell.appendChild(line);
      });

      if (dayEvents.length > 0) {
        cell.addEventListener("click", () => showDetail(dateStr));
      }

      grid.appendChild(cell);
    }
  }

  function renderUpcoming() {
    const todayString = todayStr();
    const upcoming = events
      .filter((e) => e.date >= todayString)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 8);

    if (upcoming.length === 0) {
      upcomingList.innerHTML = `<li class="empty-state">No upcoming events. Add some in modules/calendar/events.json.</li>`;
      return;
    }

    upcomingList.innerHTML = upcoming
      .map(
        (e) => `
        <li>
          <div class="ev-date">${formatDateStr(e.date)}</div>
          <div class="ev-title">${escapeHtml(e.title)}</div>
          ${e.description ? `<div>${escapeHtml(e.description)}</div>` : ""}
        </li>`
      )
      .join("");
  }

  document.getElementById("prevMonth").addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    detailPanel.innerHTML = "";
    renderCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    detailPanel.innerHTML = "";
    renderCalendar();
  });

  document.getElementById("todayBtn").addEventListener("click", () => {
    viewYear = now.getUTCFullYear();
    viewMonth = now.getUTCMonth();
    detailPanel.innerHTML = "";
    renderCalendar();
  });

  fetch("events.json")
    .then((r) => r.json())
    .then((data) => {
      events = data;
      renderCalendar();
      renderUpcoming();
    })
    .catch((err) => {
      grid.innerHTML = `<p class="empty-state">Couldn't load events.json (${err.message}). If you're viewing this file directly from disk, serve it with a local web server instead — see the README.</p>`;
    });
})();
