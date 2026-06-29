const {
  getFounderCount,
  hasFounderLicense
} = require("../db");

const express = require("express");
const stripe = require("../stripe");
const router = express.Router();

const PRICE_IDS = {
  pro_monthly: {
    usd: "price_1TnguVPUaRaG36KROPGr6zLB",
    gbp: "price_1Tngv5PUaRaG36KRUN4mXYiA",
    eur: "price_1TngvOPUaRaG36KR23BuR1KL"
  },

  pro_yearly: {
    usd: "price_1TngwkPUaRaG36KRviBoxpl0",
    gbp: "price_1TngxGPUaRaG36KRibmymxNP",
    eur: "price_1TngyKPUaRaG36KR1FQ9enAo"
  },

  founder: {
    usd: "price_1Tngz3PUaRaG36KRBtZnX73A",
    gbp: "price_1TngzYPUaRaG36KRGzqWrOlO",
    eur: "price_1TngzwPUaRaG36KRj55QIF0X"
  }
};

router.post("/", async (req, res) => {
  console.log("REQ BODY:", req.body); //

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
