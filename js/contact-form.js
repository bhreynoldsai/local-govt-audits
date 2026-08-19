document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("#contact-form");
  if (!form) return;

  var success = document.querySelector(".form-success");
  var errorBox = document.querySelector("#contact-error");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (errorBox) {
      errorBox.textContent = "";
      errorBox.classList.remove("show");
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Honeypot: this field is hidden from real visitors via CSS. Bots that
    // fill in every field trip it; humans never see or fill it.
    if (form.website && form.website.value) {
      form.reset();
      if (success) success.classList.add("show");
      return;
    }

    if (typeof window.sbClient === "undefined") {
      showError("We couldn't reach our server. Please email us directly at bernard@truenorth-inc.com.");
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending…";

    // Deliberately no .select() here -- the table has no SELECT policy
    // for any API role by design (write-only from the public API), and
    // requesting the row back would make the whole insert fail.
    const { error } = await window.sbClient.from("contact_submissions").insert({
      name: form.name.value.trim(),
      entity_name: form.entity.value.trim(),
      email: form.email.value.trim(),
      role: form.role.value,
      message: form.message.value.trim(),
    });

    btn.disabled = false;
    btn.textContent = originalLabel;

    if (error) {
      showError("Something went wrong sending your message. Please email us directly at bernard@truenorth-inc.com.");
      return;
    }

    if (success) {
      success.classList.add("show");
      success.setAttribute("tabindex", "-1");
      success.focus();
    }
    form.reset();
  });

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.add("show");
  }
});
