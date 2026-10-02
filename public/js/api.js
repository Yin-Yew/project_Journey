/* JoyJourney API client — talks to the Express + MySQL server in /server */
const JJ_API_BASE = "/api";

class JoyApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function jjApi(path, { method = "GET", body } = {}) {
  const userId = typeof getCurrentUserId === "function" ? getCurrentUserId() : "";
  let response;
  try {
    response = await fetch(`${JJ_API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(userId ? { "X-User-Id": userId } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new JoyApiError("Cannot reach the JoyJourney server. Is it running?", 0);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    throw new JoyApiError(data.error || `Request failed (${response.status})`, response.status);
  }
  return data;
}

/* Copy the logged-in browser profile into the users table so trips can reference it */
async function jjSyncUser(user = typeof getCurrentUser === "function" ? getCurrentUser() : null) {
  if (!user) return null;
  const data = await jjApi("/users/sync", {
    method: "POST",
    body: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      style: user.style,
      promptpay: user.promptpay,
      bankName: user.bankName,
      bankAccount: user.bankAccount
    }
  });
  return data.user;
}

const JoyTripsAPI = {
  list: (status = "all") => jjApi(`/trips?status=${encodeURIComponent(status)}`).then((data) => data.trips),
  get: (id) => jjApi(`/trips/${encodeURIComponent(id)}`).then((data) => data.trip),
  create: (trip) => jjApi("/trips", { method: "POST", body: trip }).then((data) => data.trip),
  update: (id, trip) => jjApi(`/trips/${encodeURIComponent(id)}`, { method: "PUT", body: trip }).then((data) => data.trip),
  remove: (id) => jjApi(`/trips/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setStatus: (id, status) => jjApi(`/trips/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }).then((data) => data.trip),
  newInviteCode: (id) => jjApi(`/trips/${encodeURIComponent(id)}/invite-code`, { method: "POST" }).then((data) => data.trip),
  join: (code) => jjApi("/trips/join", { method: "POST", body: { code } }).then((data) => data.trip),
  addMember: (id, identifier) => jjApi(`/trips/${encodeURIComponent(id)}/members`, { method: "POST", body: { identifier } }).then((data) => data.trip),
  removeMember: (id, userId) => jjApi(`/trips/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }),
  makeOwner: (id, userId) => jjApi(`/trips/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: "PATCH", body: { role: "owner" } }).then((data) => data.trip)
};
