
(() => {
  let blockedItems = [];
  let lastCheckedUrl = "";

  function matchesBlockedItem(item, url) {
    const hostname = url.hostname.toLowerCase();
    const domainMatches =
      hostname === item.domain ||
      hostname.endsWith("." + item.domain);

    if (!domainMatches) {
      return false;
    }

    // Block the entire domain.
    if (item.type === "website") {
      return true;
    }

    // Block just the page and its child paths.
    return (
      url.pathname === item.path ||
      url.pathname.startsWith(item.path + "/")
    );
  }

  function checkCurrentPage() {
    const currentUrl = window.location.href;

    if (currentUrl === lastCheckedUrl) {
      return;
    }

    lastCheckedUrl = currentUrl;

    const url = new URL(currentUrl);

    const shouldBlock = blockedItems.some(
      item => matchesBlockedItem(item, url)
    );

    if (shouldBlock) {
      window.stop();
      window.location.replace("about:blank");
    }
  }

  // Load the user's saved blocking preferences.
  chrome.storage.local.get({ blockedItems: [] })
    .then(data => {
      blockedItems = data.blockedItems;
      checkCurrentPage();
    });

  // React when a rule is added or removed.
  chrome.storage.onChanged.addListener(
    (changes, areaName) => {
      if (
        areaName === "local" &&
        changes.blockedItems
      ) {
        blockedItems =
          changes.blockedItems.newValue || [];

        lastCheckedUrl = "";
        checkCurrentPage();
      }
    }
  );

  // Detect URL changes on single-page applications.
  setInterval(checkCurrentPage, 750);
})();
