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

  clearTimeout(demoToast.timer);
  demoToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
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

/* =========================================================
   Trip data (loaded from the server / MySQL)
   ========================================================= */

let JJ_TRIPS = [];
let JJ_TRIPS_ERROR = null;
let pendingTripCover = "";
let currentDetailTrip = null;
let pendingConfirmAction = null;

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function getAllTrips() {
  return JJ_TRIPS;
}

function getActiveTrips() {
  return JJ_TRIPS.filter((trip) => trip.status === "active");
}

function getTripById(tripId) {
  return JJ_TRIPS.find((trip) => trip.id === String(tripId)) || null;
}

function upsertTripInCache(trip) {
  const index = JJ_TRIPS.findIndex((item) => item.id === trip.id);
  if (index >= 0) {
    JJ_TRIPS[index] = trip;
  } else {
    JJ_TRIPS.push(trip);
  }
}

function removeTripFromCache(tripId) {
  JJ_TRIPS = JJ_TRIPS.filter((trip) => trip.id !== String(tripId));
}

function isTripOwner(trip) {
  return trip?.myRole === "owner";
}

function tripPhase(trip) {
  if (trip.status === "finished") {
    return { label: "Finished", tone: "lavender" };
  }
  if (trip.startDate > todayISO()) {
    return { label: "Upcoming", tone: "pink" };
  }
  return { label: "Ongoing", tone: "mint" };
}

function memberNames(trip, limit = 4) {
  const names = (trip.members || []).map((member) => member.name);
  if (names.length <= limit) {
    return names.join(", ");
  }
  return `${names.slice(0, limit).join(", ")} +${names.length - limit}`;
}

/* Planner and checklist content is still kept per trip in this browser */

const DEMO_MODULE_SEEDS = {
  SAMET26: {
    activities: [
      { time: "09:00", title: "Meet at Mo Chit", note: "Travel to Ban Phe Pier", icon: "bus", tone: "blue" },
      { time: "12:30", title: "Lunch by the pier", note: "Quick meal before ferry", icon: "bowl-food", tone: "yellow" },
      { time: "15:00", title: "Ao Phai Beach", note: "Swim, relax and photos", icon: "umbrella", tone: "pink" }
    ],
    checklistItems: [
      { label: "Camera", checked: true, icon: "camera" },
      { label: "Charger", checked: true, icon: "plug" },
      { label: "Sunscreen", checked: false, icon: "sun" },
      { label: "Hat", checked: false, icon: "baseball-cap" },
      { label: "Sandals", checked: true, icon: "sneaker" }
    ]
  },
  BKK26: {
    activities: [
      { time: "10:00", title: "Cafe hopping", note: "Ari neighborhood", icon: "coffee", tone: "lavender" },
      { time: "17:30", title: "River walk", note: "Sunset by Chao Phraya", icon: "buildings", tone: "blue" }
    ],
    checklistItems: [
      { label: "Camera", checked: true, icon: "camera" },
      { label: "Power bank", checked: false, icon: "battery-charging" },
      { label: "Umbrella", checked: true, icon: "umbrella" },
      { label: "Tote bag", checked: false, icon: "shopping-bag" }
    ]
  }
};

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

function emptyModuleState() {
  return { activities: [], checklistItems: [] };
}

function getModuleState(tripId) {
  const states = getModuleStates();
  if (states[tripId]) {
    return states[tripId];
  }
  const seed = DEMO_MODULE_SEEDS[getTripById(tripId)?.inviteCode];
  if (seed) {
    states[tripId] = JSON.parse(JSON.stringify(seed));
    saveModuleStates(states);
    return states[tripId];
  }
  return emptyModuleState();
}

function updateModuleState(tripId, updater) {
  const states = getModuleStates();
  const current = states[tripId] || getModuleState(tripId);
  states[tripId] = updater(current) || current;
  saveModuleStates(states);
  return states[tripId];
}

function clearModuleState(tripId) {
  const states = getModuleStates();
  delete states[tripId];
  saveModuleStates(states);
}

function getTripStats(tripId) {
  const state = getModuleState(tripId);
  const items = state.checklistItems || [];
  const checked = items.filter((item) => item.checked).length;
  return {
    activities: (state.activities || []).length,
    packed: checked,
    packingTotal: items.length,
    packingPercent: items.length ? Math.round((checked / items.length) * 100) : 0
  };
}

/* =========================================================
   Small utilities
   ========================================================= */

function getTripIdFromPanel(panel) {
  return panel?.dataset.tripId || "";
}

