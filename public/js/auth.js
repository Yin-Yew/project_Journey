const JJ_USERS_KEY = "joyjourneyUsers";
const JJ_SESSION_KEY = "joyjourneyCurrentUser";
const JJ_LOGIN_REQUIRED_KEY = "joyjourneyLoginRequired";
const JJ_UI_KEY = "joyjourneyUI";

const JJ_MEMBER_SEEDS = [
  { id: "yin", name: "Yin", email: "yin@example.com", style: "Beach Explorer", avatarSeed: "Yin", avatarColor: "ffd5dc", promptpay: "081-XXX-0001", bankName: "KBank", bankAccount: "XXX-X-00001-X" },
  { id: "ploy", name: "Ploy", email: "ploy@example.com", style: "Cafe Hunter", avatarSeed: "Ploy", avatarColor: "d5efff", promptpay: "081-XXX-0002", bankName: "SCB", bankAccount: "XXX-X-00002-X" },
  { id: "book", name: "Book", email: "book@example.com", style: "Photo Lover", avatarSeed: "Book", avatarColor: "dff2d8", promptpay: "081-XXX-0003", bankName: "KBank", bankAccount: "XXX-X-00003-X" },
  { id: "gun", name: "Gun", email: "gun@example.com", style: "Food Explorer", avatarSeed: "Gun", avatarColor: "eee1ff", promptpay: "081-XXX-0004", bankName: "BBL", bankAccount: "XXX-X-00004-X" }
];

