const PROD_WORKSPACE_URL = "https://app.syncresume.io/workspace/optimize";
const PROD_API_URL = "https://api.syncresume.io";
const MAX_DESCRIPTION_CHARS = 45000;
const MIN_DESCRIPTION_CHARS = 120;

const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const titleEl = document.getElementById("job-title");
const sizeEl = document.getElementById("job-size");
const tokenInput = document.getElementById("token-input");
const saveTokenButton = document.getElementById("save-token-button");
const clearTokenButton = document.getElementById("clear-token-button");
const reviewWrap = document.getElementById("review-wrap");
const descriptionInput = document.getElementById("job-description");
const captureButton = document.getElementById("capture-button");
const sendButton = document.getElementById("send-button");
const copyButton = document.getElementById("copy-button");

let lastCapture = null;

initPopup();

captureButton.addEventListener("click", () => {
  void captureCurrentTab();
});

sendButton.addEventListener("click", () => {
  void captureAndSend();
});

copyButton.addEventListener("click", () => {
  void captureAndCopy();
});

saveTokenButton.addEventListener("click", () => {
  void saveToken();
});

clearTokenButton.addEventListener("click", () => {
  void clearToken();
});

descriptionInput.addEventListener("input", () => {
  if (!lastCapture) return;
  lastCapture = {
    ...lastCapture,
    description: cleanDescription(descriptionInput.value),
  };
  renderCapture(lastCapture);
});

async function initPopup() {
  const { syncResumeExtensionToken } = await chrome.storage.local.get("syncResumeExtensionToken");
  if (typeof syncResumeExtensionToken === "string" && syncResumeExtensionToken.trim()) {
    tokenInput.value = syncResumeExtensionToken.trim();
    setStatus("Connected. Capture a job post, review it, then send it to SyncResume.", "success");
  }
}

async function captureAndSend() {
  const capture = lastCapture ?? (await captureCurrentTab());
  if (!capture) return;

  const reviewedCapture = {
    ...capture,
    description: cleanDescription(descriptionInput.value || capture.description),
  };

  if (reviewedCapture.description.length < MIN_DESCRIPTION_CHARS) {
    setStatus("Add more job description text before sending.", "error");
    return;
  }

  await chrome.storage.local.set({
    lastSyncResumeJobCapture: {
      ...reviewedCapture,
      capturedAt: new Date().toISOString(),
    },
  });

  const token = await getExtensionToken();
  if (!token) {
    await copyCaptureToClipboard(reviewedCapture);
    await openWorkspace({ source: "extension" });
    setStatus("No extension token found. Copied the job text and opened SyncResume.", "success");
    return;
  }

  setBusy(true);
  setStatus("Sending the captured job to SyncResume...", "");

  try {
    const response = await createJobCapture(reviewedCapture, token);
    await openWorkspace({ captureId: response.capture.id });
    setStatus(
      response.duplicate
        ? "This job was already captured. Opening the existing copy."
        : "Captured job sent to SyncResume.",
      "success",
    );
  } catch (error) {
    await copyCaptureToClipboard(reviewedCapture);
    await openWorkspace({ source: "extension" });
    setStatus(
      `${error instanceof Error ? error.message : "Could not send to SyncResume."} Copied text as a fallback.`,
      "error",
    );
  } finally {
    setBusy(false);
  }
}

async function captureAndCopy() {
  const capture = lastCapture ?? (await captureCurrentTab());
  if (!capture) return;

  await copyCaptureToClipboard({
    ...capture,
    description: cleanDescription(descriptionInput.value || capture.description),
  });
  setStatus("Copied the job description to your clipboard.", "success");
}

async function captureCurrentTab() {
  setBusy(true);
  setStatus("Reading the current page...", "");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobFromPage,
      args: [MAX_DESCRIPTION_CHARS],
    });

    const capture = normalizeCapture(result);
    if (capture.description.length < MIN_DESCRIPTION_CHARS) {
      throw new Error("Could not find enough job description text on this page.");
    }

    descriptionInput.value = capture.description;
    lastCapture = capture;
    renderCapture(capture);
    reviewWrap.hidden = false;
    setStatus("Job description captured. Review it in SyncResume before optimizing.", "success");
    return capture;
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not capture this page.", "error");
    return null;
  } finally {
    setBusy(false);
  }
}

function normalizeCapture(value) {
  const capture = value && typeof value === "object" ? value : {};
  return {
    title: cleanLine(capture.title) || "Job description",
    company: cleanLine(capture.company),
    location: cleanLine(capture.location),
    sourceUrl: cleanLine(capture.sourceUrl),
    description: cleanDescription(capture.description || ""),
  };
}

