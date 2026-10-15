/* JoyJourney: data-backed dashboard, checklist and memories
 *
 * Trips come from the MySQL API (getAllTrips / getTripById in script.js).
 * Packing items share the same per-trip store as script.js (getModuleState),
 * so Trip Detail, Dashboard and Checklist always show the same numbers.
 * Memories are still kept in this browser (localStorage).
 */
const JJ_MEMORY_KEY = "joyjourneyMemoriesV1";

function jjRead(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
function jjWrite(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function jjTrips() { return typeof getAllTrips === "function" ? getAllTrips() : []; }
function jjActiveTrips() { return jjTrips().filter((t) => t.status === "active"); }
function jjTrip(id) { return typeof getTripById === "function" ? getTripById(id) : null; }
function jjDate(date) { return date ? new Date(date + "T00:00:00") : null; }
function jjMoney(n) { return "฿" + Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 }); }
function jjToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

/* ---------- Packing items (shared with script.js) ---------- */

function jjChecklistItems(tripId) {
  let changed = false;
  const items = (getModuleState(tripId).checklistItems || []).map((item, index) => {
    if (item.id) return item;
    changed = true;
    return { ...item, id: `item-${Date.now()}-${index}` };
  });
  if (changed) {
    updateModuleState(tripId, (state) => { state.checklistItems = items; return state; });
  }
  return items;
}

function jjPacking(id) {
  const stats = getTripStats(id);
  return { checked: stats.packed, total: stats.packingTotal, pct: stats.packingPercent };
}

function jjMutateChecklist(tripId, fn) {
  jjChecklistItems(tripId); // make sure every item has an id first
  updateModuleState(tripId, (state) => {
    state.checklistItems = state.checklistItems || [];
    fn(state.checklistItems);
    return state;
  });
  jjShowChecklist(tripId);
  jjRefreshChecklistButtons();
}

/* ---------- Money ---------- */

function jjExpenses(id) {
  if (typeof getTripExpenses === "function") return getTripExpenses(id);
  const data = jjRead("joyjourneyFinance", { expenses: {} });
  return data.expenses?.[id] || [];
}

function jjPaymentStatus(id) {
  const data = jjRead("joyjourneyFinance", { payments: [] });
  const payments = (data.payments || []).filter((p) => p.tripId === id && p.status !== "cancelled");
  if (!payments.length) return "No payments";
  if (payments.some((p) => p.status === "pending")) return "Pending";
  if (payments.every((p) => p.status === "paid")) return "Paid";
  return "Unpaid";
}

function jjMemberCount(id) {
  return jjTrip(id)?.members?.length || 0;
}

/* ---------- Dashboard (index.html) ---------- */

