const {
  getFounderCount,
  hasFounderLicense,
  hasActiveProSubscription
} = require("../db");

const express = require("express");
const stripe = require("../stripe");
const router = express.Router();

const PRICE_IDS = { 
  pro_monthly: "price_1TngQkPUaRaG36KRp7ZCaILc", 
  pro_yearly: "price_1TngLlPUaRaG36KRdj7dMnrf", 
  founder: "price_1TngGOPUaRaG36KR3RsjzOOl" 
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

    if (isSubscription) {
  const alreadyPro = await hasActiveProSubscription(email);

  if (alreadyPro) {
    return res.status(400).json({
      error: "You already have an active Pro subscription."
    });
  }
}
    
    if (!isFounder && !isSubscription) {
      return res.status(400).json({ error: "Unknown plan" });
    }

    // 2. Founder rules
    if (isFounder) {

  // already has an active Pro subscription → block
  if (await hasActiveProSubscription(email)) {
    return res.status(400).json({
      error: "You already have an active Pro subscription."
    });
  }

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
      error: "Founder plan is sold out",
      founderSoldOut: true
    });
  }
}
    
    // 3. create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: isFounder ? "payment" : "subscription",
      payment_method_types: ["card"],

      line_items: [{
       price: PRICE_IDS[plan],
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
    console.error("🔥 STRIPE ERROR:", err);
    return res.status(500).json({
       error: "Could not create checkout session"
    });
  }
});

module.exports = router;
