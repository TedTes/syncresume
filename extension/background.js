const SYNCRESUME_API_URL = "https://api.syncresume.io";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "syncresume:getApplySession") {
    void getApplySession(message.token)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Request failed." }));
    return true;
  }

  if (message.type === "syncresume:getApplyResumePdf") {
    void getApplyResumePdf(message.token)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Request failed." }));
    return true;
  }

  return false;
});

async function getApplySession(token) {
  const response = await fetch(`${SYNCRESUME_API_URL}/api/apply-sessions/${encodeURIComponent(String(token || ""))}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `SyncResume apply session failed (${response.status}).`);
  }
  return payload.session;
}

async function getApplyResumePdf(token) {
  const response = await fetch(`${SYNCRESUME_API_URL}/api/apply-sessions/${encodeURIComponent(String(token || ""))}/resume.pdf`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Could not fetch resume PDF (${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  return {
    bytes: Array.from(new Uint8Array(buffer)),
    type: response.headers.get("Content-Type") || "application/pdf",
  };
}
