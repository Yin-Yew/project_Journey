function toggleSidebar() {
  document.querySelector(".sidebar")?.classList.toggle("open");
}

function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

function demoToast(message) {
  const toast = document.getElementById("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function demoLogin(event) {
  event.preventDefault();
  demoToast("Welcome back");

  setTimeout(() => {
    window.location.href = "index.html";
  }, 600);
}

function demoRegister(event) {
  event.preventDefault();
  demoToast("Account created");

  setTimeout(() => {
    window.location.href = "index.html";
  }, 600);
}

let pendingTripCover = "";


const DEFAULT_TRIPS = {
  samet: {
    id: "samet",
    name: "Koh Samet Getaway",
    destination: "Rayong",
    startDate: "2026-10-10",
    endDate: "2026-10-12",
    budget: 12000,
    cover: "https://images.pexels.com/photos/28581877/pexels-photo-28581877.jpeg?auto=compress&cs=tinysrgb&w=1200",
    inviteCode: "SAMET26",
    baseActivities: 3,
    basePacking: { checked: 3, total: 5 }
  },
  bkk: {
    id: "bkk",
    name: "Bangkok Weekend",
    destination: "Bangkok",
    startDate: "2026-11-28",
    endDate: "2026-11-29",
    budget: 8000,
    cover: "https://images.pexels.com/photos/20020757/pexels-photo-20020757.jpeg?auto=compress&cs=tinysrgb&w=1200",
    inviteCode: "BKK26",
    baseActivities: 2,
    basePacking: { checked: 2, total: 4 }
  }
};

function getDeletedTripIds() {
  try {
    return JSON.parse(localStorage.getItem("joyjourneyDeletedTrips") || "[]");
  } catch {
    return [];
  }
}

function saveDeletedTripIds(ids) {
  localStorage.setItem("joyjourneyDeletedTrips", JSON.stringify(ids));
}

function getModuleStates() {
  try {
    return JSON.parse(localStorage.getItem("joyjourneyTripModules") || "{}");
  } catch {
    return {};
  }
}

function saveModuleStates(states) {
  localStorage.setItem("joyjourneyTripModules", JSON.stringify(states));
}

function getModuleState(tripId) {
  const states = getModuleStates();
  return states[tripId] || { activities: [], checklistItems: [], packing: null };
}

function updateModuleState(tripId, updater) {
  const states = getModuleStates();
  const current = states[tripId] || { activities: [], checklistItems: [], packing: null };
  states[tripId] = updater(current) || current;
  saveModuleStates(states);
  return states[tripId];
}

function getTripById(tripId) {
  const deleted = getDeletedTripIds();

  if (deleted.includes(tripId)) {
    return null;
  }

  if (DEFAULT_TRIPS[tripId]) {
    return DEFAULT_TRIPS[tripId];
  }

  return getStoredTrips().find((trip) => trip.id === tripId) || null;
}

function getTripStats(tripId) {
  const trip = getTripById(tripId);
  const state = getModuleState(tripId);
  const baseActivities = trip?.baseActivities || 0;
  const basePacking = trip?.basePacking || { checked: 0, total: 0 };
  const activities = baseActivities + (state.activities?.length || 0);
  const packing = state.packing || basePacking;
  const packingPercent = packing.total ? Math.round((packing.checked / packing.total) * 100) : 0;

  return { activities, packingPercent };
}

function getTripIdFromPanel(panel) {
  if (!panel) {
    return "";
  }

  return panel.dataset.tripId || "";
}

function tripSlug(tripId) {
  return String(tripId).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function tripDayCount(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function getStoredTrips() {
  try {
    return JSON.parse(localStorage.getItem("joyjourneyTrips") || "[]");
  } catch {
    return [];
  }
}

function saveStoredTrips(trips) {
  localStorage.setItem("joyjourneyTrips", JSON.stringify(trips));
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTripDate(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: sameMonth ? undefined : "numeric" });
  const endText = end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return `${startText}–${endText}`;
}

function resizeImage(file, maxWidth = 1200, maxHeight = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = Math.round(image.width * ratio);
        const height = Math.round(image.height * ratio);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      image.onerror = reject;
      image.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function previewTripCover(event) {
  const file = event.target.files?.[0];

  if (!file) {
    pendingTripCover = "";
    return;
  }

  if (!file.type.startsWith("image/")) {
    event.target.value = "";
    pendingTripCover = "";
    demoToast("Please choose an image file");
    return;
  }

  try {
    pendingTripCover = await resizeImage(file);
    const preview = document.getElementById("coverPreview");

    if (!preview) {
      return;
    }

    preview.classList.add("has-image");
    preview.innerHTML = `<img src="${pendingTripCover}" alt="Trip cover preview">`;
  } catch {
    pendingTripCover = "";
    demoToast("Could not read this image");
  }
}

function resetTripForm() {
  ["tripName", "tripDestination", "tripStart", "tripEnd", "tripBudget", "tripCover"].forEach((id) => {
    const input = document.getElementById(id);

    if (input) {
      input.value = "";
    }
  });

  pendingTripCover = "";

  const preview = document.getElementById("coverPreview");

  if (preview) {
    preview.classList.remove("has-image");
    preview.innerHTML = `
      <i class="ph-duotone ph-image-square"></i>
      <span>Choose trip cover</span>
      <small>JPG or PNG</small>
    `;
  }
}

function createTripCard(trip) {
  const card = document.createElement("a");
  card.className = "trip-card-link active-trip saved-trip";
  card.dataset.endDate = trip.endDate;
  card.dataset.tripId = trip.id;
  card.href = `trip-detail.html?trip=${encodeURIComponent(trip.id)}`;
  card.innerHTML = `
    <article class="card trip-card">
      <div class="trip-image-wrap">
        <img alt="${escapeHTML(trip.name)} cover" class="cover-image" src="${trip.cover}">
        <span class="pill pink trip-status">Upcoming</span>
      </div>
      <div class="trip-card-body">
        <h2>${escapeHTML(trip.name)}</h2>
        <p><i class="ph-duotone ph-map-pin"></i> ${escapeHTML(trip.destination)}</p>
        <p><i class="ph-duotone ph-calendar-blank"></i> ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</p>
        <p><i class="ph-duotone ph-users-three"></i> Yin, Ploy, Book, Gun</p>
        <span class="card-enter"><i class="ph ph-arrow-up-right"></i></span>
      </div>
    </article>
  `;

  return card;
}

function renderStoredTrips() {
  const grid = document.getElementById("activeTrips");

  if (!grid) {
    return;
  }

  const deleted = getDeletedTripIds();
  grid.querySelectorAll(".saved-trip").forEach((trip) => trip.remove());
  grid.querySelectorAll("[data-trip-id]").forEach((trip) => {
    if (deleted.includes(trip.dataset.tripId)) {
      trip.remove();
    }
  });

  getStoredTrips().forEach((trip) => grid.appendChild(createTripCard(trip)));
}

function createTrip() {
  const name = document.getElementById("tripName")?.value.trim() || "";
  const destination = document.getElementById("tripDestination")?.value.trim() || "";
  const startDate = document.getElementById("tripStart")?.value || "";
  const endDate = document.getElementById("tripEnd")?.value || "";
  const budget = Number(document.getElementById("tripBudget")?.value || 0);

  if (!pendingTripCover) {
    demoToast("Choose a cover photo first");
    return;
  }

  if (!name || !destination || !startDate || !endDate) {
    demoToast("Please fill in all trip details");
    return;
  }

  if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
    demoToast("End date must be after start date");
    return;
  }

  const trips = getStoredTrips();
  const trip = {
    id: `trip-${Date.now()}`,
    name,
    destination,
    startDate,
    endDate,
    budget,
    cover: pendingTripCover,
    members: ["Yin", "Ploy", "Book", "Gun"],
    createdAt: new Date().toISOString()
  };

  try {
    trips.push(trip);
    saveStoredTrips(trips);
  } catch {
    demoToast("Photo is too large. Try another image");
    return;
  }

  renderStoredTrips();
  removeCompletedTrips();
  resetTripForm();
  closeModal("tripModal");
  demoToast("Trip created with your cover photo");
}

function copyCode() {
  const code = document.getElementById("tripInviteCode")?.textContent.trim() || "";
  navigator.clipboard?.writeText(code);
  demoToast("Invite code copied");
}

function vote(button) {
  const count = button.querySelector("span");
  const active = button.classList.toggle("active");
  const icon = button.querySelector("i");

  if (count) {
    count.textContent = Number(count.textContent) + (active ? 1 : -1);
  }

  if (icon) {
    icon.className = active ? "ph-fill ph-heart" : "ph ph-heart";
  }

  button.classList.remove("pop");
  void button.offsetWidth;
  button.classList.add("pop");
}

function activityMarkup(activity) {
  return `
    <time>${escapeHTML(activity.time || "20:30")}</time>
    <div class="card activity">
      <span class="activity-icon lavender">
        <i class="ph-duotone ph-sparkle"></i>
      </span>
      <div>
        <h3>${escapeHTML(activity.title || "New Activity")}</h3>
        <p>${escapeHTML(activity.note || "Add details later")}</p>
      </div>
    </div>
  `;
}

function addActivity() {
  const panel = document.querySelector('[data-trip-panel="planner"].active');
  const timeline = panel?.querySelector(".timeline");
  const tripId = getTripIdFromPanel(panel);

  if (!timeline || !tripId) {
    demoToast("Choose a trip first");
    return;
  }

  panel.querySelector(".module-empty")?.remove();
  const activity = { time: "20:30", title: "New Activity", note: "Add details later" };
  const item = document.createElement("article");
  item.className = "timeline-item saved-activity";
  item.innerHTML = activityMarkup(activity);
  timeline.appendChild(item);

  updateModuleState(tripId, (state) => {
    state.activities = [...(state.activities || []), activity];
    return state;
  });

  demoToast("Activity added to this trip");
}

function addChecklist() {
  const panel = document.querySelector('[data-trip-panel="checklist"].active');
  const checklist = panel?.querySelector(".checklist");
  const tripId = getTripIdFromPanel(panel);

  if (!checklist || !tripId) {
    demoToast("Choose a trip first");
    return;
  }

  checklist.querySelector(".module-empty")?.remove();
  const state = updateModuleState(tripId, (current) => {
    current.checklistItems = [...(current.checklistItems || []), { label: "New packing item", checked: false }];
    return current;
  });
  const index = state.checklistItems.length - 1;
  const item = document.createElement("label");
  item.className = "saved-checklist-item";
  item.innerHTML = `
    <input type="checkbox" data-item-index="${index}">
    <span><i class="ph-duotone ph-package"></i> New packing item</span>
  `;
  checklist.appendChild(item);
  savePackingFromPanel(panel);
  demoToast("Item added to this trip");
}


function plannerPanelMarkup(trip) {
  const state = getModuleState(trip.id);
  const days = Array.from({ length: Math.min(tripDayCount(trip.startDate, trip.endDate), 14) }, (_, index) => `<button class="${index === 0 ? "active" : ""}">Day ${index + 1}</button>`).join("");
  const activities = (state.activities || []).map((activity) => `<article class="timeline-item saved-activity">${activityMarkup(activity)}</article>`).join("");
  const empty = activities ? "" : `<div class="module-empty"><i class="ph-duotone ph-calendar-plus"></i><h3>No activities yet</h3><p>Add the first plan for this trip.</p></div>`;

  return `
    <section class="trip-panel saved-trip-panel" data-trip-panel="planner" data-trip-id="${trip.id}" id="planner-${tripSlug(trip.id)}">
      <div class="trip-section-head">
        <div><span class="pill pink">${escapeHTML(trip.name)}</span><h2>Itinerary</h2></div>
        <span class="trip-date"><i class="ph-duotone ph-calendar"></i> ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</span>
      </div>
      <div class="day-tabs">${days}</div>
      <section class="timeline">${empty}${activities}</section>
    </section>
  `;
}

function expensePanelMarkup(trip) {
  return `
    <section class="trip-panel saved-trip-panel" data-trip-panel="expense" data-trip-id="${trip.id}" id="expense-${tripSlug(trip.id)}">
      <div class="trip-section-head">
        <div><span class="pill pink">${escapeHTML(trip.name)}</span><h2>Trip Wallet</h2></div>
        <span class="trip-date"><i class="ph-duotone ph-calendar"></i> ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</span>
      </div>
      <section class="grid finance-summary">
        <article class="card"><span class="summary-icon pink"><i class="ph-duotone ph-receipt"></i></span><p class="muted">Total Expenses</p><h2>฿0</h2></article>
        <article class="card"><span class="summary-icon blue"><i class="ph-duotone ph-hand-coins"></i></span><p class="muted">You Paid</p><h2>฿0</h2></article>
        <article class="card"><span class="summary-icon yellow"><i class="ph-duotone ph-arrow-circle-up"></i></span><p class="muted">You Owe</p><h2>฿0</h2></article>
        <article class="card"><span class="summary-icon mint"><i class="ph-duotone ph-arrow-circle-down"></i></span><p class="muted">You Receive</p><h2>฿0</h2></article>
      </section>
      <section class="card module-empty expense-empty"><i class="ph-duotone ph-receipt"></i><h3>No expenses yet</h3><p>Add the first expense for ${escapeHTML(trip.name)}.</p></section>
      <section class="settlement-wrap">
        <div class="settlement-heading"><div><span class="eyebrow">Settle up</span><h2>Who pays whom</h2></div></div>
        <div class="card settle-empty"><i class="ph-duotone ph-handshake"></i><div><strong>All clear</strong><p>No balances to settle yet.</p></div></div>
      </section>
    </section>
  `;
}

function checklistPanelMarkup(trip) {
  const state = getModuleState(trip.id);
  const items = (state.checklistItems || []).map((item, index) => `
    <label class="saved-checklist-item">
      <input type="checkbox" data-item-index="${index}" ${item.checked ? "checked" : ""}>
      <span><i class="ph-duotone ph-package"></i> ${escapeHTML(item.label)}</span>
    </label>
  `).join("");
  const empty = items ? "" : `<div class="module-empty"><i class="ph-duotone ph-backpack"></i><h3>No packing items yet</h3><p>Start a checklist for this trip.</p></div>`;

  return `
    <section class="trip-panel saved-trip-panel" data-trip-panel="checklist" data-trip-id="${trip.id}" id="check-${tripSlug(trip.id)}">
      <div class="trip-section-head">
        <div><span class="pill pink">${escapeHTML(trip.name)}</span><h2>Packing List</h2></div>
        <span class="trip-date">${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</span>
      </div>
      <section class="card checklist">${empty}${items}</section>
    </section>
  `;
}

function tripSwitchMarkup(trip, group) {
  const targetPrefix = group === "planner" ? "planner" : group === "expense" ? "expense" : "check";
  let detail = formatTripDate(trip.startDate, trip.endDate).replace(/ 2026$/, "");

  if (group === "expense") {
    detail = "฿0 spent";
  }

  if (group === "checklist") {
    const stats = getTripStats(trip.id);
    detail = `${stats.packingPercent}% packed`;
  }

  return `
    <button class="trip-switch active-trip saved-trip-switch" data-trip-id="${trip.id}" data-end-date="${trip.endDate}" data-target="${targetPrefix}-${tripSlug(trip.id)}" onclick="switchTripPanel(this,'${group}')">
      <img alt="${escapeHTML(trip.name)}" src="${trip.cover}">
      <span><strong>${escapeHTML(trip.name)}</strong><small>${escapeHTML(detail)}</small></span>
      <i class="ph ph-caret-right"></i>
    </button>
  `;
}

function renderStoredTripModules() {
  const trips = getStoredTrips();
  const config = {
    planner: { page: "planner", panel: plannerPanelMarkup },
    expense: { page: "expense", panel: expensePanelMarkup },
    checklist: { page: "checklist", panel: checklistPanelMarkup }
  };

  Object.entries(config).forEach(([group, setup]) => {
    const switcher = document.querySelector(`.trip-switcher[data-trip-group="${group}"]`);

    if (!switcher) {
      return;
    }

    document.querySelectorAll(`[data-trip-panel="${group}"].saved-trip-panel`).forEach((panel) => panel.remove());
    switcher.querySelectorAll(".saved-trip-switch").forEach((button) => button.remove());

    trips.forEach((trip) => {
      switcher.insertAdjacentHTML("beforeend", tripSwitchMarkup(trip, group));
      document.querySelector(".content")?.insertAdjacentHTML("beforeend", setup.panel(trip));
    });
  });
}

function restoreSavedAdditions() {
  ["samet", "bkk"].forEach((tripId) => {
    const state = getModuleState(tripId);
    const planner = document.querySelector(`[data-trip-panel="planner"][data-trip-id="${tripId}"] .timeline`);

    if (planner && !planner.querySelector(".saved-activity")) {
      (state.activities || []).forEach((activity) => {
        const item = document.createElement("article");
        item.className = "timeline-item saved-activity";
        item.innerHTML = activityMarkup(activity);
        planner.appendChild(item);
      });
    }

    const checklist = document.querySelector(`[data-trip-panel="checklist"][data-trip-id="${tripId}"] .checklist`);

    if (checklist && !checklist.querySelector(".saved-checklist-item")) {
      (state.checklistItems || []).forEach((itemData, index) => {
        const item = document.createElement("label");
        item.className = "saved-checklist-item";
        item.innerHTML = `<input type="checkbox" data-item-index="${index}" ${itemData.checked ? "checked" : ""}><span><i class="ph-duotone ph-package"></i> ${escapeHTML(itemData.label)}</span>`;
        checklist.appendChild(item);
      });
    }
  });
}

function savePackingFromPanel(panel) {
  const tripId = getTripIdFromPanel(panel);
  const inputs = [...(panel?.querySelectorAll(".checklist input[type='checkbox']") || [])];

  if (!tripId) {
    return;
  }

  updateModuleState(tripId, (state) => {
    inputs.forEach((input) => {
      const index = input.dataset.itemIndex;
      if (index !== undefined && state.checklistItems?.[Number(index)]) {
        state.checklistItems[Number(index)].checked = input.checked;
      }
    });
    state.packing = { checked: inputs.filter((input) => input.checked).length, total: inputs.length };
    return state;
  });

  const switchButton = document.querySelector(`.trip-switcher[data-trip-group="checklist"] .trip-switch[data-trip-id="${tripId}"] small`);
  if (switchButton) {
    switchButton.textContent = `${getTripStats(tripId).packingPercent}% packed`;
  }
}

function removeDeletedTripUI() {
  const deleted = getDeletedTripIds();
  document.querySelectorAll("[data-trip-id]").forEach((element) => {
    if (deleted.includes(element.dataset.tripId)) {
      element.remove();
    }
  });
}

function selectTripFromQuery() {
  const tripId = new URLSearchParams(window.location.search).get("trip");

  if (!tripId) {
    return;
  }

  document.querySelectorAll(`.trip-switch[data-trip-id="${tripId}"]`).forEach((button) => {
    const switcher = button.closest(".trip-switcher");
    const group = switcher?.dataset.tripGroup;
    if (group) {
      switchTripPanel(button, group);
    }
  });

  const expenseSelect = document.getElementById("expenseTripSelect");
  if (expenseSelect && [...expenseSelect.options].some((option) => option.value === tripId)) {
    expenseSelect.value = tripId;
  }
}

function syncExpenseTripSelect() {
  const select = document.getElementById("expenseTripSelect");

  if (!select) {
    return;
  }

  const existing = new Set([...select.options].map((option) => option.value));
  getStoredTrips().forEach((trip) => {
    if (!existing.has(trip.id)) {
      const option = document.createElement("option");
      option.value = trip.id;
      option.textContent = trip.name;
      select.appendChild(option);
    }
  });
}

function requestDeleteCurrentTrip() {
  const tripId = new URLSearchParams(window.location.search).get("trip") || "samet";
  const button = document.querySelector(".trip-detail-actions .danger");
  if (button) {
    button.dataset.tripId = tripId;
  }
  openModal("deleteTripModal");
}

function deleteTripById(tripId) {
  if (DEFAULT_TRIPS[tripId]) {
    const deleted = new Set(getDeletedTripIds());
    deleted.add(tripId);
    saveDeletedTripIds([...deleted]);
  } else {
    saveStoredTrips(getStoredTrips().filter((trip) => trip.id !== tripId));
  }

  const states = getModuleStates();
  delete states[tripId];
  saveModuleStates(states);

  if (typeof getFinanceData === "function" && typeof saveFinanceData === "function") {
    const finance = getFinanceData();
    delete finance.expenses[tripId];
    finance.payments = (finance.payments || []).filter((payment) => payment.tripId !== tripId);
    saveFinanceData(finance);
  }
}

function confirmDeleteTrip() {
  const tripId = document.querySelector(".trip-detail-actions .danger")?.dataset.tripId || new URLSearchParams(window.location.search).get("trip") || "samet";
  deleteTripById(tripId);
  closeModal("deleteTripModal");
  window.location.href = "trips.html";
}

function markPaid() {
  closeModal("payModal");
  demoToast("Payment marked as paid");
}

function setTheme(theme, notify = true) {
  const availableThemes = ["sakura", "ocean", "matcha", "lavender", "peach", "berry"];
  const selectedTheme = availableThemes.includes(theme) ? theme : "sakura";
  document.documentElement.dataset.theme = selectedTheme;
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeChoice === selectedTheme);
  });
  if (notify) demoToast("Theme updated");
}

