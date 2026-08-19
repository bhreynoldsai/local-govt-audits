document.addEventListener("DOMContentLoaded", function () {
  // Wire up the UI unconditionally first -- a slow, blocked, or failed
  // load of the Supabase SDK (ad blocker, network hiccup, outage) must
  // never leave the tabs/forms inert with no explanation.
  initTabs();
  initLoginForm();
  initSignupForm();
  checkExistingSession();
});

async function checkExistingSession() {
  if (typeof window.sbEnsureProfile !== "function") {
    showSdkError();
    return;
  }
  try {
    const { session, profile } = await window.sbEnsureProfile();
    if (session && profile) {
      window.location.href = "portal-dashboard.html";
    }
  } catch (e) {
    // Not fatal -- the user can still log in or sign up normally.
  }
}

function showSdkError() {
  var banner = document.querySelector("#sdk-error");
  if (banner) banner.classList.add("show");
}

function initTabs() {
  var tabs = document.querySelectorAll("[data-portal-tab]");
  var panels = document.querySelectorAll("[data-portal-panel]");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      panels.forEach(function (p) { p.classList.remove("active"); });
      tab.classList.add("active");
      document.querySelector('[data-portal-panel="' + tab.dataset.portalTab + '"]').classList.add("active");
    });
  });
}

function showError(el, message) {
  el.textContent = message;
  el.classList.add("show");
}

function clearError(el) {
  el.textContent = "";
  el.classList.remove("show");
}

function initLoginForm() {
  var form = document.querySelector("#login-form");
  if (!form) return;
  var errorBox = document.querySelector("#login-error");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError(errorBox);

    if (typeof window.sbClient === "undefined") {
      showSdkError();
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Signing in…";

    var email = form.email.value.trim();
    var password = form.password.value;

    const { error } = await window.sbClient.auth.signInWithPassword({ email: email, password: password });
    if (error) {
      showError(errorBox, error.message);
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }

    const { profile } = await window.sbEnsureProfile();
    if (!profile) {
      showError(errorBox, "We couldn't finish setting up your account. Please contact us for help.");
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }
    window.location.href = "portal-dashboard.html";
  });
}

function initSignupForm() {
  var form = document.querySelector("#signup-form");
  if (!form) return;
  var errorBox = document.querySelector("#signup-error");
  var successBox = document.querySelector("#signup-success");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearError(errorBox);
    successBox.classList.remove("show");

    if (typeof window.sbClient === "undefined") {
      showSdkError();
      return;
    }

    if (form.password.value.length < 8) {
      showError(errorBox, "Password must be at least 8 characters.");
      return;
    }
    if (form.password.value !== form.confirmPassword.value) {
      showError(errorBox, "Passwords don't match.");
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Creating account…";

    var email = form.email.value.trim();
    var password = form.password.value;
    var fullName = form.fullName.value.trim();
    var orgName = form.orgName.value.trim();
    var entityType = form.entityType.value;

    const { data, error } = await window.sbClient.auth.signUp({ email: email, password: password });

    if (error) {
      showError(errorBox, error.message);
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }

    if (data.session) {
      const { error: rpcError } = await window.sbClient.rpc("create_organization_and_profile", {
        p_org_name: orgName,
        p_entity_type: entityType,
        p_full_name: fullName,
      });
      if (rpcError) {
        showError(errorBox, rpcError.message);
        btn.disabled = false;
        btn.textContent = originalLabel;
        return;
      }
      window.location.href = "portal-dashboard.html";
      return;
    }

    localStorage.setItem("tnPendingOrgSetup", JSON.stringify({
      fullName: fullName,
      orgName: orgName,
      entityType: entityType,
    }));
    form.reset();
    successBox.classList.add("show");
    btn.disabled = false;
    btn.textContent = originalLabel;
  });
}
