// GitHub API endpoints
const GITHUB_API_BASE = "https://api.github.com";

// Default check interval (15 minutes)
const DEFAULT_CHECK_INTERVAL = 15;

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.get(["token", "username", "checkInterval"], (result) => {
    if (!result.checkInterval) {
      chrome.storage.sync.set({ checkInterval: DEFAULT_CHECK_INTERVAL });
    }

    // Setup alarm for periodic checks
    setupAlarm(result.checkInterval || DEFAULT_CHECK_INTERVAL);
  });
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkPRs") {
    checkForUpdates();
  }
});

// Setup the alarm for periodic checking
function setupAlarm(interval) {
  chrome.alarms.clear("checkPRs", () => {
    chrome.alarms.create("checkPRs", {
      periodInMinutes: parseInt(interval),
    });
  });
}

// Check for PR updates
async function checkForUpdates() {
  try {
    const { token, username } = await chrome.storage.sync.get([
      "token",
      "username",
    ]);
    if (!token || !username) return;

    // Get current seen PRs
    const { seenPRs = {} } = await chrome.storage.local.get(["seenPRs"]);

    // Fetch new PRs
    const [createdPRs, assignedPRs] = await Promise.all([
      fetchPRs(
        token,
        `https://api.github.com/search/issues?q=is:pr+author:${username}+is:open`
      ),
      fetchPRs(
        token,
        `https://api.github.com/search/issues?q=is:pr+assignee:${username}+is:open`
      ),
    ]);

    const newPRs = {
      created: createdPRs,
      assigned: assignedPRs,
    };

    // Check for updates and update seen PRs
    let hasUpdates = false;
    const allPRs = [...newPRs.created, ...newPRs.assigned];
    const updatedSeenPRs = { ...seenPRs };

    // Remove PRs that are no longer in the response
    Object.keys(updatedSeenPRs).forEach(prId => {
      if (!allPRs.find(pr => pr.id.toString() === prId)) {
        delete updatedSeenPRs[prId];
      }
    });

    // Check for new or updated PRs
    for (const pr of allPRs) {
      const prId = pr.id.toString();
      const lastSeen = updatedSeenPRs[prId];

      if (!lastSeen || new Date(pr.updated_at) > new Date(lastSeen)) {
        hasUpdates = true;
      }
    }

    // Update badge
    const totalPRs = allPRs.length;
    if (totalPRs > 0) {
      chrome.action.setBadgeText({ text: totalPRs.toString() });
      chrome.action.setBadgeTextColor({ color: "#fff" });
      chrome.action.setBadgeBackgroundColor({
        color: hasUpdates ? "#f00" : "#666",
      });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }

    // Store new PRs and seen state
    await chrome.storage.local.set({
      previousPRs: newPRs,
      seenPRs: updatedSeenPRs
    });
    await chrome.runtime.sendMessage({ action: "prsUpdated" });
  } catch (error) {
    console.error("Error checking for updates:", error);
  }
}

// Fetch PRs from GitHub API
async function fetchPRs(token, url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items.map((item) => ({
    id: item.id,
    number: item.number,
    title: item.title,
    html_url: item.html_url,
    repository_url: item.repository_url,
    updated_at: item.updated_at,
    user: {
      login: item.user.login,
      avatar_url: item.user.avatar_url,
    },
  }));
}

// Listen for messages from popup or options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkNow") {
    checkForUpdates();
    sendResponse();
  } else if (request.action === "markPRViewed") {
    markPRViewed(request.prId);
    sendResponse();
  }
});

// Mark a PR as viewed
async function markPRViewed(prId) {
  const { seenPRs = {} } = await chrome.storage.local.get(["seenPRs"]);
  seenPRs[prId] = new Date().toISOString();
  await chrome.storage.local.set({ seenPRs });
  // Recheck updates to refresh badge
  checkForUpdates();
}
