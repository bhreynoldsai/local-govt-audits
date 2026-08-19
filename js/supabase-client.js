// True North client portal — Supabase client bootstrap.
//
// This key is a "publishable" key, safe to ship in client-side code: it
// identifies the project but grants no access on its own. Every read and
// write is enforced server-side by Postgres Row Level Security, scoped to
// the signed-in user's own organization. See supabase/migrations/ in the
// repo for the actual access-control rules.
const SUPABASE_URL = "https://vjlhreowofhtpskreckv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_0gzgbXfx7wa1ppSsqtnItQ_dIDq5DEl";

window.sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

window.DOCUMENT_CATEGORIES = [
  { key: "general_ledger", label: "General Ledger & Trial Balance" },
  { key: "bank_investment", label: "Bank & Investment Records" },
  { key: "budget", label: "Budget Documents" },
  { key: "governance_legal", label: "Governance & Legal" },
  { key: "capital_debt", label: "Capital Assets & Long-Term Debt" },
  { key: "payroll_benefits", label: "Payroll & Benefits" },
  { key: "revenue_support", label: "Revenue Support" },
  { key: "federal_grants", label: "Federal Grants (Single Audit)" },
  { key: "payables_prior_year", label: "Payables & Prior-Year Items" },
];

window.sbGetSession = async function () {
  const { data } = await window.sbClient.auth.getSession();
  return data.session || null;
};

// Resolves the signed-in user's profile row, finishing account setup
// (creating their organization) if they just confirmed their email and
// haven't landed back here since signing up.
window.sbEnsureProfile = async function () {
  const session = await window.sbGetSession();
  if (!session) return { session: null, profile: null };

  let profile = await fetchOwnProfile(session.user.id);

  if (!profile) {
    const pendingRaw = localStorage.getItem("tnPendingOrgSetup");
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw);
        const { error } = await window.sbClient.rpc("create_organization_and_profile", {
          p_org_name: pending.orgName,
          p_entity_type: pending.entityType,
          p_full_name: pending.fullName,
        });
        if (!error) {
          localStorage.removeItem("tnPendingOrgSetup");
          profile = await fetchOwnProfile(session.user.id);
        }
      } catch (e) {
        // Malformed localStorage value -- fall through and let the caller
        // handle the "no profile yet" case.
      }
    }
  }

  return { session, profile };
};

async function fetchOwnProfile(userId) {
  const { data } = await window.sbClient
    .from("profiles")
    .select("id, org_id, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  return data || null;
}

window.sbSignOut = async function () {
  await window.sbClient.auth.signOut();
  window.location.href = "portal-login.html";
};

window.sbEscapeForDisplay = function (str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
};

window.sbFormatBytes = function (bytes) {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return Math.round(kb) + " KB";
  return (kb / 1024).toFixed(1) + " MB";
};

window.sbFormatDate = function (iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
