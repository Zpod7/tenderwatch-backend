const express = require("express");
const { getStatus } = require("../db");

const router = express.Router();

// No login/token required — this just answers "is this email active?"
// using the same email the customer entered at checkout. Low-stakes by
// design: it reveals only a yes/no, never any billing or personal detail.
router.get("/", async (req, res) => {
  const email = (req.query.email || "").toLowerCase().trim();

  if (!email) {
    return res.status(400).json({ active: false, error: "email is required" });
  }

  try {
    const record = await getStatus(email);
    const active = !!record && (record.status === "active");
    res.json({ active, plan: record?.plan || "free" });
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ active: false, error: "server error" });
  }
});

module.exports = router;
