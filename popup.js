
const websiteInput = document.getElementById("websiteInput");
const pageInput = document.getElementById("pageInput");
const blockedList = document.getElementById("blockedList");
const message = document.getElementById("message");

// Convert user input into a consistent domain and path.
function normalizeUrl(input, type) {
  const value = input.trim();

  if (!value) {
    throw new Error("Please enter a website.");
  }

  // Add HTTPS when the user provides no protocol.
  const fullUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
    ? value
    : "https://" + value;

  const url = new URL(fullUrl);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)
  ) {
    throw new Error("Please enter a valid website URL.");
  }

  // Treat www.example.com as example.com.
  const domain = url.hostname.replace(/^www\./i, "");

  if (type === "website") {
    return { domain, path: "" };
  }

  // Require a page path for page-specific blocking.
  const path = url.pathname.replace(/\/+$/, "");

  if (!path || path === "/") {
    throw new Error("Enter a page path, such as /about.");
  }

  return { domain, path };
}

// Escape special characters before building a regex.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build a Chrome network-blocking rule.
function createChromeRule(item) {
  const condition = {
    requestDomains: [item.domain],
    resourceTypes: ["main_frame"]
  };

  if (item.type === "page") {
    condition.regexFilter =
      "^https?://[^/]+" +
      escapeRegex(item.path) +
      "(?:[/?#]|$)";

    condition.isUrlFilterCaseSensitive = true;
  }

  return {
    id: item.id,
    priority: 1,
    action: { type: "block" },
    condition
  };
}

// Save a website or page selected by the user.
async function addBlockedItem(type) {
  const input = type === "website"
    ? websiteInput
    : pageInput;

  try {
    const { domain, path } = normalizeUrl(input.value, type);

    const data = await chrome.storage.local.get({
      blockedItems: []
    });

    const items = data.blockedItems;

    const exists = items.some(item =>
      item.type === type &&
      item.domain === domain &&
      item.path === path
    );

    if (exists) {
      throw new Error("This item is already blocked.");
    }

    // Rule IDs must be unique positive integers.
    const currentRules =
      await chrome.declarativeNetRequest.getDynamicRules();

    const nextId = Math.max(
      0,
      ...currentRules.map(rule => rule.id),
      ...items.map(item => item.id)
    ) + 1;

    const newItem = {
      id: nextId,
      type,
      domain,
      path
    };

    // First update Chrome's network-blocking rules.
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [createChromeRule(newItem)],
      removeRuleIds: []
    });

    // Then save the list for the popup and content script.
    items.push(newItem);

    await chrome.storage.local.set({
      blockedItems: items
    });

    input.value = "";
    message.textContent = "";

    await displayBlockedItems();

  } catch (error) {
    message.textContent = error.message;
  }
}

// Remove an item selected by the user.
async function removeBlockedItem(id) {
  try {
    const data = await chrome.storage.local.get({
      blockedItems: []
    });

    const items = data.blockedItems.filter(
      item => item.id !== id
    );

    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [],
      removeRuleIds: [id]
    });

    await chrome.storage.local.set({
      blockedItems: items
    });

    message.textContent = "";
    await displayBlockedItems();

  } catch (error) {
    message.textContent = error.message;
  }
}

// Display all saved blocking rules.
async function displayBlockedItems() {
  const data = await chrome.storage.local.get({
    blockedItems: []
  });

  blockedList.replaceChildren();

  for (const item of data.blockedItems) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = item.type === "website"
      ? `${item.domain} (Website)`
      : `${item.domain}${item.path} (Page)`;

    const button = document.createElement("button");
    button.textContent = "Remove";
    button.className = "remove-button";

    button.addEventListener("click", () => {
      removeBlockedItem(item.id);
    });

    li.append(label, button);
    blockedList.appendChild(li);
  }
}

document.getElementById("blockWebsiteBtn")
  .addEventListener("click", () => addBlockedItem("website"));

document.getElementById("blockPageBtn")
  .addEventListener("click", () => addBlockedItem("page"));

displayBlockedItems().catch(error => {
  message.textContent = error.message;
});
