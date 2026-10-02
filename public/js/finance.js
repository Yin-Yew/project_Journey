const JJ_FINANCE_KEY = "joyjourneyFinance";
const JJ_FINANCE_VERSION = 3;
let currentExpenseEditId = "";
let paymentSlipData = "";
let activePayment = null;

/* Demo expenses for the seeded demo trips (matched by invite code) */
const JJ_FINANCE_DEMO_SEEDS = {
  SAMET26: () => [
    createFinanceExpense("samet-hotel", "Hotel", 2400, "yin", ["yin", "ploy", "book", "gun"], "equal", {}, "Stay"),
    createFinanceExpense("samet-van", "Van to pier", 960, "ploy", ["yin", "ploy", "book", "gun"], "equal", {}, "Transport"),
    createFinanceExpense("samet-dinner", "Beach dinner", 1280, "book", ["yin", "ploy", "book", "gun"], "equal", {}, "Food")
  ],
  BKK26: () => [
    createFinanceExpense("bkk-cafe", "Cafe hopping", 900, "gun", ["yin", "ploy", "book", "gun"], "equal", {}, "Food"),
    createFinanceExpense("bkk-taxi", "Taxi", 640, "yin", ["yin", "ploy", "book", "gun"], "equal", {}, "Transport")
  ]
};

function financeSeedData() {
  return {
    version: JJ_FINANCE_VERSION,
    expenses: {},
    payments: []
  };
}

function seedFinanceForTrips() {
  const trips = typeof getAllTrips === "function" ? getAllTrips() : [];
  const data = getFinanceData();
  let changed = false;
  trips.forEach((trip) => {
    const seed = JJ_FINANCE_DEMO_SEEDS[trip.inviteCode];
    if (seed && data.expenses[trip.id] === undefined) {
      data.expenses[trip.id] = seed();
      changed = true;
    }
  });
  if (changed) saveFinanceData(data);
}

function createFinanceExpense(id, title, amount, paidBy, participants, splitType, shares, category) {
  return {
    id,
    title,
    amount: Number(amount),
    paidBy,
    participants,
    splitType,
    shares,
    category: category || "Other",
    date: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString()
  };
}

function getFinanceData() {
  try {
    const saved = JSON.parse(localStorage.getItem(JJ_FINANCE_KEY) || "null");
    if (saved && saved.version === JJ_FINANCE_VERSION) {
      return saved;
    }
  } catch {}
  const seeded = financeSeedData();
  saveFinanceData(seeded);
  return seeded;
}

function saveFinanceData(data) {
  localStorage.setItem(JJ_FINANCE_KEY, JSON.stringify(data));
}

/* Active trips first, then finished ones (so old trips can still be settled) */
function getAllActiveTripsForFinance() {
  const trips = typeof getAllTrips === "function" ? getAllTrips() : [];
  return [...trips.filter((trip) => trip.status === "active"), ...trips.filter((trip) => trip.status !== "active")];
}

/* The people in a trip come from the database (trip_members) */
function getFinanceMembers(tripId) {
  const trip = tripId && typeof getTripById === "function" ? getTripById(tripId) : null;
  if (trip?.members?.length) {
    return trip.members;
  }
  if (typeof getJoyMembers === "function") {
    return getJoyMembers();
  }
  return [];
}

function memberById(id) {
  const trips = typeof getAllTrips === "function" ? getAllTrips() : [];
  for (const trip of trips) {
    const member = (trip.members || []).find((item) => item.id === id);
    if (member) return member;
  }
  const local = typeof getJoyUsers === "function" ? getJoyUsers().find((user) => user.id === id) : null;
  return local || { id, name: id, avatar: "" };
}

