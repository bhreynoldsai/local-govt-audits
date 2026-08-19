var currentSession = null;
var currentProfile = null;

document.addEventListener("DOMContentLoaded", async function () {
  if (typeof window.sbEnsureProfile !== "function") {
    showDashboardError("We couldn't reach our authentication provider. Please check your connection and reload the page.");
    return;
  }

  var session, profile;
  try {
    var result = await window.sbEnsureProfile();
    session = result.session;
    profile = result.profile;
  } catch (e) {
    showDashboardError("Something went wrong loading your account. Please reload the page.");
    return;
  }

  if (!session) {
    window.location.href = "portal-login.html";
    return;
  }
  if (!profile) {
    showDashboardError("We couldn't finish setting up your account. Please contact us for help.");
    return;
  }

  currentSession = session;
  currentProfile = profile;

  await renderOrgHeader();
  renderCategoryCards();
  await loadAllDocuments();
  await loadAuditLog();

  document.querySelector("#sign-out-btn").addEventListener("click", window.sbSignOut);
});

function showDashboardError(message) {
  var el = document.querySelector("#dashboard-error");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
}

async function renderOrgHeader() {
  const { data: org } = await window.sbClient
    .from("organizations")
    .select("name, entity_type")
    .eq("id", currentProfile.org_id)
    .maybeSingle();

  document.querySelector("#org-name").textContent = org ? org.name : "Your organization";
  document.querySelector("#user-name").textContent = currentProfile.full_name || currentSession.user.email;
}

function renderCategoryCards() {
  var container = document.querySelector("#category-grid");
  container.innerHTML = "";

  window.DOCUMENT_CATEGORIES.forEach(function (cat) {
    var card = document.createElement("div");
    card.className = "card doc-card";
    card.dataset.category = cat.key;

    var heading = document.createElement("h3");
    heading.textContent = cat.label;

    var uploadWrap = document.createElement("div");
    uploadWrap.className = "portal-upload";

    var uploadLabel = document.createElement("label");
    uploadLabel.className = "btn btn-outline btn-block portal-upload-btn";
    uploadLabel.textContent = "Upload file";

    var uploadInput = document.createElement("input");
    uploadInput.type = "file";
    uploadInput.className = "sr-only";
    uploadInput.addEventListener("change", function (e) {
      handleUpload(e, cat.key);
    });
    uploadLabel.appendChild(uploadInput);

    var statusEl = document.createElement("p");
    statusEl.className = "small portal-upload-status";

    uploadWrap.appendChild(uploadLabel);
    uploadWrap.appendChild(statusEl);

    var list = document.createElement("ul");
    list.className = "portal-file-list";

    card.appendChild(heading);
    card.appendChild(uploadWrap);
    card.appendChild(list);
    container.appendChild(card);
  });
}

async function handleUpload(e, category) {
  var input = e.target;
  var file = input.files[0];
  if (!file) return;

  var card = input.closest(".doc-card");
  var statusEl = card.querySelector(".portal-upload-status");

  if (file.size > 25 * 1024 * 1024) {
    statusEl.textContent = "File too large (25MB max).";
    input.value = "";
    return;
  }

  statusEl.textContent = "Uploading…";

  var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  var path = currentProfile.org_id + "/" + category + "/" + crypto.randomUUID() + "-" + safeName;

  const { error: uploadError } = await window.sbClient.storage
    .from("documents")
    .upload(path, file, { upsert: false });

  if (uploadError) {
    statusEl.textContent = "Upload failed: " + uploadError.message;
    input.value = "";
    return;
  }

  const { error: insertError } = await window.sbClient.from("documents").insert({
    org_id: currentProfile.org_id,
    category: category,
    file_name: file.name,
    storage_path: path,
    file_size: file.size,
    mime_type: file.type,
    uploaded_by: currentSession.user.id,
  });

  if (insertError) {
    statusEl.textContent = "Saved the file, but couldn't record it: " + insertError.message;
    input.value = "";
    return;
  }

  await window.sbClient.from("audit_log").insert({
    org_id: currentProfile.org_id,
    user_id: currentSession.user.id,
    action: "upload",
    detail: file.name,
  });

  statusEl.textContent = "Uploaded.";
  input.value = "";
  await loadDocumentsForCategory(category);
  await loadAuditLog();
}

async function loadAllDocuments() {
  for (var i = 0; i < window.DOCUMENT_CATEGORIES.length; i++) {
    await loadDocumentsForCategory(window.DOCUMENT_CATEGORIES[i].key);
  }
}

