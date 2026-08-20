document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("#reset-form");
  var errorBox = document.querySelector("#reset-error");
  var successBox = document.querySelector("#reset-success");
  if (!form) return;

  if (typeof window.sbClient === "undefined") {
    showError("We couldn't reach our authentication provider. Please reload the page.");
    disableForm();
    return;
  }

  var ready = false;

  window.sbClient.auth.onAuthStateChange(function (event, session) {
    if (event === "PASSWORD_RECOVERY" && session) {
      ready = true;
    }
  });

  // The recovery token in the URL is processed asynchronously on load.
  // If the PASSWORD_RECOVERY event hasn't fired shortly after, either the
  // link was already used, is malformed, or has expired.
  setTimeout(async function () {
    if (ready) return;
    var result = await window.sbClient.auth.getSession();
    if (result.data.session) {
      ready = true;
    } else {
      showError("This reset link is invalid or has expired. Please request a new one.");
      disableForm();
    }
  }, 1500);

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add("show");
  }

  function disableForm() {
    form.querySelectorAll("input, button").forEach(function (el) {
      el.disabled = true;
    });
  }

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

    var btn = form.querySelector('button[type="submit"]');
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Updating…";

    const { error } = await window.sbClient.auth.updateUser({ password: form.password.value });

    if (error) {
      showError(error.message);
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }

    successBox.classList.add("show");
    form.style.display = "none";
    setTimeout(function () {
      window.location.href = "portal-dashboard.html";
    }, 1800);
  });
});
