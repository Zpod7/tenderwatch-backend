const {
  getFounderCount,
  hasFounderLicense
} = require("../db");

const express = require("express");
const stripe = require("../stripe");
const router = express.Router();

const PRICE_IDS = {
  pro_monthly: "price_1TnUMMPUaRaG36KR0TsDUoSm",
  pro_yearly: "price_1TlHbNPUaRaG36KRU2w5fXM8",
  founder: "price_1TlHasPUaRaG36KRnF8ND0Zq"
};

router.post("/", async (req, res) => {
  const { email, plan } = req.body;

  // 1. basic validation first
  if (!email || !plan) {
    return res.status(400).json({ error: "email and plan are required" });
  }

  try {
    const isFounder = plan === "founder";
    const isSubscription = plan === "pro_monthly" || plan === "pro_yearly";

    if (!isFounder && !isSubscription) {
      return res.status(400).json({ error: "Unknown plan" });
    }

    // 2. Founder rules
    if (isFounder) {

      // already owns founder → block
      if (await hasFounderLicense(email)) {
        return res.status(400).json({
          error: "You already own the Founder License."
        });
      }

      // limit check
      const founderCount = await getFounderCount();

      if (founderCount >= 50) {
        return res.status(400).json({
          error: "Founder plan is sold out"
        });
      }
    }

    // 3. create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: isFounder ? "payment" : "subscription",
      payment_method_types: ["card"],

      line_items: [{
        price: isFounder
          ? PRICE_IDS.founder
          : PRICE_IDS[plan],
       quantity: 1
      }],

      success_url: "https://zpod7.github.io/tenderwatch-privacy/success.html",
      cancel_url: "https://zpod7.github.io/tenderwatch-privacy/cancel.html",

      customer_email: email,

      metadata: { plan, email },

      ...(isSubscription && {
        subscription_data: {
          metadata: { plan, email }
        }
      })
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({
      error: "Could not create checkout session"
    });
  }
});

module.exports = router;
