document.addEventListener("DOMContentLoaded", async function () {
  var form = document.querySelector("#reset-form");
  var errorBox = document.querySelector("#reset-error");
  var successBox = document.querySelector("#reset-success");
  if (!form) return;

  var submitBtn = form.querySelector('button[type="submit"]');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add("show");
  }

  function disableForm() {
    form.querySelectorAll("input, button").forEach(function (el) {
      el.disabled = true;
    });
  }

  // The submit button starts disabled -- it's only re-enabled once a
  // recovery session is confirmed, so it's never possible to submit
  // before we actually know whether the link was valid.
  submitBtn.disabled = true;

  if (typeof window.sbClient === "undefined") {
    showError("We couldn't reach our authentication provider. Please reload the page.");
    disableForm();
    return;
  }

  // Supabase's automatic hash-based session detection can race with this
  // script attaching a listener for it, so read the recovery tokens
  // straight out of the URL and establish the session ourselves instead
  // of waiting on a timer and hoping it's finished.
  var hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  var accessToken = hashParams.get("access_token");
  var refreshToken = hashParams.get("refresh_token");
  var hashError = hashParams.get("error_description");

  var ready = false;

  if (hashError) {
    showError(decodeURIComponent(hashError.replace(/\+/g, " ")));
    disableForm();
    return;
  }

  if (accessToken && refreshToken) {
    var setResult = await window.sbClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!setResult.error) {
      ready = true;
      // Clear the tokens out of the URL so they aren't left sitting in
      // browser history or an accidental screenshot/share.
      history.replaceState(null, "", window.location.pathname);
    }
  }

  if (!ready) {
    var sessionResult = await window.sbClient.auth.getSession();
    if (sessionResult.data.session) ready = true;
  }

  if (!ready) {
    showError("This reset link is invalid or has expired. Please request a new one.");
    disableForm();
    return;
  }

  submitBtn.disabled = false;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorBox.textContent = "";
    errorBox.classList.remove("show");

    if (form.password.value.length < 8) {
      showError("Password must be at least 8 characters.");
      return;
    }
    if (form.password.value !== form.confirmPassword.value) {
      showError("Passwords don't match.");
      return;
    }

    var originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Updating…";

    const { error } = await window.sbClient.auth.updateUser({ password: form.password.value });

    if (error) {
      showError(error.message);
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
      return;
    }

    successBox.classList.add("show");
    form.style.display = "none";
    setTimeout(function () {
      window.location.href = "portal-dashboard.html";
    }, 1800);
  });
});
