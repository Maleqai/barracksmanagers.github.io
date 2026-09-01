/* ============================================================
   Barracks SOP — renders the full SOP text and provides a simple
   client-side keyword search over it. No search library; the
   corpus is small enough that a plain tokenized AND-match over a
   flattened index is fast and dependency-free.
   ============================================================ */

(function () {
  "use strict";

  const searchInput = document.getElementById("sopSearch");
  const searchHint = document.getElementById("sopSearchHint");
  const resultsList = document.getElementById("sopResults");
  const outline = document.getElementById("sopOutline");
  const titleEl = document.getElementById("sopTitle");
  const sourceDocEl = document.getElementById("sopSourceDoc");

  // Flat search index: one entry per searchable chunk (a section's intro
  // text, or a single bullet item within it) so search results can point
  // at the specific line that matched, not just the whole section.
  let searchIndex = [];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function headingTag(depth) {
    return "h" + Math.min(depth + 2, 6); // top-level sections render as h3
  }

  // Recursively renders one SOP node (and its children) into the outline,
  // and pushes searchable chunks (heading/text/each item) into the index
  // with a breadcrumb trail so results can show "Standards > Fire Safety".
  function renderNode(node, depth, breadcrumb) {
    const wrap = document.createElement("section");
    wrap.className = "sop-node";
    wrap.id = node.id;

    const h = document.createElement(headingTag(depth));
    h.className = "sop-heading";
    h.textContent = node.heading;
    wrap.appendChild(h);

    const trail = breadcrumb ? `${breadcrumb} > ${node.heading}` : node.heading;

    if (node.text) {
      const p = document.createElement("p");
      p.textContent = node.text;
      wrap.appendChild(p);
      searchIndex.push({ anchor: node.id, breadcrumb: trail, text: node.text });
    }

    if (node.items && node.items.length) {
      const ul = document.createElement("ul");
      ul.className = "sop-item-list";
      node.items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
        searchIndex.push({ anchor: node.id, breadcrumb: trail, text: item });
      });
      wrap.appendChild(ul);
    }

    if (node.children && node.children.length) {
      node.children.forEach((child) => {
        wrap.appendChild(renderNode(child, depth + 1, trail));
      });
    }

    return wrap;
  }

  function renderBuildings(buildings) {
    if (!buildings || !buildings.list || !buildings.list.length) return null;

    const wrap = document.createElement("section");
    wrap.className = "sop-node";
    wrap.id = "sop-buildings";

    const h = document.createElement("h3");
    h.className = "sop-heading";
    h.textContent = "Annex B/D — Barracks Buildings by Unit";
    wrap.appendChild(h);

    if (buildings.note) {
      const p = document.createElement("p");
      p.textContent = buildings.note;
      wrap.appendChild(p);
    }

    if (buildings.areaMapImage) {
      const fig = document.createElement("figure");
      fig.className = "sop-annex-figure";
      const img = document.createElement("img");
      img.src = buildings.areaMapImage;
      img.alt = "Annex D — CPB Barracks Area of Responsibility map";
      img.loading = "lazy";
      fig.appendChild(img);
      const cap = document.createElement("figcaption");
      cap.textContent = "Annex D — CPB Barracks Area of Responsibility";
      fig.appendChild(cap);
      wrap.appendChild(fig);
    }

    const grid = document.createElement("div");
    grid.className = "sop-building-grid";
    buildings.list.forEach((b) => {
      const card = document.createElement("div");
      card.className = "sop-building-card";

      const label = document.createElement("div");
      label.className = "sop-building-label";
      label.innerHTML = `<strong>Bldg ${escapeHtml(b.building)}</strong> — ${escapeHtml(b.unit)}`;
      card.appendChild(label);

      if (b.placardImage) {
        const img = document.createElement("img");
        img.src = b.placardImage;
        img.alt = `Annex B name placard — Building ${b.building}, ${b.unit}`;
        img.loading = "lazy";
        card.appendChild(img);
      }

      grid.appendChild(card);
      searchIndex.push({
        anchor: "sop-buildings",
        breadcrumb: "Barracks Buildings by Unit",
        text: `Building ${b.building} — ${b.unit}`,
      });
    });
    wrap.appendChild(grid);

    return wrap;
  }

  function highlight(text, tokens) {
    let html = escapeHtml(text);
    tokens.forEach((t) => {
      if (!t) return;
      const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }

  function runSearch(query) {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      resultsList.hidden = true;
      resultsList.innerHTML = "";
      searchHint.textContent = "";
      document.getElementById("sopOutlineCard").style.display = "";
      return;
    }

    const matches = searchIndex.filter((chunk) => {
      const haystack = (chunk.breadcrumb + " " + chunk.text).toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });

    resultsList.hidden = false;
    document.getElementById("sopOutlineCard").style.display = "none";

    if (matches.length === 0) {
      searchHint.textContent = "";
      resultsList.innerHTML = `<li class="empty-state">No matches for "${escapeHtml(query)}". Try a different keyword, or browse the full text below.</li>`;
      document.getElementById("sopOutlineCard").style.display = "";
      return;
    }

    searchHint.textContent = `${matches.length} result${matches.length === 1 ? "" : "s"}`;
    resultsList.innerHTML = matches
      .slice(0, 40)
      .map(
        (m) => `
        <li class="sop-result">
          <a href="#${m.anchor}" class="sop-result-link" data-anchor="${m.anchor}">
            <span class="sop-result-breadcrumb">${escapeHtml(m.breadcrumb)}</span>
            <span class="sop-result-text">${highlight(m.text, tokens)}</span>
          </a>
        </li>`
      )
      .join("");
  }

  resultsList.addEventListener("click", (e) => {
    const link = e.target.closest(".sop-result-link");
    if (!link) return;
    e.preventDefault();
    const target = document.getElementById(link.dataset.anchor);
    document.getElementById("sopOutlineCard").style.display = "";
    if (target) {
      target.classList.add("sop-flash");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => target.classList.remove("sop-flash"), 1600);
    }
  });

  searchInput.addEventListener("input", () => runSearch(searchInput.value));

  fetch("sop.json")
    .then((r) => r.json())
    .then((data) => {
      titleEl.textContent = data.title || "Barracks SOP";
      sourceDocEl.textContent = data.sourceDoc || "";

      outline.innerHTML = "";
      searchIndex = [];

      if (data.references && data.references.length) {
        const refWrap = document.createElement("section");
        refWrap.className = "sop-node";
        refWrap.id = "sop-references";
        const h = document.createElement("h3");
        h.className = "sop-heading";
        h.textContent = "1. References";
        refWrap.appendChild(h);
        const ul = document.createElement("ul");
        ul.className = "sop-item-list";
        data.references.forEach((ref) => {
          const li = document.createElement("li");
          li.textContent = ref;
          ul.appendChild(li);
          searchIndex.push({ anchor: "sop-references", breadcrumb: "References", text: ref });
        });
        refWrap.appendChild(ul);
        outline.appendChild(refWrap);
      }

      (data.sections || []).forEach((section) => {
        outline.appendChild(renderNode(section, 1, ""));
      });

      const buildingsEl = renderBuildings(data.buildings);
      if (buildingsEl) outline.appendChild(buildingsEl);
    })
    .catch((err) => {
      outline.innerHTML = `<p class="empty-state">Couldn't load the SOP (${err.message}). If you're viewing this file directly from disk, serve it with a local web server instead — see the README.</p>`;
    });
})();
