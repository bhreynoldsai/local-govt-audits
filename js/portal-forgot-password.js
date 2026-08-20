document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("#forgot-form");
  if (!form) return;
  var errorBox = document.querySelector("#forgot-error");
  var successBox = document.querySelector("#forgot-success");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorBox.textContent = "";
    errorBox.classList.remove("show");
    successBox.classList.remove("show");

    if (typeof window.sbClient === "undefined") {
      errorBox.textContent = "We couldn't reach our authentication provider. Please try again shortly.";
      errorBox.classList.add("show");
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending…";

    var email = form.email.value.trim();
    var redirectTo = window.location.origin + window.location.pathname.replace(/portal-forgot-password\.html$/, "portal-reset-password.html");

    // Supabase returns success even for an unknown email -- this
    // deliberately doesn't reveal whether an account exists.
    await window.sbClient.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });

    btn.disabled = false;
    btn.textContent = originalLabel;
    successBox.classList.add("show");
    form.reset();
  });
});
