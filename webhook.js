const express = require("express");
const stripe = require("../stripe");
const bodyParser = require("body-parser");
const { upsertStatus } = require("../db");

const router = express.Router();

router.post(
  "/",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const data = event.data.object;

    try {
      // Founder (one-time payment) completes here, since there's no
      // subscription object involved at all.
      if (event.type === "checkout.session.completed" && data.metadata?.plan === "founder") {
        await upsertStatus(data.metadata.email, "founder", "active");
      }

      // A new subscription (monthly or yearly Pro) was created.
      if (event.type === "customer.subscription.created") {
        const email = data.metadata?.email;
        if (email) {
          await upsertStatus(email, data.metadata?.plan || "pro", "active");
        }
      }

      // Recurring renewal payment succeeded — keep status active.
      if (event.type === "invoice.paid" && data.subscription) {
        const subscription = await stripe.subscriptions.retrieve(data.subscription);
        const email = subscription.metadata?.email;
        if (email) {
          await upsertStatus(email, subscription.metadata?.plan || "pro", "active");
        }
      }

      // Payment failed — mark as past_due rather than immediately revoking,
      // giving Stripe's own retry schedule a chance to recover it first.
      if (event.type === "invoice.payment_failed" && data.subscription) {
        const subscription = await stripe.subscriptions.retrieve(data.subscription);
        const email = subscription.metadata?.email;
        if (email) {
          await upsertStatus(email, subscription.metadata?.plan || "pro", "past_due");
        }
      }

      // Subscription cancelled (by the customer or after repeated failed
      // payments) — this is the actual downgrade trigger.
      if (event.type === "customer.subscription.deleted") {
        const email = data.metadata?.email;
        if (email) {
          await upsertStatus(email, "free", "canceled");
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      // Still acknowledge receipt to Stripe so it doesn't keep retrying a
      // request that failed for a reason Stripe can't fix by retrying.
      res.status(200).json({ received: true, error: "handler error, logged" });
    }
  }
);

module.exports = router;
