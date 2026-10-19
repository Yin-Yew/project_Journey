const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "../public");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

app.get("/api/health", (req, res) => {
  res.json({
    app: "JoyJourney",
    status: "ok"
  });
});

app.listen(PORT, () => {
  console.log(`JoyJourney running at http://localhost:${PORT}`);
});