function jjRenderDashboard() {
  const content = document.querySelector(".content");
  if (!content || (!location.pathname.endsWith("index.html") && location.pathname !== "/")) return;

  const trips = jjTrips();
  const today = jjToday();
  const upcoming = jjActiveTrips()
    .filter((t) => jjDate(t.endDate) >= today)
    .sort((a, b) => jjDate(a.startDate) - jjDate(b.startDate));
  const trip = upcoming[0] || null;
  const allExpenses = trips.flatMap((t) => jjExpenses(t.id));
  const totalExpense = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const budget = trip ? Number(trip.budget || 0) : 0;
  const spent = trip ? jjExpenses(trip.id).reduce((s, e) => s + Number(e.amount || 0), 0) : 0;
  const packing = trip ? jjPacking(trip.id) : { checked: 0, total: 0, pct: 0 };
  const days = trip ? Math.ceil((jjDate(trip.startDate) - today) / 86400000) : null;
  const countdown = days === null ? "—" : days > 0 ? `${days} days` : days === 0 ? "Today" : "Happening now";
  const countdownLabel = days !== null && days < 0 ? "enjoy the trip!" : "until trip starts";
  const status = trip ? jjPaymentStatus(trip.id) : "—";
  const loadError = typeof JJ_TRIPS_ERROR !== "undefined" && JJ_TRIPS_ERROR;

  const hero = trip
    ? `<section class="card jj-upcoming"><div><span class="pill pink">${escapeHTML(tripPhase(trip).label)} Trip</span><h2>${escapeHTML(trip.name)}</h2><p>${escapeHTML(trip.destination || "")} · ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</p><div class="jj-countdown"><strong>${countdown}</strong><small>${countdownLabel}</small></div><a class="btn soft" href="trip-detail.html?trip=${encodeURIComponent(trip.id)}">Trip overview →</a></div><img src="${escapeHTML(trip.cover)}" alt="Trip cover"></section>`
    : loadError
      ? `<section class="card"><h2>Could not load trips</h2><p>${escapeHTML(loadError.message)}</p></section>`
      : `<section class="card"><h2>No active trips</h2><p>Create a trip or join one with an invite code to see your dashboard.</p><a class="btn primary" href="trips.html">Go to My Trips</a></section>`;

  content.innerHTML = `
  <section class="page-head playful-head"><div><span class="eyebrow">Your next adventure</span><h1>Trip Dashboard ✨</h1><p class="page-subtitle">Your plans, packing and trip spending in one place.</p></div><a class="btn primary" href="trips.html"><i class="ph-bold ph-plus"></i> Manage Trips</a></section>
  ${hero}
  <section class="grid dashboard-grid">
  <article class="card stat-card"><span class="mini-icon"><i class="ph-duotone ph-users-three"></i></span><p class="muted">Members</p><h2>${trip ? jjMemberCount(trip.id) : 0}</h2><small>People in this trip</small></article>
  <article class="card stat-card"><span class="mini-icon"><i class="ph-duotone ph-piggy-bank"></i></span><p class="muted">Budget · ${trip ? escapeHTML(trip.name) : "Selected trip"}</p><h2>${jjMoney(budget)}</h2><div class="progress"><span style="width:${budget ? Math.min(100, (spent / budget) * 100) : 0}%"></span></div><small>${jjMoney(spent)} spent on this trip</small></article>
  <article class="card stat-card"><span class="mini-icon"><i class="ph-duotone ph-wallet"></i></span><p class="muted">Total Expense</p><h2>${jjMoney(totalExpense)}</h2><small>Sum of saved expenses across trips</small><a class="text-link" href="expenses.html">View expenses →</a></article>
  <article class="card stat-card"><span class="mini-icon"><i class="ph-duotone ph-backpack"></i></span><p class="muted">Packing</p><h2>${packing.pct}%</h2><div class="progress"><span style="width:${packing.pct}%"></span></div><small>${packing.checked} / ${packing.total} items ready</small><a class="text-link" href="checklist.html${trip ? `?trip=${encodeURIComponent(trip.id)}` : ""}">Open checklist →</a></article>
  <article class="card stat-card"><span class="mini-icon"><i class="ph-duotone ph-credit-card"></i></span><p class="muted">Payment Status</p><h2>${status}</h2><small>${trip ? escapeHTML(trip.name) : "No trip selected"}</small><a class="text-link" href="expenses.html">Manage payments →</a></article>
  </section>
  <section class="card jj-trip-list"><div class="trip-section-head"><div><span class="eyebrow">Keep everything in sync</span><h2>All Trips</h2></div><a class="text-link" href="trips.html">Manage trips →</a></div>
  ${trips.map((t) => {
    const p = jjPacking(t.id);
    const ex = jjExpenses(t.id).reduce((s, e) => s + Number(e.amount || 0), 0);
    const d = Math.ceil((jjDate(t.startDate) - today) / 86400000);
    const when = t.status === "finished" ? "Finished" : d > 0 ? d + " days" : d === 0 ? "Today" : "Ongoing";
    return `<article class="jj-trip-row"><div><strong>${escapeHTML(t.name)}</strong><small>${escapeHTML(formatTripDate(t.startDate, t.endDate))} · ${escapeHTML(t.destination || "")}</small></div><div class="jj-row-metrics"><span>Countdown: ${when}</span><span>Packing ${p.pct}%</span><span>Expense ${jjMoney(ex)}</span></div><a href="trip-detail.html?trip=${encodeURIComponent(t.id)}" aria-label="Open trip">→</a></article>`;
  }).join("") || "<p>No trips available.</p>"}</section>`;
}

/* ---------- Checklist (checklist.html) ---------- */

function jjChecklistSelected() {
  const trips = jjActiveTrips();
  const fromUrl = new URLSearchParams(location.search).get("trip");
  return trips.some((t) => t.id === fromUrl) ? fromUrl : trips[0]?.id || "";
}

function jjRenderChecklist() {
  const content = document.querySelector(".content");
  if (!content || !location.pathname.endsWith("checklist.html")) return;
  const trips = jjActiveTrips();
  const selected = jjChecklistSelected();
  const loadError = typeof JJ_TRIPS_ERROR !== "undefined" && JJ_TRIPS_ERROR;

  content.innerHTML = `<section class="page-head playful-head"><div><span class="eyebrow">Ready, set, go!</span><h1>Packing Checklist</h1><p class="page-subtitle">Each active trip has its own list. Your packing progress syncs to the dashboard and Trip Detail.</p></div></section>
  <div class="jj-check-trip">${trips.map((t) => `<button class="btn ${selected === t.id ? "primary" : "soft"}" data-check-trip="${escapeHTML(t.id)}" onclick="jjSelectChecklist('${escapeHTML(t.id)}')">${escapeHTML(t.name)} · ${jjPacking(t.id).pct}%</button>`).join("")}</div>
  <section id="jj-checklist-panel" class="card"></section>`;

  if (!trips.length) {
    document.getElementById("jj-checklist-panel").innerHTML = loadError
      ? `<h2>Could not load trips</h2><p>${escapeHTML(loadError.message)}</p>`
      : `<h2>No active trips</h2><p>Create a trip or join one with an invite code first.</p><a class="btn primary" href="trips.html">Go to My Trips</a>`;
    return;
  }
  jjShowChecklist(selected);
}

