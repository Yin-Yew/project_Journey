const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { query, withTransaction } = require("../database");
const { HttpError, asyncRoute, publicUser, requireUser } = require("../helpers");

const router = express.Router();
router.use(requireUser);

const UPLOAD_DIR = path.join(__dirname, "../../uploads");
const COVER_DIR = path.join(UPLOAD_DIR, "covers");
const DEFAULT_COVER = "https://images.pexels.com/photos/36148825/pexels-photo-36148825.jpeg?auto=compress&cs=tinysrgb&w=1200";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/* ---------- helpers ---------- */

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function todayString() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function validateTripInput(body) {
  const name = String(body.name ?? "").trim();
  const destination = String(body.destination ?? "").trim();
  const startDate = String(body.startDate ?? "");
  const endDate = String(body.endDate ?? "");
  const budget = body.budget === "" || body.budget === undefined || body.budget === null ? 0 : Number(body.budget);

  if (!name) throw new HttpError(400, "Please enter a trip name");
  if (name.length > 150) throw new HttpError(400, "Trip name is too long (max 150)");
  if (!destination) throw new HttpError(400, "Please enter a destination");
  if (destination.length > 150) throw new HttpError(400, "Destination is too long (max 150)");
  if (!isValidDate(startDate) || !isValidDate(endDate)) throw new HttpError(400, "Please choose valid start and end dates");
  if (endDate < startDate) throw new HttpError(400, "End date must be on or after the start date");
  if (!Number.isFinite(budget) || budget < 0) throw new HttpError(400, "Budget must be 0 or more");
  if (budget > 9999999999) throw new HttpError(400, "Budget is too large");

  return { name, destination, startDate, endDate, budget: Math.round(budget * 100) / 100 };
}

/* Accepts a data:image/... URL from the browser and stores it in /uploads/covers */
function saveCover(cover) {
  if (!cover) return null;
  const value = String(cover);
  if (/^https?:\/\//i.test(value) || value.startsWith("/uploads/")) {
    return value.slice(0, 2000);
  }
  const match = value.match(/^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new HttpError(400, "Cover must be a JPG, PNG, WEBP or GIF image");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_COVER_BYTES) {
    throw new HttpError(400, "Cover photo is too large (max 5 MB)");
  }
  fs.mkdirSync(COVER_DIR, { recursive: true });
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(COVER_DIR, fileName), buffer);
  return `/uploads/covers/${fileName}`;
}

function removeLocalCover(url) {
  if (!url || !url.startsWith("/uploads/covers/")) return;
  const file = path.join(COVER_DIR, path.basename(url));
  fs.promises.unlink(file).catch(() => {});
}

async function generateInviteCode(connection) {
  const run = connection ? (sql, params) => connection.query(sql, params).then(([rows]) => rows) : query;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bytes = crypto.randomBytes(6);
    const code = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
    const rows = await run("SELECT id FROM trips WHERE invite_code = ?", [code]);
    if (!rows.length) return code;
  }
  throw new HttpError(500, "Could not generate an invite code, please try again");
}

/* Active trips whose end date has passed are finished automatically */
async function autoFinishTrips() {
  await query("UPDATE trips SET status = 'finished' WHERE status = 'active' AND end_date < ?", [todayString()]);
}