function money(value) {
  return `฿${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getTripExpenses(tripId) {
  return getFinanceData().expenses[tripId] || [];
}

function getExpenseShares(expense) {
  const participants = expense.participants || [];
  const amount = Number(expense.amount || 0);
  const shares = {};

  if (!participants.length) {
    return shares;
  }

  if (expense.splitType === "percentage") {
    participants.forEach((id) => {
      shares[id] = roundMoney(amount * Number(expense.shares?.[id] || 0) / 100);
    });
    return normalizeShareRemainder(shares, participants, amount);
  }

  if (expense.splitType === "custom") {
    participants.forEach((id) => {
      shares[id] = roundMoney(Number(expense.shares?.[id] || 0));
    });
    return shares;
  }

  const each = roundMoney(amount / participants.length);
  participants.forEach((id) => {
    shares[id] = each;
  });
  return normalizeShareRemainder(shares, participants, amount);
}

function normalizeShareRemainder(shares, participants, amount) {
  const total = participants.reduce((sum, id) => sum + Number(shares[id] || 0), 0);
  const difference = roundMoney(amount - total);
  if (participants.length && Math.abs(difference) > 0) {
    const last = participants[participants.length - 1];
    shares[last] = roundMoney(Number(shares[last] || 0) + difference);
  }
  return shares;
}

function computeTripBalances(tripId) {
  const balances = Object.fromEntries(getFinanceMembers(tripId).map((member) => [member.id, 0]));
  getTripExpenses(tripId).forEach((expense) => {
    const amount = Number(expense.amount || 0);
    balances[expense.paidBy] = roundMoney((balances[expense.paidBy] || 0) + amount);
    const shares = getExpenseShares(expense);
    Object.entries(shares).forEach(([memberId, share]) => {
      balances[memberId] = roundMoney((balances[memberId] || 0) - Number(share || 0));
    });
  });
  return balances;
}

function computeSettlements(tripId) {
  const balances = computeTripBalances(tripId);
  const creditors = Object.entries(balances).filter(([, amount]) => amount > 0.009).map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);
  const debtors = Object.entries(balances).filter(([, amount]) => amount < -0.009).map(([id, amount]) => ({ id, amount: Math.abs(amount) })).sort((a, b) => b.amount - a.amount);
  const settlements = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = roundMoney(Math.min(creditor.amount, debtor.amount));
    if (amount > 0) {
      settlements.push({ tripId, from: debtor.id, to: creditor.id, amount });
    }
    creditor.amount = roundMoney(creditor.amount - amount);
    debtor.amount = roundMoney(debtor.amount - amount);
    if (creditor.amount <= 0.009) creditorIndex += 1;
    if (debtor.amount <= 0.009) debtorIndex += 1;
  }

  return settlements;
}

function settlementKey(settlement) {
  return `${settlement.tripId}|${settlement.from}|${settlement.to}|${roundMoney(settlement.amount).toFixed(2)}`;
}

function paymentForSettlement(settlement) {
  const key = settlementKey(settlement);
  return getFinanceData().payments.find((payment) => payment.key === key && payment.status !== "cancelled") || null;
}

function isSettlementCompleted(settlement) {
  return paymentForSettlement(settlement)?.status === "paid";
}

function financeSummary(tripId) {
  const currentUserId = typeof getCurrentUserId === "function" ? getCurrentUserId() || "yin" : "yin";
  const expenses = getTripExpenses(tripId);
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paid = expenses.filter((expense) => expense.paidBy === currentUserId).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const settlements = computeSettlements(tripId).filter((settlement) => !isSettlementCompleted(settlement));
  const owe = settlements.filter((settlement) => settlement.from === currentUserId).reduce((sum, settlement) => sum + settlement.amount, 0);
  const receive = settlements.filter((settlement) => settlement.to === currentUserId).reduce((sum, settlement) => sum + settlement.amount, 0);
  return { total: roundMoney(total), paid: roundMoney(paid), owe: roundMoney(owe), receive: roundMoney(receive) };
}

function financeTripSwitch(trip, active) {
  const summary = financeSummary(trip.id);
  return `
    <button class="trip-switch ${active ? "active" : ""}" data-finance-trip="${escapeHTML(trip.id)}" onclick="selectFinanceTrip('${escapeHTML(trip.id)}')">
      <img src="${trip.cover}" alt="${escapeHTML(trip.name)}">
      <span><strong>${escapeHTML(trip.name)}</strong><small>${money(summary.total)} spent${trip.status === "finished" ? " · Finished" : ""}</small></span>
      <i class="ph ph-caret-right"></i>
    </button>
  `;
}

function renderFinancePage() {
  const switcher = document.getElementById("financeTripSwitcher");
  const panels = document.getElementById("financePanels");
  if (!switcher || !panels) {
    updateFinanceOverview();
    return;
  }

  const trips = getAllActiveTripsForFinance();
  if (!trips.length) {
    const error = typeof JJ_TRIPS_ERROR !== "undefined" && JJ_TRIPS_ERROR;
    switcher.innerHTML = "";
    panels.innerHTML = `<section class="card module-empty"><i class="ph-duotone ph-wallet"></i>${error
      ? `<h3>Could not load trips</h3><p>${escapeHTML(error.message)}</p>`
      : `<h3>No trips yet</h3><p>Create or join a trip to start tracking expenses.</p><a class="btn primary small" href="trips.html"><i class="ph-bold ph-plus"></i> Go to My Trips</a>`}</section>`;
    return;
  }
  const queryTrip = new URLSearchParams(location.search).get("trip");
  const currentTrip = trips.some((trip) => trip.id === queryTrip) ? queryTrip : trips[0]?.id || "";
  switcher.innerHTML = trips.map((trip) => financeTripSwitch(trip, trip.id === currentTrip)).join("");
  panels.innerHTML = trips.map((trip) => financePanel(trip, trip.id === currentTrip)).join("");
  populateExpenseTripSelect(trips, currentTrip);
  renderExpenseParticipants();
  updateFinanceOverview();
}

function financePanel(trip, active) {
  const summary = financeSummary(trip.id);
  const expenses = getTripExpenses(trip.id);
  return `
    <section class="finance-panel ${active ? "active" : ""}" data-finance-panel="${escapeHTML(trip.id)}">
      <div class="trip-section-head">
        <div><span class="pill pink">${escapeHTML(trip.name)}</span><h2>Trip Wallet</h2></div>
        <span class="trip-date"><i class="ph-duotone ph-calendar"></i> ${escapeHTML(formatTripDate(trip.startDate, trip.endDate))}</span>
      </div>
      <section class="grid finance-summary">
        ${summaryCard("receipt", "pink", "Total Expenses", summary.total)}
        ${summaryCard("hand-coins", "blue", "You Paid", summary.paid)}
        ${summaryCard("arrow-circle-up", "yellow", "You Owe", summary.owe)}
        ${summaryCard("arrow-circle-down", "mint", "You Receive", summary.receive)}
      </section>
      <section class="card finance-list-card">
        <div class="finance-section-title"><div><span class="eyebrow">Expenses</span><h2>Expense List</h2></div><span>${expenses.length} items</span></div>
        <div class="finance-expense-list">${expenseRows(trip.id, expenses)}</div>
      </section>
      <section class="settlement-wrap">
        <div class="settlement-heading"><div><span class="eyebrow">Settle up</span><h2>Who pays whom</h2></div><span class="pill soft-pill"><i class="ph-duotone ph-calculator"></i> Optimized transfers</span></div>
        <div class="settlement-grid">${settlementCards(trip.id)}</div>
      </section>
      <section class="card finance-list-card payment-history-card">
        <div class="finance-section-title"><div><span class="eyebrow">Payments</span><h2>Payment Activity</h2></div></div>
        <div>${paymentHistory(trip.id)}</div>
      </section>
    </section>
  `;
}

function summaryCard(icon, tone, label, value) {
  return `<article class="card"><span class="summary-icon ${tone}"><i class="ph-duotone ph-${icon}"></i></span><p class="muted">${label}</p><h2>${money(value)}</h2></article>`;
}

function expenseRows(tripId, expenses) {
  if (!expenses.length) {
    return `<div class="module-empty"><i class="ph-duotone ph-receipt"></i><h3>No expenses yet</h3><p>Add the first expense for this trip.</p></div>`;
  }

  return expenses.map((expense) => {
    const payer = memberById(expense.paidBy);
    const splitLabel = expense.splitType === "percentage" ? "Percentage split" : expense.splitType === "custom" ? "Custom split" : "Equal split";
    const icon = expense.category === "Food" ? "fork-knife" : expense.category === "Transport" ? "car" : expense.category === "Stay" ? "bed" : "receipt";
    return `
      <div class="expense-row finance-expense-row">
        <span class="expense-icon"><i class="ph-duotone ph-${icon}"></i></span>
        <div><strong>${escapeHTML(expense.title)}</strong><p>Paid by ${escapeHTML(payer.name)} · ${splitLabel}</p></div>
        <strong>${money(expense.amount)}</strong>
        <div class="expense-actions">
          <button aria-label="Edit expense" onclick="editExpense('${escapeHTML(tripId)}','${escapeHTML(expense.id)}')"><i class="ph ph-pencil-simple"></i></button>
          <button aria-label="Delete expense" class="danger-icon" onclick="deleteExpense('${escapeHTML(tripId)}','${escapeHTML(expense.id)}')"><i class="ph ph-trash"></i></button>
        </div>
      </div>
    `;
  }).join("");
}

function settlementCards(tripId) {
  const currentUserId = typeof getCurrentUserId === "function" ? getCurrentUserId() || "yin" : "yin";
  const settlements = computeSettlements(tripId).filter((settlement) => !isSettlementCompleted(settlement));

  if (!settlements.length) {
    return `<article class="card settle-empty"><i class="ph-duotone ph-handshake"></i><div><strong>All clear</strong><p>No balances to settle.</p></div></article>`;
  }

  return settlements.map((settlement) => {
    const from = memberById(settlement.from);
    const to = memberById(settlement.to);
    const payment = paymentForSettlement(settlement);
    let action = `<span class="pill soft-pill">Between members</span>`;
    let tone = "";

    if (payment?.status === "pending") {
      if (settlement.to === currentUserId) {
        action = `<button class="btn soft small" onclick="verifyPayment('${escapeHTML(payment.id)}')"><i class="ph ph-check-circle"></i> Confirm received</button>`;
      } else {
        action = `<span class="pill yellow">Pending</span>`;
      }
      tone = "pending-settlement";
    } else if (settlement.from === currentUserId) {
      action = `<button class="btn primary small" onclick="openFinancePayment('${escapeHTML(tripId)}','${escapeHTML(settlement.from)}','${escapeHTML(settlement.to)}',${settlement.amount})"><i class="ph-duotone ph-qr-code"></i> Pay</button>`;
      tone = "you-owe";
    } else if (settlement.to === currentUserId) {
      action = `<span class="pill yellow">Waiting</span>`;
      tone = "incoming";
    }

    return `
      <article class="settlement-card ${tone}">
        <div class="settlement-people">
          <img src="${from.avatar || avatarUrl(from.name)}" alt="${escapeHTML(from.name)}">
          <i class="ph-bold ph-arrow-right"></i>
          <img src="${to.avatar || avatarUrl(to.name)}" alt="${escapeHTML(to.name)}">
        </div>
        <div><strong>${escapeHTML(from.name)} pays ${escapeHTML(to.name)}</strong><p>${money(settlement.amount)}</p></div>
        ${action}
      </article>
    `;
  }).join("");
}

function paymentHistory(tripId) {
  const payments = getFinanceData().payments.filter((payment) => payment.tripId === tripId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!payments.length) {
    return `<div class="finance-empty-line"><i class="ph-duotone ph-credit-card"></i><span>No payment activity yet.</span></div>`;
  }

  return payments.map((payment) => {
    const from = memberById(payment.from);
    const to = memberById(payment.to);
    const statusClass = payment.status === "paid" ? "mint" : "yellow";
    const statusText = payment.status === "paid" ? "Paid" : "Pending";
    return `<div class="payment-history-row"><div><strong>${escapeHTML(from.name)} → ${escapeHTML(to.name)}</strong><small>${new Date(payment.createdAt).toLocaleString()}</small></div><strong>${money(payment.amount)}</strong><span class="pill ${statusClass}">${statusText}</span></div>`;
  }).join("");
}

function selectFinanceTrip(tripId) {
  document.querySelectorAll("[data-finance-trip]").forEach((button) => button.classList.toggle("active", button.dataset.financeTrip === tripId));
  document.querySelectorAll("[data-finance-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.financePanel === tripId));
  const select = document.getElementById("expenseTripSelect");
  if (select) select.value = tripId;
  const url = new URL(location.href);
  url.searchParams.set("trip", tripId);
  history.replaceState({}, "", url);
}

function populateExpenseTripSelect(trips, selectedTrip) {
  const select = document.getElementById("expenseTripSelect");
  if (!select) return;
  select.innerHTML = trips.map((trip) => `<option value="${escapeHTML(trip.id)}" ${trip.id === selectedTrip ? "selected" : ""}>${escapeHTML(trip.name)}</option>`).join("");
}

function openExpenseModal() {
  if (!getAllActiveTripsForFinance().length) {
    demoToast("Create or join a trip first");
    return;
  }
  currentExpenseEditId = "";
  const title = document.getElementById("expenseModalTitle");
  if (title) title.textContent = "Add Expense";
  document.getElementById("expenseTitle").value = "";
  document.getElementById("expenseAmount").value = "";
  document.getElementById("expenseCategory").value = "Other";
  document.getElementById("expenseSplitType").value = "equal";
  const active = document.querySelector("[data-finance-trip].active")?.dataset.financeTrip;
  if (active) document.getElementById("expenseTripSelect").value = active;
  renderExpenseParticipants();
  openModal("expenseModal");
}

function renderExpenseParticipants(selectedParticipants, savedShares = {}) {
  const box = document.getElementById("expenseParticipants");
  const payer = document.getElementById("expensePaidBy");
  if (!box || !payer) return;
  const members = getFinanceMembers(document.getElementById("expenseTripSelect")?.value);
  const selected = selectedParticipants || members.map((member) => member.id);
  payer.innerHTML = members.map((member) => `<option value="${member.id}">${escapeHTML(member.name)}</option>`).join("");
  box.innerHTML = members.map((member) => `
    <label class="participant-chip">
      <input type="checkbox" value="${member.id}" ${selected.includes(member.id) ? "checked" : ""} onchange="renderSplitFields()">
      <img src="${member.avatar || avatarUrl(member.name)}" alt="${escapeHTML(member.name)}">
      <span>${escapeHTML(member.name)}</span>
    </label>
  `).join("");
  renderSplitFields(savedShares);
}

function selectedExpenseParticipants() {
  return [...document.querySelectorAll("#expenseParticipants input:checked")].map((input) => input.value);
}

function renderSplitFields(savedShares = {}) {
  const box = document.getElementById("splitDetailFields");
  if (!box) return;
  const type = document.getElementById("expenseSplitType")?.value || "equal";
  const participants = selectedExpenseParticipants();
  const amount = Number(document.getElementById("expenseAmount")?.value || 0);

  if (!participants.length) {
    box.innerHTML = `<p class="form-hint error-text">Choose at least one person.</p>`;
    return;
  }

  if (type === "equal") {
    const each = amount ? amount / participants.length : 0;
    box.innerHTML = `<div class="split-preview"><i class="ph-duotone ph-equals"></i><span>${participants.length} people · ${money(each)} each</span></div>`;
    return;
  }

  const label = type === "percentage" ? "%" : "฿";
  const defaultValue = type === "percentage" ? roundMoney(100 / participants.length) : roundMoney(amount / participants.length);
  box.innerHTML = participants.map((id) => {
    const member = memberById(id);
    const value = savedShares[id] ?? defaultValue;
    return `<label class="split-input-row"><span>${escapeHTML(member.name)}</span><div><span>${label}</span><input type="number" min="0" step="0.01" data-split-member="${id}" value="${value}"></div></label>`;
  }).join("");
}

function collectExpenseShares(type, participants) {
  if (type === "equal") return {};
  const shares = {};
  participants.forEach((id) => {
    shares[id] = Number(document.querySelector(`[data-split-member="${id}"]`)?.value || 0);
  });
  return shares;
}

function saveExpenseForm(event) {
  event?.preventDefault();
  const tripId = document.getElementById("expenseTripSelect")?.value || "";
  const title = document.getElementById("expenseTitle")?.value.trim() || "";
  const amount = Number(document.getElementById("expenseAmount")?.value || 0);
  const paidBy = document.getElementById("expensePaidBy")?.value || "";
  const category = document.getElementById("expenseCategory")?.value || "Other";
  const splitType = document.getElementById("expenseSplitType")?.value || "equal";
  const participants = selectedExpenseParticipants();
  const shares = collectExpenseShares(splitType, participants);

  if (!tripId || !title || amount <= 0 || !paidBy || !participants.length) {
    demoToast("Complete all expense details");
    return;
  }

  if (splitType === "percentage") {
    const totalPercent = roundMoney(Object.values(shares).reduce((sum, value) => sum + Number(value), 0));
    if (Math.abs(totalPercent - 100) > 0.05) {
      demoToast("Percentages must total 100%");
      return;
    }
  }

  if (splitType === "custom") {
    const totalCustom = roundMoney(Object.values(shares).reduce((sum, value) => sum + Number(value), 0));
    if (Math.abs(totalCustom - amount) > 0.05) {
      demoToast("Custom amounts must equal the expense total");
      return;
    }
  }

  const data = getFinanceData();
  data.expenses[tripId] = data.expenses[tripId] || [];
  const expense = createFinanceExpense(currentExpenseEditId || `expense-${Date.now()}`, title, amount, paidBy, participants, splitType, shares, category);
  const index = data.expenses[tripId].findIndex((item) => item.id === currentExpenseEditId);
  if (index >= 0) {
    expense.createdAt = data.expenses[tripId][index].createdAt;
    data.expenses[tripId][index] = expense;
  } else {
    data.expenses[tripId].push(expense);
  }
  saveFinanceData(data);
  currentExpenseEditId = "";
  closeModal("expenseModal");
  renderFinancePage();
  selectFinanceTrip(tripId);
  demoToast(index >= 0 ? "Expense updated" : "Expense added");
}

function editExpense(tripId, expenseId) {
  const expense = getTripExpenses(tripId).find((item) => item.id === expenseId);
  if (!expense) return;
  currentExpenseEditId = expense.id;
  document.getElementById("expenseModalTitle").textContent = "Edit Expense";
  document.getElementById("expenseTripSelect").value = tripId;
  document.getElementById("expenseTitle").value = expense.title;
  document.getElementById("expenseAmount").value = expense.amount;
  document.getElementById("expenseCategory").value = expense.category || "Other";
  document.getElementById("expenseSplitType").value = expense.splitType || "equal";
  renderExpenseParticipants(expense.participants, expense.shares || {});
  document.getElementById("expensePaidBy").value = expense.paidBy;
  renderSplitFields(expense.shares || {});
  openModal("expenseModal");
}

function deleteExpense(tripId, expenseId) {
  if (!confirm("Delete this expense?")) return;
  const data = getFinanceData();
  data.expenses[tripId] = (data.expenses[tripId] || []).filter((expense) => expense.id !== expenseId);
  saveFinanceData(data);
  renderFinancePage();
  selectFinanceTrip(tripId);
  demoToast("Expense deleted");
}

function openFinancePayment(tripId, from, to, amount) {
  const recipient = memberById(to);
  activePayment = { tripId, from, to, amount: roundMoney(amount) };
  paymentSlipData = "";
  document.getElementById("payRecipient").textContent = recipient.name;
  document.getElementById("payAmount").textContent = money(amount);
  document.getElementById("payPromptPay").textContent = recipient.promptpay || "Not added";
  document.getElementById("payBank").textContent = recipient.bankName && recipient.bankAccount ? `${recipient.bankName} · ${recipient.bankAccount}` : "Not added";
  document.getElementById("slipPreview").innerHTML = `<i class="ph-duotone ph-image-square"></i><span>No slip selected</span>`;
  document.getElementById("paymentSlip").value = "";
  renderDemoPaymentCode(recipient, amount);
  openModal("payModal");
}

function renderDemoPaymentCode(recipient, amount) {
  const box = document.getElementById("paymentCode");
  if (!box) return;
  const source = `${recipient.id}-${amount}-${recipient.promptpay || "demo"}`;
  let cells = "";
  for (let row = 0; row < 13; row += 1) {
    for (let column = 0; column < 13; column += 1) {
      const char = source.charCodeAt((row * 13 + column) % source.length) || 1;
      const on = (char + row * 7 + column * 11) % 3 !== 0;
      cells += `<span class="${on ? "on" : ""}"></span>`;
    }
  }
  box.innerHTML = cells;
}

function copyPaymentInfo(type) {
  if (!activePayment) return;
  const recipient = memberById(activePayment.to);
  const value = type === "bank" ? `${recipient.bankName || ""} ${recipient.bankAccount || ""}`.trim() : recipient.promptpay || "";
  if (!value) {
    demoToast("Payment info has not been added");
    return;
  }
  navigator.clipboard?.writeText(value);
  demoToast("Payment info copied");
}

async function previewPaymentSlip(event) {
  const file = event.target.files?.[0];
  if (!file || !file.type.startsWith("image/")) {
    paymentSlipData = "";
    return;
  }
  try {
    paymentSlipData = typeof resizeImage === "function" ? await resizeImage(file, 900, 1200, 0.74) : await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const preview = document.getElementById("slipPreview");
    if (preview) preview.innerHTML = `<img src="${paymentSlipData}" alt="Payment slip preview">`;
  } catch {
    paymentSlipData = "";
    demoToast("Could not read this slip");
  }
}

function submitPayment() {
  if (!activePayment) return;
  const data = getFinanceData();
  const settlement = { ...activePayment };
  const key = settlementKey(settlement);
  const existing = data.payments.find((payment) => payment.key === key && payment.status !== "cancelled");
  if (existing) {
    existing.status = "pending";
    existing.slip = paymentSlipData || existing.slip || "";
    existing.updatedAt = new Date().toISOString();
  } else {
    data.payments.push({
      id: `payment-${Date.now()}`,
      key,
      ...settlement,
      slip: paymentSlipData,
      status: "pending",
      createdAt: new Date().toISOString()
    });
  }
  saveFinanceData(data);
  closeModal("payModal");
  const tripId = activePayment.tripId;
  activePayment = null;
  renderFinancePage();
  selectFinanceTrip(tripId);
  demoToast("Payment submitted for confirmation");
}

function verifyPayment(paymentId) {
  const data = getFinanceData();
  const payment = data.payments.find((item) => item.id === paymentId);
  if (!payment) return;
  payment.status = "paid";
  payment.verifiedAt = new Date().toISOString();
  saveFinanceData(data);
  renderFinancePage();
  selectFinanceTrip(payment.tripId);
  demoToast("Payment confirmed");
}

function updateFinanceOverview() {
  const element = document.getElementById("tripExpenseDetail");
  if (!element) return;
  const tripId = new URLSearchParams(location.search).get("trip");
  if (!tripId) return;
  element.textContent = money(financeSummary(tripId).total);
}

document.addEventListener("DOMContentLoaded", async () => {
  await window.jjTripsReady;
  seedFinanceForTrips();
  renderFinancePage();
  document.getElementById("expenseAmount")?.addEventListener("input", () => renderSplitFields());
  document.getElementById("expenseSplitType")?.addEventListener("change", () => renderSplitFields());
  document.getElementById("expenseTripSelect")?.addEventListener("change", () => {
    selectFinanceTrip(document.getElementById("expenseTripSelect").value);
    renderExpenseParticipants();
  });
});
