const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const express = require("express");
const { initDatabase } = require("./database");
const { HttpError } = require("./helpers");
const usersRouter = require("./routes/users");
const tripsRouter = require("./routes/trips");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "../public");
const UPLOAD_DIR = path.join(__dirname, "../uploads");

// Trip covers are sent as base64 images, so allow a larger body.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/health", (req, res) => {
  res.json({
    app: "JoyJourney",
    status: "ok"
  });
});

app.use("/api/users", usersRouter);
app.use("/api/trips", tripsRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Upload is too large" });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server" });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`JoyJourney running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not connect to MySQL. Check DB_HOST / DB_USER / DB_PASSWORD in .env");
    console.error(error.message);
    process.exit(1);
  });