function serializeTrip(row, members, myRole) {
  return {
    id: String(row.id),
    name: row.name,
    destination: row.destination || "",
    startDate: row.start_date,
    endDate: row.end_date,
    budget: Number(row.budget || 0),
    cover: row.cover_url || DEFAULT_COVER,
    inviteCode: row.invite_code,
    status: row.status,
    ownerId: row.owner_client_id,
    myRole,
    members,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function membersForTrips(tripIds) {
  if (!tripIds.length) return {};
  const rows = await query(
    `SELECT tm.trip_id, tm.role, tm.joined_at, u.*
       FROM trip_members tm
       JOIN users u ON u.id = tm.user_id
      WHERE tm.trip_id IN (?)
      ORDER BY tm.role = 'owner' DESC, tm.joined_at ASC, u.name ASC`,
    [tripIds]
  );
  const byTrip = {};
  rows.forEach((row) => {
    byTrip[row.trip_id] = byTrip[row.trip_id] || [];
    byTrip[row.trip_id].push({ ...publicUser(row), role: row.role, joinedAt: row.joined_at });
  });
  return byTrip;
}

const TRIP_SELECT = `
  SELECT t.*, tm.role AS my_role, owner.client_id AS owner_client_id
    FROM trips t
    JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = ?
    JOIN users owner ON owner.id = t.owner_id`;

/* Load a trip the current user belongs to, or throw 404/403 */
async function loadTrip(req, { ownerOnly = false } = {}) {
  const tripId = Number(req.params.id);
  if (!Number.isInteger(tripId) || tripId <= 0) {
    throw new HttpError(404, "Trip not found");
  }
  const [row] = await query(`${TRIP_SELECT} WHERE t.id = ?`, [req.user.id, tripId]);
  if (!row) {
    const [exists] = await query("SELECT id FROM trips WHERE id = ?", [tripId]);
    throw exists ? new HttpError(403, "You are not a member of this trip") : new HttpError(404, "Trip not found");
  }
  if (ownerOnly && row.my_role !== "owner") {
    throw new HttpError(403, "Only the trip owner can do this");
  }
  return row;
}

async function sendTrip(res, tripId, userId, status = 200) {
  const [row] = await query(`${TRIP_SELECT} WHERE t.id = ?`, [userId, tripId]);
  const members = await membersForTrips([tripId]);
  res.status(status).json({ trip: serializeTrip(row, members[tripId] || [], row.my_role) });
}

/* ---------- routes ---------- */

// GET /api/trips?status=active|finished|all
router.get(
  "/",
  asyncRoute(async (req, res) => {
    await autoFinishTrips();
    const status = ["active", "finished"].includes(req.query.status) ? req.query.status : null;
    const rows = await query(
      `${TRIP_SELECT} ${status ? "WHERE t.status = ?" : ""}
       ORDER BY t.status = 'finished' ASC, t.start_date ASC, t.id ASC`,
      status ? [req.user.id, status] : [req.user.id]
    );
    const members = await membersForTrips(rows.map((row) => row.id));
    res.json({ trips: rows.map((row) => serializeTrip(row, members[row.id] || [], row.my_role)) });
  })
);

// POST /api/trips  — create (current user becomes owner)
router.post(
  "/",
  asyncRoute(async (req, res) => {
    const input = validateTripInput(req.body || {});
    if (input.endDate < todayString()) {
      throw new HttpError(400, "This trip has already ended. Choose an end date from today onwards");
    }
    const cover = saveCover(req.body.cover) || DEFAULT_COVER;
    const tripId = await withTransaction(async (connection) => {
      const inviteCode = await generateInviteCode(connection);
      const [result] = await connection.query(
        `INSERT INTO trips (owner_id, name, destination, start_date, end_date, budget, cover_url, invite_code, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [req.user.id, input.name, input.destination, input.startDate, input.endDate, input.budget, cover, inviteCode]
      );
      await connection.query("INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'owner')", [result.insertId, req.user.id]);
      return result.insertId;
    });
    await sendTrip(res, tripId, req.user.id, 201);
  })
);

// POST /api/trips/join  { code }
router.post(
  "/join",
  asyncRoute(async (req, res) => {
    const code = String(req.body?.code || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) throw new HttpError(400, "Please enter an invite code");
    await autoFinishTrips();
    const [trip] = await query("SELECT id, status FROM trips WHERE invite_code = ?", [code]);
    if (!trip) throw new HttpError(404, "Invite code not found");

    const [membership] = await query("SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?", [trip.id, req.user.id]);
    if (membership) {
      res.setHeader("X-Already-Member", "1");
      return sendTrip(res, trip.id, req.user.id);
    }
    if (trip.status === "finished") {
      throw new HttpError(400, "This trip has already finished");
    }
    await query("INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'member')", [trip.id, req.user.id]);
    await sendTrip(res, trip.id, req.user.id, 201);
  })
);

// GET /api/trips/:id
router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    await autoFinishTrips();
    const row = await loadTrip(req);
    await sendTrip(res, row.id, req.user.id);
  })
);

// PUT /api/trips/:id  — edit trip details (owner or member)
router.put(
  "/:id",
  asyncRoute(async (req, res) => {
    const row = await loadTrip(req);
    const input = validateTripInput(req.body || {});
    let cover = row.cover_url;
    if (req.body.cover && req.body.cover !== row.cover_url) {
      cover = saveCover(req.body.cover);
      removeLocalCover(row.cover_url);
    }
    // Editing dates of a finished trip into the future re-opens nothing automatically;
    // editing an active trip so it already ended finishes it.
    const status = row.status === "active" && input.endDate < todayString() ? "finished" : row.status;
    await query(
      `UPDATE trips SET name = ?, destination = ?, start_date = ?, end_date = ?, budget = ?, cover_url = ?, status = ? WHERE id = ?`,
      [input.name, input.destination, input.startDate, input.endDate, input.budget, cover, status, row.id]
    );
    await sendTrip(res, row.id, req.user.id);
  })
);

// DELETE /api/trips/:id  — delete (owner)
router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const row = await loadTrip(req, { ownerOnly: true });
    await query("DELETE FROM trips WHERE id = ?", [row.id]);
    removeLocalCover(row.cover_url);
    res.json({ ok: true, id: String(row.id) });
  })
);

// PATCH /api/trips/:id/status  { status: 'active' | 'finished' }  (owner or member)
router.patch(
  "/:id/status",
  asyncRoute(async (req, res) => {
    const row = await loadTrip(req);
    const status = req.body?.status;
    if (!["active", "finished"].includes(status)) {
      throw new HttpError(400, "Status must be active or finished");
    }
    if (status === "active" && row.end_date < todayString()) {
      throw new HttpError(400, "This trip's end date has passed. Edit the dates before making it active again");
    }
    await query("UPDATE trips SET status = ? WHERE id = ?", [status, row.id]);
    await sendTrip(res, row.id, req.user.id);
  })
);

// POST /api/trips/:id/invite-code  — new invite code (owner)
router.post(
  "/:id/invite-code",
  asyncRoute(async (req, res) => {
    const row = await loadTrip(req, { ownerOnly: true });
    const code = await generateInviteCode();
    await query("UPDATE trips SET invite_code = ? WHERE id = ?", [code, row.id]);
    await sendTrip(res, row.id, req.user.id);
  })
);

// POST /api/trips/:id/members  { identifier: email or username }  (owner)
router.post(
  "/:id/members",
  asyncRoute(async (req, res) => {
    const row = await loadTrip(req, { ownerOnly: true });
    if (row.status === "finished") throw new HttpError(400, "You cannot add members to a finished trip");
    const identifier = String(req.body?.identifier || "").trim().toLowerCase();
    if (!identifier) throw new HttpError(400, "Enter your friend's email or username");
    const [user] = await query(
      "SELECT id, name FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? OR LOWER(client_id) = ? LIMIT 1",
      [identifier, identifier, identifier]
    );
    if (!user) throw new HttpError(404, "No JoyJourney account found with that email or username");
    const [existing] = await query("SELECT role FROM trip_members WHERE trip_id = ? AND user_id = ?", [row.id, user.id]);
    if (existing) throw new HttpError(409, `${user.name} is already in this trip`);
    await query("INSERT INTO trip_members (trip_id, user_id, role) VALUES (?, ?, 'member')", [row.id, user.id]);
    await sendTrip(res, row.id, req.user.id, 201);
  })
);

// DELETE /api/trips/:id/members/:userId  — owner removes a member, or a member leaves
router.delete(
  "/:id/members/:userId",
  asyncRoute(async (req, res) => {
    const row = await loadTrip(req);
    const [target] = await query(
      `SELECT u.id, u.name, tm.role FROM trip_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.trip_id = ? AND u.client_id = ?`,
      [row.id, req.params.userId]
    );
    if (!target) throw new HttpError(404, "Member not found in this trip");

    const leavingSelf = target.id === req.user.id;
    if (!leavingSelf && row.my_role !== "owner") {
      throw new HttpError(403, "Only the trip owner can remove members");
    }
    if (target.role === "owner") {
      throw new HttpError(400, leavingSelf
        ? "Owners cannot leave. Transfer ownership to another member or delete the trip"
        : "The owner cannot be removed");
    }
    await query("DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?", [row.id, target.id]);
    if (leavingSelf) {
      return res.json({ ok: true, left: true });
    }
    await sendTrip(res, row.id, req.user.id);
  })
);

// PATCH /api/trips/:id/members/:userId  { role: 'owner' }  — transfer ownership (owner)
router.patch(
  "/:id/members/:userId",
  asyncRoute(async (req, res) => {
    const row = await loadTrip(req, { ownerOnly: true });
    if (req.body?.role !== "owner") {
      throw new HttpError(400, "Only ownership transfer is supported (role: owner)");
    }
    const [target] = await query(
      `SELECT u.id, tm.role FROM trip_members tm JOIN users u ON u.id = tm.user_id
        WHERE tm.trip_id = ? AND u.client_id = ?`,
      [row.id, req.params.userId]
    );
    if (!target) throw new HttpError(404, "Member not found in this trip");
    if (target.id === req.user.id) throw new HttpError(400, "You are already the owner");

    await withTransaction(async (connection) => {
      await connection.query("UPDATE trip_members SET role = 'member' WHERE trip_id = ? AND user_id = ?", [row.id, req.user.id]);
      await connection.query("UPDATE trip_members SET role = 'owner' WHERE trip_id = ? AND user_id = ?", [row.id, target.id]);
      await connection.query("UPDATE trips SET owner_id = ? WHERE id = ?", [target.id, row.id]);
    });
    await sendTrip(res, row.id, req.user.id);
  })
);

module.exports = router;