function avatarUrl(seed, color = "ffd5dc") {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${encodeURIComponent(color)}`;
}

async function hashText(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getJoyUsers() {
  try {
    return JSON.parse(localStorage.getItem(JJ_USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveJoyUsers(users) {
  localStorage.setItem(JJ_USERS_KEY, JSON.stringify(users));
}

async function ensureJoyUsers() {
  let users = getJoyUsers();
  const demoHash = await hashText("password123");
  const byId = new Map(users.map((user) => [user.id, user]));

  JJ_MEMBER_SEEDS.forEach((seed) => {
    if (!byId.has(seed.id)) {
      users.push({
        ...seed,
        username: seed.name.toLowerCase(),
        avatar: avatarUrl(seed.avatarSeed, seed.avatarColor),
        passwordHash: demoHash,
        createdAt: new Date().toISOString()
      });
    }
  });

  saveJoyUsers(users);
  return users;
}

function getCurrentUserId() {
  return localStorage.getItem(JJ_SESSION_KEY) || "";
}

function getCurrentUser() {
  const id = getCurrentUserId();
  return getJoyUsers().find((user) => user.id === id) || null;
}

function setCurrentUser(id) {
  localStorage.setItem(JJ_SESSION_KEY, id);
  localStorage.removeItem(JJ_LOGIN_REQUIRED_KEY);
}

function getJoyMembers() {
  const users = getJoyUsers();
  return JJ_MEMBER_SEEDS.map((seed) => users.find((user) => user.id === seed.id) || seed);
}

function isAuthPage() {
  const page = location.pathname.split("/").pop();
  return page === "login.html" || page === "register.html";
}

function isProtectedPage() {
  return !isAuthPage();
}

async function bootstrapAuth() {
  await ensureJoyUsers();
  let current = getCurrentUser();

  if (!current && isProtectedPage()) {
    if (localStorage.getItem(JJ_LOGIN_REQUIRED_KEY) === "1") {
      location.href = "login.html";
      return;
    }
    setCurrentUser("yin");
    current = getCurrentUser();
  }

  renderCurrentUserUI(current);
  loadProfileForm(current);
  loadUISettings();
}

function renderCurrentUserUI(user = getCurrentUser()) {
  if (!user) {
    return;
  }

  document.querySelectorAll(".user-chip").forEach((chip) => {
    const image = chip.querySelector("img");
    const strong = chip.querySelector("strong");
    const small = chip.querySelector("small");
    if (image) {
      image.src = user.avatar || avatarUrl(user.avatarSeed || user.name);
      image.alt = `${user.name} avatar`;
    }
    if (strong) {
      strong.textContent = user.name;
    }
    if (small) {
      small.textContent = user.style || "Happy Traveler";
    }
  });

  document.querySelectorAll("[data-current-user-name]").forEach((element) => {
    element.textContent = user.name;
  });

  const heroHeading = document.querySelector(".hero-copy h1");
  if (heroHeading && heroHeading.textContent.trim().startsWith("Hi ")) {
    heroHeading.textContent = `Hi ${user.name}! Ready for another adventure?`;
  }
}

async function authLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  const message = document.getElementById("loginMessage");
  const users = await ensureJoyUsers();
  const user = users.find((item) => item.email.toLowerCase() === email);
  const passwordHash = await hashText(password);

  if (!user || user.passwordHash !== passwordHash) {
    if (message) {
      message.textContent = "Email or password is incorrect.";
      message.className = "form-message error";
    }
    return;
  }

  setCurrentUser(user.id);
  if (message) {
    message.textContent = `Welcome back, ${user.name}!`;
    message.className = "form-message success";
  }
  demoToast("Login successful");
  setTimeout(() => {
    location.href = "index.html";
  }, 450);
}

async function authRegister(event) {
  event.preventDefault();
  const name = document.getElementById("registerName")?.value.trim() || "";
  const email = document.getElementById("registerEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("registerPassword")?.value || "";
  const confirmPassword = document.getElementById("registerConfirmPassword")?.value || "";
  const message = document.getElementById("registerMessage");
  const users = await ensureJoyUsers();

  if (name.length < 2) {
    showAuthMessage(message, "Please enter your name.", "error");
    return;
  }
  if (users.some((user) => user.email.toLowerCase() === email)) {
    showAuthMessage(message, "This email is already registered.", "error");
    return;
  }
  if (password.length < 6) {
    showAuthMessage(message, "Password must be at least 6 characters.", "error");
    return;
  }
  if (password !== confirmPassword) {
    showAuthMessage(message, "Passwords do not match.", "error");
    return;
  }

  const id = `user-${Date.now()}`;
  const color = ["ffd5dc", "d5efff", "dff2d8", "eee1ff", "fff0c7"][Math.floor(Math.random() * 5)];
  users.push({
    id,
    name,
    username: name.toLowerCase().replace(/[^a-z0-9]+/g, "") || `traveler${Date.now()}`,
    email,
    passwordHash: await hashText(password),
    style: "Happy Traveler",
    avatarSeed: `${name}-${Date.now()}`,
    avatarColor: color,
    avatar: avatarUrl(`${name}-${Date.now()}`, color),
    promptpay: "",
    bankName: "",
    bankAccount: "",
    createdAt: new Date().toISOString()
  });
  saveJoyUsers(users);
  setCurrentUser(id);
  showAuthMessage(message, "Account created!", "success");
  demoToast("Account created");
  setTimeout(() => {
    location.href = "profile.html";
  }, 450);
}

function showAuthMessage(element, text, type) {
  if (!element) {
    return;
  }
  element.textContent = text;
  element.className = `form-message ${type}`;
}

function authLogout() {
  localStorage.removeItem(JJ_SESSION_KEY);
  localStorage.setItem(JJ_LOGIN_REQUIRED_KEY, "1");
  location.href = "login.html";
}

function loadProfileForm(user = getCurrentUser()) {
  if (!user || !document.getElementById("profileForm")) {
    return;
  }

  const values = {
    profileName: user.name || "",
    profileUsername: user.username || "",
    profileEmail: user.email || "",
    profileStyle: user.style || "",
    profilePromptPay: user.promptpay || "",
    profileBankName: user.bankName || "",
    profileBankAccount: user.bankAccount || ""
  };

  Object.entries(values).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) {
      input.value = value;
    }
  });

  const avatar = document.getElementById("profileAvatar");
  const title = document.getElementById("profileDisplayName");
  const handle = document.getElementById("profileHandle");
  const style = document.getElementById("profileDisplayStyle");

  if (avatar) avatar.src = user.avatar || avatarUrl(user.name);
  if (title) title.textContent = user.name;
  if (handle) handle.textContent = `@${user.username || "traveler"}`;
  if (style) style.textContent = user.style || "Happy Traveler";
}

function saveProfile(event) {
  event?.preventDefault();
  const current = getCurrentUser();
  if (!current) {
    return;
  }

  const users = getJoyUsers();
  const index = users.findIndex((user) => user.id === current.id);
  if (index < 0) {
    return;
  }

  const email = document.getElementById("profileEmail")?.value.trim().toLowerCase() || "";
  if (users.some((user, userIndex) => userIndex !== index && user.email.toLowerCase() === email)) {
    demoToast("Email is already in use");
    return;
  }

  users[index] = {
    ...users[index],
    name: document.getElementById("profileName")?.value.trim() || users[index].name,
    username: document.getElementById("profileUsername")?.value.trim() || users[index].username,
    email,
    style: document.getElementById("profileStyle")?.value.trim() || "Happy Traveler",
    promptpay: document.getElementById("profilePromptPay")?.value.trim() || "",
    bankName: document.getElementById("profileBankName")?.value.trim() || "",
    bankAccount: document.getElementById("profileBankAccount")?.value.trim() || ""
  };

  saveJoyUsers(users);
  renderCurrentUserUI(users[index]);
  loadProfileForm(users[index]);
  demoToast("Profile saved");
}

function shuffleAvatar() {
  const current = getCurrentUser();
  if (!current) {
    return;
  }

  const users = getJoyUsers();
  const index = users.findIndex((user) => user.id === current.id);
  const colors = ["ffd5dc", "d5efff", "dff2d8", "eee1ff", "fff0c7", "f7d9ff"];
  const seed = `${current.name}-${Date.now()}`;
  const color = colors[Math.floor(Math.random() * colors.length)];
  users[index].avatarSeed = seed;
  users[index].avatarColor = color;
  users[index].avatar = avatarUrl(seed, color);
  saveJoyUsers(users);
  renderCurrentUserUI(users[index]);
  loadProfileForm(users[index]);
  demoToast("New avatar ready");
}

function getUISettings() {
  try {
    return JSON.parse(localStorage.getItem(JJ_UI_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveTheme(theme) {
  const settings = { ...getUISettings(), theme };
  localStorage.setItem(JJ_UI_KEY, JSON.stringify(settings));
  setTheme(theme, true);
}

function saveAnimationSetting(enabled) {
  const settings = { ...getUISettings(), animations: Boolean(enabled) };
  localStorage.setItem(JJ_UI_KEY, JSON.stringify(settings));
  applyUISettings(settings);
}

function saveSparkleSetting(enabled) {
  const settings = { ...getUISettings(), sparkles: Boolean(enabled) };
  localStorage.setItem(JJ_UI_KEY, JSON.stringify(settings));
  applyUISettings(settings);
}

function applyUISettings(settings = getUISettings()) {
  setTheme(settings.theme || "sakura", false);
  document.body.classList.toggle("reduce-cute-motion", settings.animations === false);
  document.body.classList.toggle("hide-sparkles", settings.sparkles === false);
  const animationToggle = document.getElementById("animationToggle");
  const sparkleToggle = document.getElementById("sparkleToggle");
  if (animationToggle) animationToggle.checked = settings.animations !== false;
  if (sparkleToggle) sparkleToggle.checked = settings.sparkles !== false;
}

function loadUISettings() {
  applyUISettings(getUISettings());
}

document.addEventListener("DOMContentLoaded", bootstrapAuth);
