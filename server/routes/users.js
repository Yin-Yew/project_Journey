const express = require("express");
const { query } = require("../database");
const { HttpError, asyncRoute, publicUser, requireUser } = require("../helpers");

const router = express.Router();

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

/* Create or update the logged-in user's row from their browser profile */
router.post(
  "/sync",
  asyncRoute(async (req, res) => {
    const body = req.body || {};
    const clientId = clean(body.id, 80);
    const name = clean(body.name, 100);
    const email = clean(body.email, 150).toLowerCase();

    if (!clientId || !name || !email) {
      throw new HttpError(400, "User id, name and email are required");
    }

    const [emailOwner] = await query("SELECT client_id FROM users WHERE email = ?", [email]);
    if (emailOwner && emailOwner.client_id && emailOwner.client_id !== clientId) {
      throw new HttpError(409, "This email is already used by another account on the server");
    }

    const values = [
      name,
      clean(body.username, 80),
      email,
      clean(body.avatar, 500),
      clean(body.style, 100),
      clean(body.promptpay, 30),
      clean(body.bankName, 80),
      clean(body.bankAccount, 100)
    ];

    const [existing] = await query("SELECT id FROM users WHERE client_id = ?", [clientId]);
    if (existing) {
      await query(
        `UPDATE users SET name = ?, username = ?, email = ?, avatar = ?, travel_style = ?, promptpay = ?, bank_name = ?, bank_account = ?
         WHERE client_id = ?`,
        [...values, clientId]
      );
    } else if (emailOwner) {
      // A row created by the old schema (no client_id yet) — link it.
      await query(
        `UPDATE users SET client_id = ?, name = ?, username = ?, email = ?, avatar = ?, travel_style = ?, promptpay = ?, bank_name = ?, bank_account = ?
         WHERE email = ?`,
        [clientId, ...values, email]
      );
    } else {
      await query(
        `INSERT INTO users (client_id, name, username, email, avatar, travel_style, promptpay, bank_name, bank_account)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, ...values]
      );
    }

    const [user] = await query("SELECT * FROM users WHERE client_id = ?", [clientId]);
    res.json({ user: publicUser(user, { includeEmail: true }) });
  })
);

router.get(
  "/me",
  requireUser,
  asyncRoute(async (req, res) => {
    res.json({ user: publicUser(req.user, { includeEmail: true }) });
  })
);

module.exports = router;