function tripSlug(tripId) {
  return String(tripId).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function tripDayCount(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function escapeHTML(value) {
  return String(value ?? "")
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
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-GB", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
    year: sameYear ? undefined : "numeric"
  });
  const endText = end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  if (startDate === endDate) {
    return endText;
  }
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

function setButtonBusy(button, busy, busyText = "Saving...") {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="ph ph-spinner-gap spin"></i> ${busyText}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

/* =========================================================
   Create / edit trip form (cover photo)
   ========================================================= */

async function previewTripCover(event, previewId = "coverPreview") {
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
    showCoverPreview(previewId, pendingTripCover);
  } catch {
    pendingTripCover = "";
    demoToast("Could not read this image");
  }
}

function showCoverPreview(previewId, src) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.classList.add("has-image");
  preview.innerHTML = `<img src="${escapeHTML(src)}" alt="Trip cover preview">`;
}

function resetTripForm() {
  ["tripName", "tripDestination", "tripStart", "tripEnd", "tripBudget", "tripCover"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });

  pendingTripCover = "";

  const preview = document.getElementById("coverPreview");
  if (preview) {
    preview.classList.remove("has-image");
    preview.innerHTML = `
      <i class="ph-duotone ph-image-square"></i>
      <span>Choose trip cover</span>
      <small>JPG or PNG · optional</small>
    `;
  }
}

function readTripForm(prefix) {
  const value = (id) => document.getElementById(`${prefix}${id}`)?.value ?? "";
  return {
    name: value("Name").trim(),
    destination: value("Destination").trim(),
    startDate: value("Start"),
    endDate: value("End"),
    budget: value("Budget") === "" ? 0 : Number(value("Budget"))
  };
}

function validateTripForm(trip) {
  if (!trip.name || !trip.destination || !trip.startDate || !trip.endDate) {
    return "Please fill in all trip details";
  }
  if (trip.endDate < trip.startDate) {
    return "End date must be after start date";
  }
  if (Number.isNaN(trip.budget) || trip.budget < 0) {
    return "Budget must be 0 or more";
  }
  return "";
}