async function copyCaptureToClipboard(capture) {
  const header = [
    capture.title,
    capture.company ? `Company: ${capture.company}` : "",
    capture.location ? `Location: ${capture.location}` : "",
    capture.sourceUrl ? `Source: ${capture.sourceUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const text = `${header}\n\n${capture.description}`.trim();
  await navigator.clipboard.writeText(text);
}

async function getWorkspaceUrl() {
  const { syncResumeWorkspaceUrl } = await chrome.storage.local.get("syncResumeWorkspaceUrl");
  return typeof syncResumeWorkspaceUrl === "string" && syncResumeWorkspaceUrl.trim()
    ? syncResumeWorkspaceUrl.trim()
    : PROD_WORKSPACE_URL;
}

async function getApiUrl() {
  const { syncResumeApiUrl } = await chrome.storage.local.get("syncResumeApiUrl");
  return typeof syncResumeApiUrl === "string" && syncResumeApiUrl.trim()
    ? syncResumeApiUrl.trim().replace(/\/$/, "")
    : PROD_API_URL;
}

async function getExtensionToken() {
  const { syncResumeExtensionToken } = await chrome.storage.local.get("syncResumeExtensionToken");
  return typeof syncResumeExtensionToken === "string" ? syncResumeExtensionToken.trim() : "";
}

async function createJobCapture(capture, token) {
  const response = await fetch(`${await getApiUrl()}/api/job-captures`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(capture),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `SyncResume API failed (${response.status}).`);
  }

  return payload;
}

async function openWorkspace(params) {
  const workspaceUrl = new URL(await getWorkspaceUrl());
  for (const [key, value] of Object.entries(params)) {
    if (value) workspaceUrl.searchParams.set(key, value);
  }
  await chrome.tabs.create({ url: workspaceUrl.toString() });
}

async function saveToken() {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus("Paste a token from SyncResume settings first.", "error");
    return;
  }

  await chrome.storage.local.set({ syncResumeExtensionToken: token });
  setStatus("Extension token saved.", "success");
}

async function clearToken() {
  tokenInput.value = "";
  await chrome.storage.local.remove("syncResumeExtensionToken");
  setStatus("Extension token removed. The extension will use clipboard fallback.", "");
}

function renderCapture(capture) {
  titleEl.textContent = capture.title;
  sizeEl.textContent = `${(descriptionInput.value || capture.description).length.toLocaleString()} chars`;
  resultEl.hidden = false;
}

function setBusy(isBusy) {
  captureButton.disabled = isBusy;
  sendButton.disabled = isBusy;
  copyButton.disabled = isBusy;
  sendButton.textContent = isBusy ? "Working..." : "Send to SyncResume";
  captureButton.textContent = isBusy ? "Capturing..." : "Capture current page";
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.classList.toggle("is-error", kind === "error");
  statusEl.classList.toggle("is-success", kind === "success");
}

function cleanLine(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(value) {
  const seen = new Set();
  return String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      if (line.length < 2) return false;
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, MAX_DESCRIPTION_CHARS)
    .trim();
}

// Runs inside the active tab through chrome.scripting.executeScript.
function extractJobFromPage(maxChars) {
  const isLinkedIn = /(^|\.)linkedin\.com$/i.test(window.location.hostname);
  const root = isLinkedIn ? findLinkedInJobRoot() : document;
  const selectorGroups = {
    description: [
      "[data-testid='job-description']",
      ".jobs-description__container",
      ".jobs-description__content",
      ".jobs-description",
      ".jobs-box__html-content",
      "#job-details",
      ".description__text",
      ".posting-description",
      ".job-description",
      "[data-automation-id='jobPostingDescription']",
      "[data-ph-at-id='jobdescription-text']",
      ".jobsearch-jobDescriptionText",
    ],
    title: [
      "[data-testid='job-title']",
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".jobs-details__main-content h1",
      ".top-card-layout__title",
      ".posting-headline h2",
      "[data-automation-id='jobPostingHeader'] h1",
      "h1",
    ],
    company: [
      "[data-testid='company-name']",
      ".job-details-jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".jobs-unified-top-card__company-name",
      ".posting-company",
      "[data-automation-id='jobPostingCompany']",
    ],
    location: [
      "[data-testid='job-location']",
      ".job-details-jobs-unified-top-card__bullet",
      ".topcard__flavor--bullet",
      ".jobs-unified-top-card__bullet",
      ".posting-categories",
      "[data-automation-id='locations']",
    ],
  };

  const descriptionNode = firstUsefulNode(selectorGroups.description, root);
  const description = normalizePageText(
    descriptionNode?.innerText ||
      (isLinkedIn ? extractLinkedInDescriptionFromText(root) : "") ||
      cleanDocumentCloneText(root) ||
      "",
    maxChars,
  );
  const title = cleanJobTitleText(
    (isLinkedIn ? extractLinkedInTitleFromDetail(root) : "") ||
      firstText(selectorGroups.title, root) ||
      (isLinkedIn ? activeLinkedInCardTitle() : "") ||
      (isLinkedIn ? "" : document.title) ||
      "",
  );

  return {
    title,
    company: firstText(selectorGroups.company, root),
    location: cleanLocationText(firstText(selectorGroups.location, root)),
    sourceUrl: window.location.href,
    description,
  };

  function findLinkedInJobRoot() {
    const candidates = [
      ".jobs-search__job-details--wrapper",
      ".jobs-search__job-details",
      ".scaffold-layout__detail",
      ".jobs-details",
      ".jobs-details__main-content",
      ".job-details-module",
      "main",
    ];

    for (const selector of candidates) {
      const nodes = [...document.querySelectorAll(selector)];
      const match = nodes
        .map((node) => ({ node, text: normalizePageText(node.innerText || "", maxChars) }))
        .filter((item) => {
          const lower = item.text.toLowerCase();
          return item.text.length > 500 && (
            lower.includes("about the job") ||
            lower.includes("about us") ||
            lower.includes("responsibilities") ||
            lower.includes("qualifications") ||
            lower.includes("requirements")
          );
        })
        .sort((a, b) => b.text.length - a.text.length)[0];
      if (match) return match.node;
    }

    return document;
  }

  function firstUsefulNode(selectors, searchRoot) {
    for (const selector of selectors) {
      const nodes = [...searchRoot.querySelectorAll(selector)];
      const match = nodes
        .map((node) => ({ node, text: normalizePageText(node.innerText || "", maxChars) }))
        .filter((item) => item.text.length > 120)
        .sort((a, b) => b.text.length - a.text.length)[0];
      if (match) return match.node;
    }
    return null;
  }

  function firstText(selectors, searchRoot) {
    for (const selector of selectors) {
      const node = searchRoot.querySelector(selector);
      const text = node?.textContent?.replace(/\s+/g, " ").trim();
      if (text && !isNoisyTitleText(text)) return text;
    }
    return "";
  }

  function activeLinkedInCardTitle() {
    const selectors = [
      "[aria-current='page'] .job-card-list__title",
      "[aria-current='true'] .job-card-list__title",
      ".jobs-search-results__list-item--active .job-card-list__title",
      ".job-card-container--clickable[aria-selected='true'] .job-card-list__title",
    ];

    for (const selector of selectors) {
      const text = document.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim();
      if (text && !isNoisyTitleText(text)) return text;
    }

    return "";
  }

  function extractLinkedInTitleFromDetail(searchRoot) {
    const headingSelectors = [
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".jobs-details__main-content h1",
      "h1",
      "h2",
    ];

    for (const selector of headingSelectors) {
      for (const node of [...searchRoot.querySelectorAll(selector)]) {
        const text = node.textContent?.replace(/\s+/g, " ").trim();
        if (text && !isNoisyTitleText(text) && !isLinkedInSectionHeading(text)) return text;
      }
    }

    return "";
  }

  function extractLinkedInDescriptionFromText(searchRoot) {
    const text = cleanDocumentCloneText(searchRoot);
    if (!text) return "";

    const lines = text
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const startIndex = lines.findIndex((line) => /^about the job$/i.test(line));
    const usefulLines = startIndex >= 0 ? lines.slice(startIndex + 1) : lines;
    const stopIndex = usefulLines.findIndex((line) =>
      /^(show less|show more|seniority level|employment type|job function|industries|referrals increase|similar jobs|people also viewed)$/i.test(
        line,
      ),
    );

    return (stopIndex >= 0 ? usefulLines.slice(0, stopIndex) : usefulLines).join("\n");
  }

  function cleanDocumentCloneText(searchRoot) {
    const source = searchRoot === document ? document.body : searchRoot;
    if (!source) return "";

    const clone = source.cloneNode(true);
    clone
      .querySelectorAll([
        "nav",
        "aside",
        "header",
        "footer",
        "script",
        "style",
        "[role='navigation']",
        "[aria-label*='Messaging' i]",
        ".msg-overlay-list-bubble",
        ".jobs-search-results-list",
        ".jobs-search-results",
      ].join(","))
      .forEach((node) => node.remove());

    return clone.innerText || "";
  }

  function cleanJobTitleText(value) {
    const cleaned = String(value || "")
      .replace(/\s+\|\s+LinkedIn.*$/i, "")
      .replace(/^Top job picks for you\s*\|\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    return isNoisyTitleText(cleaned) ? "" : cleaned;
  }

  function cleanLocationText(value) {
    return String(value || "")
      .replace(/\s*·.*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isNoisyTitleText(value) {
    return /^(top job picks|jobs|search|linkedin|home|messaging|notifications)\b/i.test(String(value || "").trim());
  }

  function isLinkedInSectionHeading(value) {
    return /^(about the job|about us|how your profile and resume fit this job|show match details|meet the hiring team)$/i.test(
      String(value || "").trim(),
    );
  }

  function normalizePageText(value, limit) {
    return String(value || "")
      .replace(/\r/g, "\n")
      .replace(/\t/g, " ")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => Boolean(line) && !isNoisyDescriptionLine(line))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, limit)
      .trim();
  }

  function isNoisyDescriptionLine(line) {
    return /^(top job picks for you|based on your profile|viewed|promoted|easy apply|actively reviewing applicants|show match details|messaging|apply|save|remote|full-time)$/i.test(
      line,
    );
  }
}
