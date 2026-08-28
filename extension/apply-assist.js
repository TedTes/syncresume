const APPLY_TOKEN_PARAM = "syncresumeApplyToken";
const STORAGE_KEY = "syncResumePendingApplySession";

void initSyncResumeApplyAssist();

async function initSyncResumeApplyAssist() {
  const token = consumeApplyTokenFromUrl();
  if (token) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        token,
        createdAt: new Date().toISOString(),
        sourceUrl: window.location.href,
      },
    });
  }

  const { [STORAGE_KEY]: pendingSession } = await chrome.storage.local.get(STORAGE_KEY);
  if (!pendingSession?.token) return;

  const session = await fetchApplySession(pendingSession.token).catch(() => null);
  if (!session) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return;
  }

  if (!sameJobPage(session.jobUrl, window.location.href)) return;
  renderApplyAssistPanel({ token: pendingSession.token, session });
}

function consumeApplyTokenFromUrl() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(APPLY_TOKEN_PARAM)?.trim();
  if (!token) return "";

  url.searchParams.delete(APPLY_TOKEN_PARAM);
  window.history.replaceState(window.history.state, document.title, url.toString());
  return token;
}

async function fetchApplySession(token) {
  return sendExtensionMessage("syncresume:getApplySession", { token });
}

async function fetchApplyResumePdf(token, fileName) {
  const payload = await sendExtensionMessage("syncresume:getApplyResumePdf", { token });
  const blob = new Blob([new Uint8Array(payload.bytes)], {
    type: payload.type || "application/pdf",
  });
  return new File([blob], fileName || "syncresume-resume.pdf", { type: "application/pdf" });
}

function sendExtensionMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "SyncResume extension request failed."));
        return;
      }
      resolve(response.payload);
    });
  });
}

function renderApplyAssistPanel({ token, session }) {
  if (document.getElementById("syncresume-apply-assist")) return;

  const panel = document.createElement("aside");
  panel.id = "syncresume-apply-assist";
  panel.innerHTML = `
    <style>
      #syncresume-apply-assist {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483647;
        width: min(360px, calc(100vw - 36px));
        border: 1px solid rgba(34, 197, 94, 0.34);
        border-radius: 14px;
        background: #111315;
        color: #f8fafc;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.46);
        font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #syncresume-apply-assist * { box-sizing: border-box; }
      #syncresume-apply-assist header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 14px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      #syncresume-apply-assist strong {
        display: block;
        font-size: 14px;
      }
      #syncresume-apply-assist .syncresume-muted {
        color: #9ca3af;
      }
      #syncresume-apply-assist button {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: #181a1d;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      #syncresume-apply-assist .syncresume-close {
        width: 32px;
        height: 32px;
      }
      #syncresume-apply-assist .syncresume-body {
        padding: 14px;
        display: grid;
        gap: 12px;
      }
      #syncresume-apply-assist .syncresume-file {
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(34, 197, 94, 0.1);
        color: #bbf7d0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #syncresume-apply-assist .syncresume-primary {
        width: 100%;
        padding: 11px 13px;
        border-color: rgba(34, 197, 94, 0.5);
        background: #22c55e;
        color: #06130b;
        font-weight: 800;
      }
      #syncresume-apply-assist .syncresume-secondary {
        width: 100%;
        padding: 10px 13px;
      }
      #syncresume-apply-assist .syncresume-status {
        min-height: 18px;
        color: #9ca3af;
      }
      #syncresume-apply-assist .syncresume-status.is-error {
        color: #fca5a5;
      }
      #syncresume-apply-assist .syncresume-status.is-success {
        color: #86efac;
      }
    </style>
    <header>
      <div>
        <strong>SyncResume apply assist</strong>
        <span class="syncresume-muted">Attach your tailored resume to this application.</span>
      </div>
      <button class="syncresume-close" type="button" aria-label="Close">×</button>
    </header>
    <div class="syncresume-body">
      <div class="syncresume-file" title="${escapeHtml(session.fileName || "")}">${escapeHtml(session.fileName || "Tailored resume.pdf")}</div>
      <button class="syncresume-primary" type="button">Attach resume PDF</button>
      <button class="syncresume-secondary" type="button">Download fallback</button>
      <div class="syncresume-status" role="status"></div>
    </div>
  `;

  const closeButton = panel.querySelector(".syncresume-close");
  const attachButton = panel.querySelector(".syncresume-primary");
  const downloadButton = panel.querySelector(".syncresume-secondary");
  const statusEl = panel.querySelector(".syncresume-status");

  closeButton.addEventListener("click", async () => {
    await chrome.storage.local.remove(STORAGE_KEY);
    panel.remove();
  });

  attachButton.addEventListener("click", async () => {
    setPanelStatus(statusEl, "Preparing resume PDF...", "");
    attachButton.disabled = true;
    try {
      const file = await fetchApplyResumePdf(token, session.fileName);
      const input = findBestResumeFileInput();
      if (!input) {
        throw new Error("Could not find a resume upload field on this page.");
      }
      attachFileToInput(input, file);
      setPanelStatus(statusEl, "Resume attached. Review the application before submitting.", "success");
    } catch (error) {
      setPanelStatus(statusEl, error instanceof Error ? error.message : "Could not attach the resume.", "error");
    } finally {
      attachButton.disabled = false;
    }
  });

  downloadButton.addEventListener("click", async () => {
    setPanelStatus(statusEl, "Downloading fallback copy...", "");
    try {
      const file = await fetchApplyResumePdf(token, session.fileName);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setPanelStatus(statusEl, "Downloaded fallback copy.", "success");
    } catch (error) {
      setPanelStatus(statusEl, error instanceof Error ? error.message : "Could not download the resume.", "error");
    }
  });

  document.documentElement.appendChild(panel);
}

function findBestResumeFileInput() {
  const inputs = [...document.querySelectorAll("input[type='file']")];
  return inputs
    .map((input) => ({ input, score: scoreFileInput(input) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.input ?? null;
}

function scoreFileInput(input) {
  const context = [
    input.id,
    input.name,
    input.accept,
    input.getAttribute("aria-label"),
    input.getAttribute("data-testid"),
    findAssociatedLabelText(input),
    input.closest("label")?.innerText,
    input.parentElement?.innerText,
    input.closest("section, div, form")?.innerText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (/\b(resume|résumé|cv|curriculum vitae)\b/.test(context)) score += 10;
  if (/\b(upload|attach|file|document)\b/.test(context)) score += 3;
  if (/\b(pdf|doc|docx)\b/.test(context)) score += 2;
  if (/\b(cover|photo|image|portfolio|transcript|certificate)\b/.test(context)) score -= 8;
  if (input.disabled) score -= 10;
  return score;
}

function findAssociatedLabelText(input) {
  if (!input.id) return "";
  return [...document.querySelectorAll(`label[for="${CSS.escape(input.id)}"]`)]
    .map((label) => label.innerText)
    .join(" ");
}

function attachFileToInput(input, file) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.focus?.();
}

function sameJobPage(expectedUrl, currentUrl) {
  try {
    const expected = new URL(expectedUrl);
    const current = new URL(currentUrl);
    if (expected.hostname !== current.hostname) return false;
    return normalizePath(expected.pathname) === normalizePath(current.pathname);
  } catch {
    return false;
  }
}

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function setPanelStatus(statusEl, message, kind) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", kind === "error");
  statusEl.classList.toggle("is-success", kind === "success");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