async function createTrip(button) {
  const trip = readTripForm("trip");
  const problem = validateTripForm(trip);
  if (problem) {
    demoToast(problem);
    return;
  }
  if (trip.endDate < todayISO()) {
    demoToast("This trip would already be finished. Pick dates from today onwards");
    return;
  }

  setButtonBusy(button, true, "Creating...");
  try {
    const created = await JoyTripsAPI.create({ ...trip, cover: pendingTripCover || undefined });
    upsertTripInCache(created);
    renderTripsPage();
    resetTripForm();
    closeModal("tripModal");
    demoToast(`Trip created! Invite code: ${created.inviteCode}`);
    setTimeout(() => {
      window.location.href = `trip-detail.html?trip=${encodeURIComponent(created.id)}`;
    }, 900);
  } catch (error) {
    demoToast(error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

/* =========================================================
   Join trip with invite code
   ========================================================= */

function openJoinModal() {
  const input = document.getElementById("joinCode");
  const message = document.getElementById("joinMessage");
  if (input) input.value = "";
  if (message) message.textContent = "";
  openModal("joinTripModal");
  setTimeout(() => input?.focus(), 50);
}

async function joinTrip(event, button) {
  event?.preventDefault();
  const input = document.getElementById("joinCode");
  const message = document.getElementById("joinMessage");
  const code = (input?.value || "").trim().toUpperCase();

  if (!code) {
    if (message) {
      message.textContent = "Please enter an invite code.";
      message.className = "form-message error";
    }
    return;
  }

  setButtonBusy(button, true, "Joining...");
  try {
    const alreadyIn = JJ_TRIPS.some((trip) => trip.inviteCode === code);
    const trip = await JoyTripsAPI.join(code);
    upsertTripInCache(trip);
    renderTripsPage();
    closeModal("joinTripModal");
    demoToast(alreadyIn ? `You are already in ${trip.name}` : `Joined ${trip.name}!`);
    setTimeout(() => {
      window.location.href = `trip-detail.html?trip=${encodeURIComponent(trip.id)}`;
    }, 700);
  } catch (error) {
    if (message) {
      message.textContent = error.message;
      message.className = "form-message error";
    }
  } finally {
    setButtonBusy(button, false);
  }
}

/* =========================================================
   My Trips page
   ========================================================= */

function createTripCard(trip) {
  const phase = tripPhase(trip);
  const card = document.createElement("a");
  card.className = `trip-card-link ${trip.status === "active" ? "active-trip" : "finished-trip"}`;
  card.dataset.tripId = trip.id;
  card.href = `trip-detail.html?trip=${encodeURIComponent(trip.id)}`;
  card.innerHTML = `
    <article class="card trip-card">
      <div class="trip-image-wrap">
        <img alt="${escapeHTML(trip.name)} cover" class="cover-image" src="${escapeHTML(trip.cover)}">
        <span class="pill ${phase.tone} trip-status">${phase.label}</span>
        <span class="pill ${isTripOwner(trip) ? "yellow" : "blue"} trip-role">
          <i class="ph-fill ${isTripOwner(trip) ? "ph-crown-simple" : "ph-user"}"></i>
          ${isTripOwner(trip) ? "Owner" : "Member"}
        </span>
      </div>
      <div class="trip-card-body">
        <h2>${escapeHTML(trip.name)}</h2>
        <p><i class="ph-duotone ph-map-pin"></i> ${escapeHTML(trip.destination)}</p>
        <p><i class="ph-duotone ph-calendar-blank"></i> ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</p>
        <p><i class="ph-duotone ph-users-three"></i> ${escapeHTML(memberNames(trip))}</p>
        <span class="card-enter"><i class="ph ph-arrow-up-right"></i></span>
      </div>
    </article>
  `;
  return card;
}

function renderTripsPage() {
  const activeGrid = document.getElementById("activeTrips");
  if (!activeGrid) {
    return;
  }

  const finishedGrid = document.getElementById("finishedTrips");
  const finishedSection = document.getElementById("finishedSection");
  const emptyState = document.getElementById("tripEmpty");
  const active = getActiveTrips();
  const finished = JJ_TRIPS.filter((trip) => trip.status === "finished");

  activeGrid.innerHTML = "";
  active.forEach((trip) => activeGrid.appendChild(createTripCard(trip)));

  if (finishedGrid) {
    finishedGrid.innerHTML = "";
    finished.forEach((trip) => finishedGrid.appendChild(createTripCard(trip)));
  }
  if (finishedSection) {
    finishedSection.hidden = finished.length === 0;
  }

  const activeCount = document.getElementById("activeCount");
  const finishedCount = document.getElementById("finishedCount");
  if (activeCount) activeCount.textContent = active.length;
  if (finishedCount) finishedCount.textContent = finished.length;

  if (emptyState) {
    emptyState.hidden = active.length > 0;
    const title = emptyState.querySelector("h2");
    const text = emptyState.querySelector("p");
    if (JJ_TRIPS_ERROR) {
      if (title) title.textContent = "Could not load trips";
      if (text) text.textContent = JJ_TRIPS_ERROR.message;
    }
  }
}

/* =========================================================
   Planner & Checklist pages (one panel per active trip)
   ========================================================= */

function activityMarkup(activity) {
  return `
    <time>${escapeHTML(activity.time || "20:30")}</time>
    <div class="card activity">
      <span class="activity-icon ${escapeHTML(activity.tone || "lavender")}">
        <i class="ph-duotone ph-${escapeHTML(activity.icon || "sparkle")}"></i>
      </span>
      <div>
        <h3>${escapeHTML(activity.title || "New Activity")}</h3>
        <p>${escapeHTML(activity.note || "Add details later")}</p>
      </div>
    </div>
  `;
}

function checklistItemMarkup(item, index) {
  return `
    <label class="saved-checklist-item">
      <input type="checkbox" data-item-index="${index}" ${item.checked ? "checked" : ""}>
      <span><i class="ph-duotone ph-${escapeHTML(item.icon || "package")}"></i> ${escapeHTML(item.label)}</span>
    </label>
  `;
}

function tripSectionHead(trip, title) {
  return `
    <div class="trip-section-head">
      <div><span class="pill pink">${escapeHTML(trip.name)}</span><h2>${title}</h2></div>
      <span class="trip-date"><i class="ph-duotone ph-calendar"></i> ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</span>
    </div>
  `;
}

function plannerPanelMarkup(trip) {
  const state = getModuleState(trip.id);
  const days = Array.from({ length: Math.min(tripDayCount(trip.startDate, trip.endDate), 14) }, (_, index) => `<button class="${index === 0 ? "active" : ""}">Day ${index + 1}</button>`).join("");
  const activities = (state.activities || []).map((activity) => `<article class="timeline-item saved-activity">${activityMarkup(activity)}</article>`).join("");
  const empty = activities ? "" : `<div class="module-empty"><i class="ph-duotone ph-calendar-plus"></i><h3>No activities yet</h3><p>Add the first plan for this trip.</p></div>`;

  return `
    <section class="trip-panel" data-trip-panel="planner" data-trip-id="${escapeHTML(trip.id)}" id="planner-${tripSlug(trip.id)}">
      ${tripSectionHead(trip, "Itinerary")}
      <div class="day-tabs">${days}</div>
      <section class="timeline">${empty}${activities}</section>
    </section>
  `;
}

function checklistPanelMarkup(trip) {
  const state = getModuleState(trip.id);
  const items = (state.checklistItems || []).map(checklistItemMarkup).join("");
  const empty = items ? "" : `<div class="module-empty"><i class="ph-duotone ph-backpack"></i><h3>No packing items yet</h3><p>Start a checklist for this trip.</p></div>`;

  return `
    <section class="trip-panel" data-trip-panel="checklist" data-trip-id="${escapeHTML(trip.id)}" id="check-${tripSlug(trip.id)}">
      ${tripSectionHead(trip, "Packing List")}
      <section class="card checklist">${empty}${items}</section>
    </section>
  `;
}

function tripSwitchMarkup(trip, group) {
  const targetPrefix = group === "planner" ? "planner" : "check";
  let detail = formatTripDate(trip.startDate, trip.endDate);

  if (group === "checklist") {
    const stats = getTripStats(trip.id);
    detail = `${stats.packed} of ${stats.packingTotal} packed`;
  }

  return `
    <button class="trip-switch active-trip" data-trip-id="${escapeHTML(trip.id)}" data-target="${targetPrefix}-${tripSlug(trip.id)}" onclick="switchTripPanel(this,'${group}')">
      <img alt="${escapeHTML(trip.name)}" src="${escapeHTML(trip.cover)}">
      <span><strong>${escapeHTML(trip.name)}</strong><small>${escapeHTML(detail)}</small></span>
      <i class="ph ph-caret-right"></i>
    </button>
  `;
}

function noTripsMarkup() {
  const message = JJ_TRIPS_ERROR
    ? `<h3>Could not load trips</h3><p>${escapeHTML(JJ_TRIPS_ERROR.message)}</p>`
    : `<h3>No active trips</h3><p>Create a trip or join one with an invite code first.</p><a class="btn primary small" href="trips.html"><i class="ph-bold ph-plus"></i> Go to My Trips</a>`;
  return `<section class="card module-empty trip-module-empty"><i class="ph-duotone ph-suitcase"></i>${message}</section>`;
}

function renderTripModules() {
  const config = {
    planner: plannerPanelMarkup,
    checklist: checklistPanelMarkup
  };
  const trips = getActiveTrips();

  Object.entries(config).forEach(([group, panelMarkup]) => {
    const switcher = document.querySelector(`.trip-switcher[data-trip-group="${group}"]`);
    if (!switcher) {
      return;
    }

    document.querySelectorAll(`[data-trip-panel="${group}"]`).forEach((panel) => panel.remove());
    document.querySelectorAll(".trip-module-empty").forEach((element) => element.remove());
    switcher.innerHTML = trips.map((trip) => tripSwitchMarkup(trip, group)).join("");

    if (!trips.length) {
      switcher.insertAdjacentHTML("afterend", noTripsMarkup());
      return;
    }

    const html = trips.map(panelMarkup).join("");
    const content = document.querySelector(".content");
    content?.insertAdjacentHTML("beforeend", html);
  });

  repairTripGroups();
  selectTripFromQuery();
}

function addActivity() {
  const panel = document.querySelector('[data-trip-panel="planner"].active');
  const timeline = panel?.querySelector(".timeline");
  const tripId = getTripIdFromPanel(panel);

  if (!timeline || !tripId) {
    demoToast("Create or join a trip first");
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
    demoToast("Create or join a trip first");
    return;
  }

  checklist.querySelector(".module-empty")?.remove();
  const state = updateModuleState(tripId, (current) => {
    current.checklistItems = [...(current.checklistItems || []), { label: "New packing item", checked: false }];
    return current;
  });
  const index = state.checklistItems.length - 1;
  checklist.insertAdjacentHTML("beforeend", checklistItemMarkup(state.checklistItems[index], index));
  savePackingFromPanel(panel);
  demoToast("Item added to this trip");
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
    return state;
  });

  const switchLabel = document.querySelector(`.trip-switcher[data-trip-group="checklist"] .trip-switch[data-trip-id="${tripId}"] small`);
  if (switchLabel) {
    const stats = getTripStats(tripId);
    switchLabel.textContent = `${stats.packed} of ${stats.packingTotal} packed`;
  }
}

function selectTripFromQuery() {
  const tripId = new URLSearchParams(window.location.search).get("trip");

  if (!tripId) {
    return;
  }

  document.querySelectorAll(`.trip-switch[data-trip-id="${CSS.escape(tripId)}"]`).forEach((button) => {
    const group = button.closest(".trip-switcher")?.dataset.tripGroup;
    if (group) {
      switchTripPanel(button, group);
    }
  });
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
  document.querySelectorAll(".trip-switcher[data-trip-group]").forEach((switcher) => {
    const buttons = [...switcher.querySelectorAll(".trip-switch")];

    if (!buttons.length || buttons.some((button) => button.classList.contains("active"))) {
      return;
    }

    switchTripPanel(buttons[0], switcher.dataset.tripGroup);
  });
}

/* =========================================================
   Trip Detail page
   ========================================================= */

function getDetailTripId() {
  return new URLSearchParams(window.location.search).get("trip") || "";
}

async function loadTripDetail() {
  const banner = document.getElementById("tripDetailBanner");
  if (!banner) {
    return;
  }

  const tripId = getDetailTripId();
  if (!tripId) {
    window.location.href = "trips.html";
    return;
  }

  try {
    currentDetailTrip = await JoyTripsAPI.get(tripId);
    upsertTripInCache(currentDetailTrip);
    renderTripDetail();
  } catch (error) {
    showDetailError(error);
  }
}

function showDetailError(error) {
  const content = document.querySelector(".content");
  if (!content) return;
  const title = error.status === 403 ? "You are not in this trip" : error.status === 404 ? "Trip not found" : "Could not load this trip";
  const text = error.status === 403
    ? "Ask the owner for the invite code, then join from My Trips."
    : error.message;
  content.innerHTML = `
    <section class="card module-empty detail-error">
      <i class="ph-duotone ph-suitcase"></i>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(text)}</p>
      <a class="btn primary small" href="trips.html"><i class="ph ph-arrow-left"></i> Back to My Trips</a>
    </section>
  `;
}

function renderTripDetail() {
  const trip = currentDetailTrip;
  if (!trip) return;
  const owner = isTripOwner(trip);
  const phase = tripPhase(trip);

  const banner = document.getElementById("tripDetailBanner");
  banner.style.setProperty("--banner", `url('${String(trip.cover).replace(/'/g, "%27")}')`);
  banner.classList.toggle("is-finished", trip.status === "finished");

  const pills = document.getElementById("tripDetailPills");
  if (pills) {
    pills.innerHTML = `
      <span class="pill ${phase.tone}">${phase.label}</span>
      <span class="pill ${owner ? "yellow" : "blue"}"><i class="ph-fill ${owner ? "ph-crown-simple" : "ph-user"}"></i> ${owner ? "You are the owner" : "You are a member"}</span>
    `;
  }

  const title = document.getElementById("tripDetailName");
  if (title) title.textContent = trip.name;

  const details = document.getElementById("tripDetailMeta");
  if (details) {
    details.innerHTML = `
      <i class="ph-duotone ph-calendar-blank"></i>
      ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}
      <i class="ph-duotone ph-map-pin"></i>
      ${escapeHTML(trip.destination)}
    `;
  }

  const inviteCode = document.getElementById("tripInviteCode");
  if (inviteCode) inviteCode.textContent = trip.inviteCode;
  const regen = document.getElementById("regenInviteBtn");
  if (regen) regen.hidden = !owner;

  renderDetailActions(trip);
  renderTripMembers(trip);

  const budget = document.getElementById("tripBudgetDetail");
  const activities = document.getElementById("tripActivitiesDetail");
  const packing = document.getElementById("tripPackingDetail");
  const statusText = document.getElementById("tripStatusDetail");
  const stats = getTripStats(trip.id);

  if (budget) budget.textContent = `฿${Number(trip.budget || 0).toLocaleString()}`;
  if (activities) activities.textContent = stats.activities;
  if (packing) packing.textContent = `${stats.packingPercent}%`;
  if (statusText) statusText.textContent = trip.status === "finished" ? "Finished" : "Active";

  const links = {
    plannerQuickLink: "planner.html",
    expensesQuickLink: "expenses.html",
    checklistQuickLink: "checklist.html"
  };
  Object.entries(links).forEach(([id, page]) => {
    const link = document.getElementById(id);
    if (link) {
      link.href = `${page}?trip=${encodeURIComponent(trip.id)}`;
      const onlyActive = page !== "expenses.html";
      link.classList.toggle("is-disabled", onlyActive && trip.status === "finished");
      link.title = onlyActive && trip.status === "finished" ? "Finished trips are hidden from this page" : "";
    }
  });

  if (typeof updateFinanceOverview === "function") {
    updateFinanceOverview();
  }

  document.title = `${trip.name} · JoyJourney`;
}

function renderDetailActions(trip) {
  const box = document.getElementById("tripDetailActions");
  if (!box) return;

  const editButton = `<button class="btn soft" onclick="openEditTrip()"><i class="ph-duotone ph-pencil-simple"></i> Edit Trip</button>`;
  const statusButton = trip.status === "active"
    ? `<button class="btn soft" onclick="changeTripStatus('finished', this)"><i class="ph-duotone ph-flag-checkered"></i> Mark as Finished</button>`
    : `<button class="btn soft" onclick="changeTripStatus('active', this)"><i class="ph-duotone ph-arrow-counter-clockwise"></i> Make Active Again</button>`;
  const lastButton = isTripOwner(trip)
    ? `<button class="btn danger" onclick="requestDeleteCurrentTrip()"><i class="ph-duotone ph-trash"></i> Delete Trip</button>`
    : `<button class="btn danger" onclick="requestLeaveTrip()"><i class="ph-duotone ph-sign-out"></i> Leave Trip</button>`;

  box.innerHTML = `${editButton}${statusButton}${lastButton}`;
}

function renderTripMembers(trip) {
  const list = document.getElementById("tripMembers");
  if (!list) return;
  const owner = isTripOwner(trip);
  const me = typeof getCurrentUserId === "function" ? getCurrentUserId() : "";

  const count = document.getElementById("tripMemberCount");
  if (count) count.textContent = `${trip.members.length} ${trip.members.length === 1 ? "person" : "people"}`;

  list.innerHTML = trip.members.map((member) => {
    const isMe = member.id === me;
    const roleBadge = member.role === "owner"
      ? `<span class="pill yellow"><i class="ph-fill ph-crown-simple"></i> Owner</span>`
      : `<span class="pill soft-pill">Member</span>`;
    const controls = owner && member.role !== "owner"
      ? `
        <button class="member-action" title="Make ${escapeHTML(member.name)} the owner" aria-label="Make owner" onclick="requestMakeOwner('${escapeHTML(member.id)}')"><i class="ph ph-crown-simple"></i></button>
        <button class="member-action danger-icon" title="Remove ${escapeHTML(member.name)}" aria-label="Remove member" onclick="requestRemoveMember('${escapeHTML(member.id)}')"><i class="ph ph-user-minus"></i></button>
      `
      : "";
    return `
      <div class="member-row">
        <span class="member-name">
          <img alt="${escapeHTML(member.name)} avatar" class="member-avatar" src="${escapeHTML(member.avatar || avatarUrl(member.name))}">
          <span>${escapeHTML(member.name)}${isMe ? ` <small class="muted">(you)</small>` : ""}</span>
        </span>
        <span class="member-controls">${roleBadge}${controls}</span>
      </div>
    `;
  }).join("");

  const addForm = document.getElementById("addMemberForm");
  if (addForm) {
    addForm.hidden = !owner || trip.status === "finished";
  }
}

async function addTripMember(event, button) {
  event?.preventDefault();
  const input = document.getElementById("addMemberInput");
  const identifier = (input?.value || "").trim();
  if (!identifier) {
    demoToast("Enter your friend's email or username");
    return;
  }
  setButtonBusy(button, true, "Adding...");
  try {
    currentDetailTrip = await JoyTripsAPI.addMember(currentDetailTrip.id, identifier);
    upsertTripInCache(currentDetailTrip);
    renderTripDetail();
    if (input) input.value = "";
    demoToast("Member added");
  } catch (error) {
    demoToast(error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

function memberInCurrentTrip(userId) {
  return currentDetailTrip?.members.find((member) => member.id === userId);
}

function requestRemoveMember(userId) {
  const member = memberInCurrentTrip(userId);
  if (!member) return;
  askConfirm({
    icon: "user-minus",
    title: `Remove ${member.name}?`,
    message: `${member.name} will no longer see this trip. They can join again with the invite code.`,
    actionLabel: "Remove",
    onConfirm: async () => {
      const data = await JoyTripsAPI.removeMember(currentDetailTrip.id, userId);
      currentDetailTrip = data.trip;
      upsertTripInCache(currentDetailTrip);
      renderTripDetail();
      demoToast(`${member.name} was removed`);
    }
  });
}

function requestMakeOwner(userId) {
  const member = memberInCurrentTrip(userId);
  if (!member) return;
  askConfirm({
    icon: "crown-simple",
    title: `Make ${member.name} the owner?`,
    message: "You will become a regular member and can no longer edit, finish or delete this trip.",
    actionLabel: "Transfer",
    danger: false,
    onConfirm: async () => {
      currentDetailTrip = await JoyTripsAPI.makeOwner(currentDetailTrip.id, userId);
      upsertTripInCache(currentDetailTrip);
      renderTripDetail();
      demoToast(`${member.name} is now the owner`);
    }
  });
}

function requestLeaveTrip() {
  askConfirm({
    icon: "sign-out",
    title: "Leave this trip?",
    message: "The trip will disappear from your Planner, Expenses and Checklist. You can rejoin with the invite code.",
    actionLabel: "Leave Trip",
    onConfirm: async () => {
      const me = getCurrentUserId();
      await JoyTripsAPI.removeMember(currentDetailTrip.id, me);
      removeTripFromCache(currentDetailTrip.id);
      window.location.href = "trips.html";
    }
  });
}

function requestDeleteCurrentTrip() {
  askConfirm({
    icon: "trash",
    title: "Delete this trip?",
    message: "This removes the trip for every member, and from Planner, Expenses and Checklist too.",
    actionLabel: "Delete Trip",
    onConfirm: async () => {
      const tripId = currentDetailTrip.id;
      await JoyTripsAPI.remove(tripId);
      clearTripLocalData(tripId);
      removeTripFromCache(tripId);
      window.location.href = "trips.html";
    }
  });
}

function clearTripLocalData(tripId) {
  clearModuleState(tripId);
  if (typeof getFinanceData === "function" && typeof saveFinanceData === "function") {
    const finance = getFinanceData();
    delete finance.expenses[tripId];
    finance.payments = (finance.payments || []).filter((payment) => payment.tripId !== tripId);
    saveFinanceData(finance);
  }
}

async function changeTripStatus(status, button) {
  setButtonBusy(button, true, "Saving...");
  try {
    currentDetailTrip = await JoyTripsAPI.setStatus(currentDetailTrip.id, status);
    upsertTripInCache(currentDetailTrip);
    renderTripDetail();
    demoToast(status === "finished" ? "Trip marked as finished" : "Trip is active again");
  } catch (error) {
    demoToast(error.message);
    setButtonBusy(button, false);
  }
}

async function regenerateInviteCode(button) {
  if (!currentDetailTrip) return;
  setButtonBusy(button, true, "");
  try {
    currentDetailTrip = await JoyTripsAPI.newInviteCode(currentDetailTrip.id);
    upsertTripInCache(currentDetailTrip);
    renderTripDetail();
    demoToast("New invite code created. The old one no longer works");
  } catch (error) {
    demoToast(error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

function copyCode() {
  const code = document.getElementById("tripInviteCode")?.textContent.trim() || "";
  navigator.clipboard?.writeText(code);
  demoToast("Invite code copied");
}

function openEditTrip() {
  const trip = currentDetailTrip;
  if (!trip) return;
  const values = {
    editTripName: trip.name,
    editTripDestination: trip.destination,
    editTripStart: trip.startDate,
    editTripEnd: trip.endDate,
    editTripBudget: trip.budget
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value;
  });
  const fileInput = document.getElementById("editTripCover");
  if (fileInput) fileInput.value = "";
  pendingTripCover = "";
  showCoverPreview("editCoverPreview", trip.cover);
  openModal("editTripModal");
}

async function saveTripEdit(button) {
  const trip = readTripForm("editTrip");
  const problem = validateTripForm(trip);
  if (problem) {
    demoToast(problem);
    return;
  }
  setButtonBusy(button, true, "Saving...");
  try {
    currentDetailTrip = await JoyTripsAPI.update(currentDetailTrip.id, {
      ...trip,
      cover: pendingTripCover || currentDetailTrip.cover
    });
    pendingTripCover = "";
    upsertTripInCache(currentDetailTrip);
    renderTripDetail();
    closeModal("editTripModal");
    demoToast(currentDetailTrip.status === "finished" ? "Trip saved (its end date has passed, so it is finished)" : "Trip updated");
  } catch (error) {
    demoToast(error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

/* Generic confirm dialog (uses #confirmModal) */
function askConfirm({ icon = "warning", title, message, actionLabel = "Confirm", danger = true, onConfirm }) {
  const modal = document.getElementById("confirmModal");
  if (!modal) return;
  document.getElementById("confirmIcon").innerHTML = `<i class="ph-duotone ph-${icon}"></i>`;
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  const action = document.getElementById("confirmAction");
  action.textContent = actionLabel;
  action.className = `btn ${danger ? "danger" : "primary"}`;
  action.disabled = false;
  pendingConfirmAction = onConfirm;
  openModal("confirmModal");
}

async function runConfirmAction(button) {
  if (!pendingConfirmAction) return;
  setButtonBusy(button, true, "Working...");
  try {
    await pendingConfirmAction();
    closeModal("confirmModal");
  } catch (error) {
    demoToast(error.message);
  } finally {
    setButtonBusy(button, false);
    pendingConfirmAction = null;
  }
}

/* =========================================================
   Dashboard (next trip card)
   ========================================================= */

function renderDashboard() {
  const feature = document.querySelector(".trip-feature");
  if (!feature) return;

  const today = todayISO();
  const next = getActiveTrips()
    .filter((trip) => trip.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  const badge = document.querySelector(".hero-badge span");

  if (!next) {
    feature.href = "trips.html";
    feature.querySelector(".pill").textContent = "No trips yet";
    feature.querySelector("h2").textContent = "Plan your next adventure";
    feature.querySelector("p").textContent = "Create a trip or join one with an invite code.";
    const stack = feature.querySelector(".avatar-stack");
    if (stack) stack.innerHTML = "";
    if (badge) badge.innerHTML = "<strong>Ready?</strong><small>Start a new trip</small>";
    return;
  }

  const phase = tripPhase(next);
  const photo = feature.querySelector(".mini-trip-photo");
  if (photo) {
    photo.src = next.cover;
    photo.alt = `${next.name} cover`;
  }
  feature.href = `trip-detail.html?trip=${encodeURIComponent(next.id)}`;
  feature.querySelector(".pill").textContent = `${phase.label} Trip`;
  feature.querySelector("h2").textContent = next.name;
  feature.querySelector("p").textContent = `${formatTripDate(next.startDate, next.endDate)} · ${next.destination}`;
  const stack = feature.querySelector(".avatar-stack");
  if (stack) {
    stack.innerHTML = next.members.slice(0, 6).map((member) => `<img class="member-avatar" alt="${escapeHTML(member.name)}" src="${escapeHTML(member.avatar || avatarUrl(member.name))}">`).join("");
  }

  if (badge) {
    const days = Math.round((new Date(`${next.startDate}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
    badge.innerHTML = days > 0
      ? `<strong>${days} day${days === 1 ? "" : "s"}</strong><small>until ${escapeHTML(next.name)}</small>`
      : `<strong>Now</strong><small>on ${escapeHTML(next.name)}</small>`;
  }
}

/* =========================================================
   Other pages (unchanged behaviour)
   ========================================================= */

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

window.addEventListener("click", (event) => {
  if (event.target.classList?.contains("modal")) {
    event.target.classList.remove("open");
  }
});

/* =========================================================
   Startup: wait for login, sync the user, load trips, render
   ========================================================= */

async function initTrips() {
  const user = await window.jjAuthReady;
  const onAuthPage = typeof isAuthPage === "function" && isAuthPage();
  if (!user || onAuthPage) {
    return [];
  }
  try {
    await jjSyncUser(user);
    JJ_TRIPS = await JoyTripsAPI.list("all");
    JJ_TRIPS_ERROR = null;
  } catch (error) {
    JJ_TRIPS = [];
    JJ_TRIPS_ERROR = error;
    demoToast(error.message);
  }
  return JJ_TRIPS;
}

document.addEventListener("DOMContentLoaded", () => {
  window.jjTripsReady = initTrips();

  window.jjTripsReady.then(() => {
    renderTripsPage();
    renderTripModules();
    renderDashboard();
    loadTripDetail();
  });

  document.addEventListener("change", (event) => {
    const panel = event.target.closest?.('[data-trip-panel="checklist"]');
    if (panel && event.target.matches("input[type='checkbox']")) {
      savePackingFromPanel(panel);
    }
  });
});