async function loadDocumentsForCategory(category) {
  var card = document.querySelector('.doc-card[data-category="' + category + '"]');
  if (!card) return;
  var list = card.querySelector(".portal-file-list");

  const { data: docs } = await window.sbClient
    .from("documents")
    .select("id, file_name, file_size, created_at, storage_path")
    .eq("org_id", currentProfile.org_id)
    .eq("category", category)
    .order("created_at", { ascending: false });

  renderFileList(list, docs || [], category);
}

function renderFileList(list, docs, category) {
  list.innerHTML = "";

  if (docs.length === 0) {
    var empty = document.createElement("li");
    empty.className = "portal-file-empty";
    empty.textContent = "No files uploaded yet.";
    list.appendChild(empty);
    return;
  }

  docs.forEach(function (doc) {
    var li = document.createElement("li");
    li.className = "portal-file-item";

    var meta = document.createElement("div");
    meta.className = "portal-file-meta";

    var nameSpan = document.createElement("span");
    nameSpan.className = "portal-file-name";
    nameSpan.textContent = doc.file_name;

    var subSpan = document.createElement("span");
    subSpan.className = "portal-file-sub";
    subSpan.textContent = window.sbFormatBytes(doc.file_size) + " · " + window.sbFormatDate(doc.created_at);

    meta.appendChild(nameSpan);
    meta.appendChild(subSpan);

    var actions = document.createElement("div");
    actions.className = "portal-file-actions";

    var downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "btn btn-outline";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", function () {
      downloadDocument(doc.storage_path, doc.file_name);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-outline";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteDocument(doc.id, doc.storage_path, category);
    });

    actions.appendChild(downloadBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(meta);
    li.appendChild(actions);
    list.appendChild(li);
  });
}

async function downloadDocument(path, fileName) {
  const { data, error } = await window.sbClient.storage
    .from("documents")
    .createSignedUrl(path, 60);

  if (error || !data) {
    alert("Couldn't generate a download link. Please try again.");
    return;
  }

  await window.sbClient.from("audit_log").insert({
    org_id: currentProfile.org_id,
    user_id: currentSession.user.id,
    action: "download",
    detail: fileName,
  });

  window.open(data.signedUrl, "_blank", "noopener");
  loadAuditLog();
}

async function deleteDocument(docId, path, category) {
  if (!confirm("Delete this file? This can't be undone.")) return;

  const { error: storageError } = await window.sbClient.storage.from("documents").remove([path]);
  if (storageError) {
    alert("Couldn't delete the file: " + storageError.message);
    return;
  }

  const { error: dbError } = await window.sbClient.from("documents").delete().eq("id", docId);
  if (dbError) {
    alert("The file was removed from storage, but its record couldn't be cleared: " + dbError.message);
  }

  await window.sbClient.from("audit_log").insert({
    org_id: currentProfile.org_id,
    user_id: currentSession.user.id,
    action: "delete",
  });

  await loadDocumentsForCategory(category);
  await loadAuditLog();
}

var AUDIT_LABELS = {
  upload: "Uploaded",
  download: "Downloaded",
  delete: "Deleted",
  signup: "Account created",
  login: "Signed in",
};

async function loadAuditLog() {
  var list = document.querySelector("#audit-log-list");
  if (!list) return;

  const { data: entries } = await window.sbClient
    .from("audit_log")
    .select("action, detail, created_at")
    .eq("org_id", currentProfile.org_id)
    .order("created_at", { ascending: false })
    .limit(15);

  list.innerHTML = "";

  if (!entries || entries.length === 0) {
    var empty = document.createElement("li");
    empty.className = "portal-file-empty";
    empty.textContent = "No activity yet.";
    list.appendChild(empty);
    return;
  }

  entries.forEach(function (entry) {
    var li = document.createElement("li");
    li.className = "audit-item";

    var actionSpan = document.createElement("span");
    actionSpan.className = "audit-action";
    actionSpan.textContent = AUDIT_LABELS[entry.action] || entry.action;
    li.appendChild(actionSpan);

    if (entry.detail) {
      var detailSpan = document.createElement("span");
      detailSpan.className = "audit-detail";
      detailSpan.textContent = entry.detail;
      li.appendChild(detailSpan);
    }

    var timeSpan = document.createElement("span");
    timeSpan.className = "audit-time";
    timeSpan.textContent = window.sbFormatDate(entry.created_at);
    li.appendChild(timeSpan);

    list.appendChild(li);
  });
}
