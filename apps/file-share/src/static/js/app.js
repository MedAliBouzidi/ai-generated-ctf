// Tab switching
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.toggle("active", content.id === tabId);
  });
}

// Switch Difficulty
async function setDifficulty(diff) {
  try {
    const res = await fetch("/api/difficulty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty: diff }),
    });
    const data = await res.json();
    if (data.status === "success") {
      window.location.reload();
    }
  } catch (err) {
    console.error("Failed to set difficulty:", err);
  }
}

// Preview file
async function previewFile(filename) {
  const modal = document.getElementById("preview-modal");
  const modalTitle = document.getElementById("modal-file-title");
  const modalBody = document.getElementById("modal-file-content");

  modalTitle.textContent = "Preview: " + filename;
  modalBody.textContent = "Loading preview...";
  modal.style.display = "flex";

  try {
    const res = await fetch(`/api/preview?file=${encodeURIComponent(filename)}`);
    const data = await res.json();
    if (res.ok) {
      modalBody.textContent = data.content;
    } else {
      modalBody.textContent = `Error (${res.status}): ${data.detail || JSON.stringify(data)}`;
    }
  } catch (err) {
    modalBody.textContent = "Network or parsing error: " + err.message;
  }
}

function closeModal() {
  document.getElementById("preview-modal").style.display = "none";
}

// Run script
async function executeScript(filename) {
  const consoleBox = document.getElementById("execution-console");
  consoleBox.textContent = `[Runner] Executing: ${filename} ...\n`;

  try {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: filename }),
    });
    const data = await res.json();
    let text = `[Runner Status: ${res.status}]\n`;
    if (data.output) text += `--- Output ---\n${data.output}\n`;
    if (data.flag) text += `\n🚩 [FLAG DISCOVERED]: ${data.flag}\n`;
    if (data.detail) text += `\nError detail: ${data.detail}\n`;
    consoleBox.textContent = text;
  } catch (err) {
    consoleBox.textContent = `Execution failed: ${err.message}`;
  }
}

// Run plugin
async function runPlugin(pluginName) {
  const consoleBox = document.getElementById("plugin-console");
  consoleBox.textContent = `[Plugin Runner] Launching plugin: ${pluginName} ...\n`;

  try {
    const res = await fetch("/api/plugins/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plugin: pluginName }),
    });
    const data = await res.json();
    let text = `[Plugin Runner Status: ${res.status}]\n`;
    if (data.output) text += `--- Output ---\n${data.output}\n`;
    if (data.flag) text += `\n🚩 [FLAG DISCOVERED]: ${data.flag}\n`;
    if (data.detail) text += `\nError detail: ${data.detail}\n`;
    consoleBox.textContent = text;
  } catch (err) {
    consoleBox.textContent = `Plugin execution failed: ${err.message}`;
  }
}

// Standard file upload handler
document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("file-input");
      if (!fileInput.files.length) return alert("Select a file first.");

      const formData = new FormData();
      formData.append("file", fileInput.files[0]);

      const statusBox = document.getElementById("upload-status");
      statusBox.textContent = "Uploading file...";

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          statusBox.textContent = `Upload successful: ${JSON.stringify(data, null, 2)}`;
          setTimeout(() => window.location.reload(), 1200);
        } else {
          statusBox.textContent = `Upload error (${res.status}): ${data.detail || JSON.stringify(data)}`;
        }
      } catch (err) {
        statusBox.textContent = "Error: " + err.message;
      }
    });
  }

  // Media / Avatar upload handler
  const mediaForm = document.getElementById("media-form");
  if (mediaForm) {
    mediaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const mediaInput = document.getElementById("media-input");
      if (!mediaInput.files.length) return alert("Select an image first.");

      const formData = new FormData();
      formData.append("file", mediaInput.files[0]);

      const statusBox = document.getElementById("media-status");
      statusBox.textContent = "Processing image...";

      try {
        const res = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        let out = `Status: ${res.status}\n` + JSON.stringify(data, null, 2);
        if (data.flag) {
          out += `\n\n🚩 [FLAG DISCOVERED]: ${data.flag}`;
        }
        statusBox.textContent = out;
      } catch (err) {
        statusBox.textContent = "Upload failed: " + err.message;
      }
    });
  }

  // Reset sample files
  const resetBtn = document.getElementById("reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (confirm("Reset files in uploads directory back to default?")) {
        await fetch("/api/reset-files", { method: "POST" });
        window.location.reload();
      }
    });
  }
});