function jjRefreshChecklistButtons() {
  document.querySelectorAll("[data-check-trip]").forEach((button) => {
    const trip = jjTrip(button.dataset.checkTrip);
    if (trip) button.textContent = `${trip.name} · ${jjPacking(trip.id).pct}%`;
  });
}

function jjSelectChecklist(id) {
  history.replaceState(null, "", `checklist.html?trip=${encodeURIComponent(id)}`);
  jjShowChecklist(id);
  document.querySelectorAll("[data-check-trip]").forEach((b) => {
    const active = b.dataset.checkTrip === id;
    b.classList.toggle("primary", active);
    b.classList.toggle("soft", !active);
  });
}

function jjShowChecklist(id) {
  const t = jjTrip(id);
  const panel = document.getElementById("jj-checklist-panel");
  if (!panel) return;
  const items = jjChecklistItems(id);
  const p = jjPacking(id);
  panel.innerHTML = `<div class="trip-section-head"><div><span class="pill pink">${escapeHTML(t?.name || "Trip")}</span><h2>${p.pct}% packed</h2></div><span>${p.checked} of ${p.total} items</span></div><div class="progress jj-progress"><span style="width:${p.pct}%"></span></div>
  <form class="jj-add-item" onsubmit="jjAddChecklist(event,'${escapeHTML(id)}')"><input id="jj-new-item" required maxlength="100" placeholder="Add an item (e.g. passport)"><button class="btn primary" type="submit">Add item</button></form>
  <div class="jj-check-items">${items.map((x) => `<div class="jj-check-item"><label><input type="checkbox" ${x.checked ? "checked" : ""} onchange="jjToggleChecklist('${escapeHTML(id)}','${escapeHTML(x.id)}',this.checked)"><span class="${x.checked ? "jj-packed" : ""}">${escapeHTML(x.label)}</span></label><div><button class="jj-icon-btn" onclick="jjEditChecklist('${escapeHTML(id)}','${escapeHTML(x.id)}')" aria-label="Edit item">✎</button><button class="jj-icon-btn" onclick="jjDeleteChecklist('${escapeHTML(id)}','${escapeHTML(x.id)}')" aria-label="Delete item">×</button></div></div>`).join("") || "<p>No items yet. Add your first packing item above.</p>"}</div>`;
}

function jjAddChecklist(e, id) {
  e.preventDefault();
  const input = document.getElementById("jj-new-item");
  const label = input.value.trim();
  if (!label) return;
  jjMutateChecklist(id, (a) => a.push({ id: "item-" + Date.now(), label, checked: false }));
  document.getElementById("jj-new-item")?.focus();
}

function jjToggleChecklist(id, itemId, checked) {
  jjMutateChecklist(id, (a) => { const x = a.find((i) => i.id === itemId); if (x) x.checked = checked; });
}

function jjEditChecklist(id, itemId) {
  const item = jjChecklistItems(id).find((x) => x.id === itemId);
  if (!item) return;
  const label = prompt("Edit packing item:", item.label);
  if (label === null) return;
  if (!label.trim()) { alert("Item name cannot be empty."); return; }
  jjMutateChecklist(id, (a) => { const x = a.find((i) => i.id === itemId); if (x) x.label = label.trim(); });
}

function jjDeleteChecklist(id, itemId) {
  if (!confirm("Delete this checklist item?")) return;
  jjMutateChecklist(id, (a) => { const i = a.findIndex((x) => x.id === itemId); if (i >= 0) a.splice(i, 1); });
}

/* ---------- Memories (memories.html) ---------- */

function jjMemories() { return jjRead(JJ_MEMORY_KEY, []); }

