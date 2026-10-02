const { query } = require("./database");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* Wrap async route handlers so thrown errors reach the error middleware */
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

/* Map a users row to the shape the frontend already uses */
function publicUser(row, { includeEmail = false } = {}) {
  const user = {
    id: row.client_id,
    name: row.name,
    username: row.username || "",
    avatar: row.avatar || "",
    style: row.travel_style || "",
    promptpay: row.promptpay || "",
    bankName: row.bank_name || "",
    bankAccount: row.bank_account || ""
  };
  if (includeEmail) {
    user.email = row.email;
  }
  return user;
}

/*
 * Prototype identity: the browser still keeps the login session, so every API
 * call sends the logged-in user's id in the X-User-Id header. The user row is
 * created/updated by POST /api/users/sync. Replace this with JWT later.
 */
const requireUser = asyncRoute(async (req, res, next) => {
  const clientId = String(req.get("X-User-Id") || "").trim();
  if (!clientId) {
    throw new HttpError(401, "Please log in first");
  }
  const [user] = await query("SELECT * FROM users WHERE client_id = ?", [clientId]);
  if (!user) {
    throw new HttpError(401, "Your account is not synced with the server yet");
  }
  req.user = user;
  next();
});

module.exports = { HttpError, asyncRoute, publicUser, requireUser };
