const { getFounderCount } = require("../db");

const express = require("express");
const stripe = require("../stripe");
const router = express.Router();

// Replace these with your real Stripe Price IDs once created in the
// Stripe Dashboard (Products -> create a recurring price for each).
const PRICE_IDS = {
  pro_monthly: "price_REPLACE_WITH_REAL_MONTHLY_PRICE_ID",
  pro_yearly: "price_REPLACE_WITH_REAL_YEARLY_PRICE_ID"
};

router.post("/", async (req, res) => {
  const { email, plan } = req.body;

  if (!email || !plan) {
    return res.status(400).json({ error: "email and plan are required" });
  }

  try {
    const isFounder = plan === "founder";
    const isSubscription = plan === "pro_monthly" || plan === "pro_yearly";

    if (!isFounder && !isSubscription) {
      return res.status(400).json({ error: "Unknown plan" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: isFounder ? "payment" : "subscription",
      payment_method_types: ["card"],
      line_items: isFounder
        ? [{
            price_data: {
              currency: "usd",
              product_data: { name: "TenderWatch Founder — Lifetime Access" },
              unit_amount: 14900
            },
            quantity: 1
          }]
        : [{ price: PRICE_IDS[plan], quantity: 1 }],

      success_url: `https://zpod7.github.io/tenderwatch-privacy/success.html`,
      cancel_url: `https://zpod7.github.io/tenderwatch-privacy/cancel.html`,

      customer_email: email,

      // Metadata on the Checkout Session itself (covers the one-time
      // Founder purchase, read via checkout.session.completed).
      metadata: { plan, email },

      // For subscriptions specifically, metadata must ALSO be attached
      // here so it propagates onto the actual Subscription object —
      // otherwise later renewal/cancellation webhook events (which
      // reference the Subscription, not the Checkout Session) won't have
      // the email available.
      ...(isSubscription && {
        subscription_data: { metadata: { plan, email } }
      })
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: "Could not create checkout session" });
  }
});

module.exports = router;