function switchTripPanel(button, group) {
  const switcher = button.closest(".trip-switcher");

  switcher?.querySelectorAll(".trip-switch").forEach((item) => {
    item.classList.remove("active");
  });

  button.classList.add("active");

  document.querySelectorAll(`[data-trip-panel="${group}"]`).forEach((panel) => {
    panel.classList.remove("active");
  });

  document.getElementById(button.dataset.target)?.classList.add("active");
}

function repairTripGroups() {
  document.querySelectorAll(".trip-switcher").forEach((switcher) => {
    const buttons = [...switcher.querySelectorAll(".trip-switch")];

    if (!buttons.length) {
      return;
    }

    const hasActiveButton = buttons.some((button) => button.classList.contains("active"));

    if (hasActiveButton) {
      return;
    }

    const firstButton = buttons[0];
    const group = switcher.dataset.tripGroup;

    firstButton.classList.add("active");

    document.querySelectorAll(`[data-trip-panel="${group}"]`).forEach((panel) => {
      panel.classList.remove("active");
    });

    document.getElementById(firstButton.dataset.target)?.classList.add("active");
  });
}

function removeCompletedTrips() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  document.querySelectorAll(".active-trip[data-end-date]").forEach((trip) => {
    const endDate = new Date(`${trip.dataset.endDate}T23:59:59`);

    if (endDate < today) {
      trip.classList.add("removing");

      setTimeout(() => {
        trip.remove();
        repairTripGroups();
      }, 350);
    }
  });

  setTimeout(() => {
    const grid = document.getElementById("activeTrips");
    const emptyState = document.getElementById("tripEmpty");

    if (grid && emptyState && grid.querySelectorAll(".active-trip").length === 0) {
      emptyState.hidden = false;
    }
  }, 420);
}

