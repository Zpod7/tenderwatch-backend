const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// We key everything by email, not a separate user-accounts system — simpler,
// and matches how the extension already works (no login, just an email
// entered once at checkout).

async function upsertStatus(email, plan, status) {
  return supabase.from("subscriptions").upsert(
    [
      {
        email: email.toLowerCase().trim(),
        plan,
        status,
        updated_at: new Date().toISOString()
      }
    ],
    { onConflict: "email" }
  );
}

async function getStatus(email) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .single();

  return data;
}

async function getFounderCount() {
  const { count, error } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("plan", "founder")
    .eq("status", "active");

  if (error) throw error;

  return count || 0;
}

async function hasFounderLicense(email) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error || !data) return false;

  return data.plan === "founder" && data.status === "active";
}

async function hasActiveProSubscription(email) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("email", email.toLowerCase().trim())
    .single();

  if (error || !data) return false;

  const isProPlan =
    data.plan === "pro_monthly" ||
    data.plan === "pro_yearly";

  return isProPlan && data.status === "active";
}

module.exports = {
  supabase,
  upsertStatus,
  getStatus,
  getFounderCount,
  hasFounderLicense,
  hasActiveProSubscription
};
