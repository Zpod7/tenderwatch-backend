require("dotenv").config();

const express = require("express");
const cors = require("cors");

const checkoutRoute = require("./routes/checkout");
const webhookRoute = require("./routes/webhook");
const statusRoute = require("./routes/status");

const app = express();

app.use(cors());

// IMPORTANT: the webhook route needs the raw request body for Stripe's
// signature verification, so it's mounted BEFORE express.json() runs on
// everything else, and it parses its own body internally (see webhook.js).
app.use("/stripe/webhook", webhookRoute);

app.use(express.json());
app.use("/create-checkout-session", checkoutRoute);
app.use("/status", statusRoute);

app.get("/", (req, res) => {
  res.send("TenderWatch backend running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