function filterMemories(button, trip) {
  document.querySelectorAll(".memory-filter button").forEach((item) => {
    item.classList.remove("active");
  });

  button.classList.add("active");

  document.querySelectorAll(".memory-item").forEach((item) => {
    item.classList.toggle("hidden", trip !== "all" && item.dataset.trip !== trip);
  });
}

function openMemory(card) {
  const image = card.querySelector("img");
  const caption = card.querySelector("p")?.textContent || "";
  const trip = card.querySelector(".memory-trip")?.textContent.trim() || "";
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxTrip = document.getElementById("lightboxTrip");

  if (image && lightboxImage) {
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
  }

  if (lightboxCaption) {
    lightboxCaption.textContent = caption;
  }

  if (lightboxTrip) {
    lightboxTrip.textContent = trip;
  }

  document.getElementById("memoryLightbox")?.classList.add("open");
}

function closeMemory(event, force = false) {
  if (force || event.target.id === "memoryLightbox") {
    document.getElementById("memoryLightbox")?.classList.remove("open");
  }
}

function openPayment(name, amount) {
  const title = document.getElementById("payTitle");
  const paymentAmount = document.getElementById("payAmount");

  if (title) {
    title.textContent = `Pay ${name}`;
  }

  if (paymentAmount) {
    paymentAmount.textContent = `฿${amount}`;
  }

  openModal("payModal");
}