function jjRenderMemories() {
  const content = document.querySelector(".content");
  if (!content || !location.pathname.endsWith("memories.html")) return;
  const trips = jjTrips();
  const memories = jjMemories();
  const filter = new URLSearchParams(location.search).get("trip") || "all";
  content.innerHTML = `<section class="page-head playful-head"><div><span class="eyebrow">Your scrapbook</span><h1>Trip Memories 📸</h1><p class="page-subtitle">Memories stay saved even after a trip has ended.</p></div><button class="btn primary" onclick="document.getElementById('jj-memory-file').click()">＋ Add Memory</button></section>
  <input id="jj-memory-file" type="file" accept="image/*" multiple hidden onchange="jjUploadMemories(event)">
  <div class="memory-filter"><button class="${filter === "all" ? "active" : ""}" onclick="jjFilterMemories('all')">All Photos <span>${memories.length}</span></button>${trips.map((t) => `<button class="${filter === t.id ? "active" : ""}" onclick="jjFilterMemories('${escapeHTML(t.id)}')">${escapeHTML(t.name)} <span>${memories.filter((m) => m.tripId === t.id).length}</span></button>`).join("")}</div>
  <section class="memory-wall memory-gallery">${memories.filter((m) => filter === "all" || m.tripId === filter).map((m) => `<article class="polaroid memory-item" data-memory-id="${escapeHTML(m.id)}"><div class="memory-frame"><img class="memory-photo" src="${m.data}" alt="${escapeHTML(m.caption || "Trip memory")}" onclick="jjOpenMemory('${escapeHTML(m.id)}')"><span class="memory-trip pink">${escapeHTML(jjTrip(m.tripId)?.name || m.tripName || "Trip archived")}</span></div><p>${escapeHTML(m.caption || "Untitled memory")}</p><div class="jj-memory-actions"><button class="btn soft" onclick="jjCaptionMemory('${escapeHTML(m.id)}')">Edit caption</button><button class="btn soft" onclick="jjDeleteMemory('${escapeHTML(m.id)}')">Delete</button></div></article>`).join("") || `<div class="card jj-empty"><h2>No photos in this album yet</h2><p>Upload a photo and choose which trip it belongs to.</p><button class="btn primary" onclick="document.getElementById('jj-memory-file').click()">Upload photos</button></div>`}</section>
  <div class="memory-lightbox" id="jj-memory-lightbox" onclick="if(event.target===this)this.classList.remove('open')"><button class="lightbox-close" onclick="document.getElementById('jj-memory-lightbox').classList.remove('open')">×</button><div class="lightbox-card"><img id="jj-memory-large" alt="Trip memory full size"><div><span class="pill pink" id="jj-memory-trip"></span><h2 id="jj-memory-caption"></h2></div></div></div>`;
}

function jjFilterMemories(id) {
  history.replaceState(null, "", id === "all" ? "memories.html" : `memories.html?trip=${encodeURIComponent(id)}`);
  jjRenderMemories();
}

async function jjUploadMemories(event) {
  const files = [...(event.target.files || [])].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return;
  const trips = jjTrips();
  if (!trips.length) { alert("Create or join a trip before adding memories."); return; }
  let tripId = new URLSearchParams(location.search).get("trip");
  if (!trips.some((t) => t.id === tripId)) {
    const choice = prompt("Enter the trip number for these photos:\n" + trips.map((t, i) => `${i + 1}. ${t.name}`).join("\n"), "1");
    const index = Number(choice) - 1;
    if (!Number.isInteger(index) || !trips[index]) { event.target.value = ""; return; }
    tripId = trips[index].id;
  }
  const trip = jjTrip(tripId);
  const all = jjMemories();
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { alert(`${file.name} is over 5 MB and was skipped.`); continue; }
    // Shrink photos so more of them fit in browser storage
    const data = typeof resizeImage === "function"
      ? await resizeImage(file, 1400, 1400, 0.8)
      : await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
    const caption = prompt(`Caption for ${file.name}:`, "");
    all.unshift({ id: "memory-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7), tripId, tripName: trip.name, caption: caption || "", data, createdAt: new Date().toISOString() });
  }
  try { jjWrite(JJ_MEMORY_KEY, all); } catch { alert("Browser storage is full. Try fewer or smaller photos."); }
  event.target.value = "";
  jjRenderMemories();
}

function jjOpenMemory(id) {
  const m = jjMemories().find((x) => x.id === id);
  if (!m) return;
  document.getElementById("jj-memory-large").src = m.data;
  document.getElementById("jj-memory-caption").textContent = m.caption || "Untitled memory";
  document.getElementById("jj-memory-trip").textContent = jjTrip(m.tripId)?.name || m.tripName || "Trip archived";
  document.getElementById("jj-memory-lightbox").classList.add("open");
}

function jjCaptionMemory(id) {
  const a = jjMemories();
  const m = a.find((x) => x.id === id);
  if (!m) return;
  const caption = prompt("Edit caption:", m.caption || "");
  if (caption === null) return;
  m.caption = caption;
  jjWrite(JJ_MEMORY_KEY, a);
  jjRenderMemories();
}

function jjDeleteMemory(id) {
  if (!confirm("Delete this photo memory?")) return;
  jjWrite(JJ_MEMORY_KEY, jjMemories().filter((m) => m.id !== id));
  jjRenderMemories();
}

/* Wait until script.js has loaded the trips from the server, then render */
document.addEventListener("DOMContentLoaded", async () => {
  await window.jjTripsReady;
  jjRenderDashboard();
  jjRenderChecklist();
  jjRenderMemories();
});
