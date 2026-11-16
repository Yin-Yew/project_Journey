/* Shared profile and appearance UI. Real accounts live in MySQL. */
const JJ_UI_KEY='joyjourneyUI';
function avatarUrl(seed, color = "ffd5dc") {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${encodeURIComponent(color)}`;
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

function showAuthMessage(element, text, type) {
  if (!element) {
    return;
  }
  element.textContent = text;
  element.className = `form-message ${type}`;
}

function loadProfileForm(user = getCurrentUser()) {
  if (!user || !document.getElementById("profileForm")) {
    return;
  }

  const values = {
    profileName: user.name || "",
    profileEmail: user.email || "",
    profileStyle: user.style || "",
    profilePromptPay: user.promptpay || ""
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
  if (handle) handle.textContent = user.email || "";
  if (style) style.textContent = user.style || "Happy Traveler";
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

// Server authentication bootstrap lives in js/trips-api.js.
