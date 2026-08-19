// True North Government Audit Advisors — shared front-end behavior
// No build step, no external dependencies, no data leaves the browser.

document.addEventListener("DOMContentLoaded", function () {
  initNav();
  initFaq();
  initChecklist();
  initThresholdTool();
  initYear();
});

/* ---------------- Mobile nav ---------------- */
function initNav() {
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector("nav.primary-nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", function () {
    var isOpen = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  // Highlight current page in nav
  var here = (window.location.pathname.split("/").pop() || "index.html");
  document.querySelectorAll("nav.primary-nav a[href]").forEach(function (link) {
    var href = link.getAttribute("href");
    if (href === here || (here === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
}

/* ---------------- FAQ accordion ---------------- */
function initFaq() {
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var btn = item.querySelector(".faq-q");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var wasOpen = item.classList.contains("open");
      item.parentElement.querySelectorAll(".faq-item.open").forEach(function (other) {
        if (other !== item) {
          other.classList.remove("open");
          other.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        }
      });
      item.classList.toggle("open", !wasOpen);
      btn.setAttribute("aria-expanded", (!wasOpen).toString());
    });
  });
}

/* ---------------- Compliance checklist with saved progress ---------------- */
function initChecklist() {
  var list = document.querySelector("[data-checklist]");
  if (!list) return;
  var storageKey = "tnga-checklist-" + (list.getAttribute("data-checklist") || "default");
  var boxes = list.querySelectorAll('input[type="checkbox"]');
  var bar = document.querySelector("[data-checklist-bar]");
  var summary = document.querySelector("[data-checklist-summary]");

  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch (e) {
    saved = {};
  }

  function update() {
    var checked = 0;
    boxes.forEach(function (box) {
      box.closest("li").classList.toggle("checked", box.checked);
      if (box.checked) checked++;
    });
    var pct = boxes.length ? Math.round((checked / boxes.length) * 100) : 0;
    if (bar) bar.style.width = pct + "%";
    if (summary) summary.textContent = checked + " of " + boxes.length + " complete (" + pct + "%)";
  }

  boxes.forEach(function (box) {
    if (saved[box.id]) box.checked = true;
    box.addEventListener("change", function () {
      saved[box.id] = box.checked;
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch (e) {}
      update();
    });
  });

  var resetBtn = document.querySelector("[data-checklist-reset]");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      boxes.forEach(function (box) {
        box.checked = false;
      });
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
      update();
    });
  }

  update();
}

/* ---------------- Audit requirement threshold checker ----------------
   Reflects O.C.G.A. § 36-81-7 (local government audit/AUP threshold) and
   2 CFR 200.501 (Single Audit federal-expenditure threshold, effective for
   fiscal years beginning on/after Oct 1, 2024). This is general guidance,
   not legal advice — always confirm current rules with DOAA.
------------------------------------------------------------------------- */
function initThresholdTool() {
  var form = document.querySelector("#threshold-form");
  if (!form) return;
  var resultBox = document.querySelector("#threshold-result");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var population = Number(form.population.value || 0);
    var expenditures = Number(form.expenditures.value || 0);
    var federalExpenditures = Number(form.federalExpenditures.value || 0);
    var hasSplost = form.splost.checked;
    var hasHotelMotel = form.hotelMotel.checked;

    var findings = [];
    var headline, headlineClass;

    var needsFullAudit = population > 1500 || expenditures >= 550000;

    if (needsFullAudit) {
      headline = "A full annual financial audit is required.";
      headlineClass = "warn";
      findings.push(
        (population > 1500
          ? "Population reported above 1,500. "
          : "") +
        (expenditures >= 550000
          ? "Annual expenditures at or above the $550,000 threshold. "
          : "") +
        "Under O.C.G.A. § 36-81-7, this requires an audit performed by an independent CPA, not agreed-upon procedures."
      );
    } else {
      headline = "Agreed-upon procedures (AUP) may be available instead of a full audit.";
      headlineClass = "success";
      findings.push(
        "With population at or below 1,500 and annual expenditures below $550,000, O.C.G.A. § 36-81-7 permits an annual agreed-upon procedures engagement in lieu of a full GAAS audit — the governing body should still confirm eligibility and formally elect this option."
      );
    }

    findings.push(
      "The completed report (audit or AUP) is due to the Department of Audits and Accounts within 180 days of your fiscal year end, submitted through the DOAA portal."
    );

    if (federalExpenditures >= 1000000) {
      findings.push(
        "Federal awards expended (" +
          formatCurrency(federalExpenditures) +
          ") meet or exceed the $1,000,000 Single Audit threshold under 2 CFR 200.501 (Uniform Guidance). A Single Audit or program-specific audit is required in addition to your GAAS audit."
      );
    } else if (federalExpenditures > 0) {
      findings.push(
        "Federal awards expended (" +
          formatCurrency(federalExpenditures) +
          ") are below the $1,000,000 Single Audit threshold, so a Single Audit is not triggered this cycle — Uniform Guidance administrative requirements (procurement, subrecipient monitoring, cost principles) still apply."
      );
    }

    if (hasSplost) {
      findings.push("SPLOST activity noted: your financial statements will need the SPLOST-specific schedule and disclosures required by state law.");
    }
    if (hasHotelMotel) {
      findings.push("Hotel/Motel tax activity noted: a Hotel/Motel Tax compliance schedule and use-of-funds disclosure will be required.");
    }

    resultBox.className = "result-box show callout " + headlineClass;
    resultBox.innerHTML =
      '<div class="glyph">' + (headlineClass === "warn" ? "&#9888;&#65039;" : "&#9989;") + "</div>" +
      "<div><h3>" + headline + "</h3><ul>" +
      findings.map(function (f) { return "<li>" + f + "</li>"; }).join("") +
      "</ul><p class=\"small\" style=\"margin-top:14px;\">This tool gives general guidance based on current Georgia and federal thresholds. It is not legal or accounting advice — confirm your entity's specific requirement with DOAA or your auditor before relying on it.</p></div>";

    resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function formatCurrency(n) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/* ---------------- Footer year ---------------- */
function initYear() {
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
}