function makeInviteCode(trip) {
  const letters = trip.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) || "TRIP";
  return `${letters}${String(trip.id).slice(-2)}`;
}

function loadStoredTripDetail() {
  const params = new URLSearchParams(window.location.search);
  const tripId = params.get("trip") || "samet";
  const trip = getTripById(tripId);

  if (!document.getElementById("tripDetailBanner")) {
    return;
  }

  if (!trip) {
    window.location.href = "trips.html";
    return;
  }

  const banner = document.getElementById("tripDetailBanner");
  banner.style.setProperty("--banner", `url('${trip.cover}')`);
  const title = banner.querySelector("h1");
  const details = banner.querySelector("p");
  const status = banner.querySelector(".pill");

  if (title) {
    title.textContent = trip.name;
  }

  if (details) {
    details.innerHTML = `
      <i class="ph-duotone ph-calendar-blank"></i>
      ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}
      <i class="ph-duotone ph-map-pin"></i>
      ${escapeHTML(trip.destination)}
    `;
  }

  if (status) {
    status.textContent = "Upcoming";
  }

  const budget = document.getElementById("tripBudgetDetail");
  const inviteCode = document.getElementById("tripInviteCode");
  const activities = document.getElementById("tripActivitiesDetail");
  const packing = document.getElementById("tripPackingDetail");
  const stats = getTripStats(tripId);

  if (budget) {
    budget.textContent = `฿${Number(trip.budget || 0).toLocaleString()}`;
  }

  if (inviteCode) {
    inviteCode.textContent = trip.inviteCode || makeInviteCode(trip);
  }

  if (activities) {
    activities.textContent = stats.activities;
  }

  if (packing) {
    packing.textContent = `${stats.packingPercent}%`;
  }

  const links = {
    plannerQuickLink: "planner.html",
    expensesQuickLink: "expenses.html",
    checklistQuickLink: "checklist.html"
  };

  Object.entries(links).forEach(([id, page]) => {
    const link = document.getElementById(id);
    if (link) {
      link.href = `${page}?trip=${encodeURIComponent(tripId)}`;
    }
  });

  const deleteButton = document.querySelector(".trip-detail-actions .danger");
  if (deleteButton) {
    deleteButton.dataset.tripId = tripId;
  }

  document.title = `${trip.name} · JoyJourney`;
}

window.addEventListener("click", (event) => {
  if (event.target.classList?.contains("modal")) {
    event.target.classList.remove("open");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  renderStoredTrips();
  renderStoredTripModules();
  restoreSavedAdditions();
  syncExpenseTripSelect();
  removeDeletedTripUI();
  removeCompletedTrips();
  repairTripGroups();
  selectTripFromQuery();
  loadStoredTripDetail();

  document.querySelectorAll('[data-trip-panel="checklist"] .checklist').forEach((checklist) => {
    checklist.addEventListener("change", () => savePackingFromPanel(checklist.closest('[data-trip-panel="checklist"]')));
  });
});
