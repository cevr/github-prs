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

// Fetch timeline data for a PR to check approval status and last updater
async function fetchPRTimeline(token, repoOwner, repoName, prNumber) {
  const timelineUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/pulls/${prNumber}/timeline`;

  try {
    const response = await fetch(timelineUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      return { isApproved: false, lastUpdatedBy: null };
    }

    const timeline = await response.json();
    let isApproved = false;
    let lastUpdatedBy = null;

    // Check for the most recent review approval and get last updater
    for (let i = timeline.length - 1; i >= 0; i--) {
      const event = timeline[i];

      // Track the most recent event that would cause an update
      if (!lastUpdatedBy && event.actor &&
          (event.event === 'reviewed' || event.event === 'committed' ||
           event.event === 'commented' || event.event === 'synchronized')) {
        lastUpdatedBy = event.actor.login;
      }

      // Check for approval
      if (event.event === 'reviewed' && event.state === 'approved') {
        isApproved = true;
        break;
      }

      // If we find a newer review that's not approved, it's not approved
      if (event.event === 'reviewed' && event.state !== 'approved') {
        break;
      }
    }

    return { isApproved, lastUpdatedBy };
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return { isApproved: false, lastUpdatedBy: null };
  }
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
      fetchPRsWithTimeline(
        token,
        username,
        `https://api.github.com/search/issues?q=is:pr+author:${username}+is:open`
      ),
      Promise.all([
        fetchPRs(
          token,
          `https://api.github.com/search/issues?q=is:pr+is:open+assignee:${username}`
        ),
        fetchPRs(
          token,
          `https://api.github.com/search/issues?q=is:pr+is:open+review-requested:${username}`
        ),
      ]).then(([assignedPRs, reviewRequestedPRs]) => {
        // Use a Set to track unique PR IDs
        const uniquePRs = new Map();

        // Add assigned PRs first
        assignedPRs.forEach((pr) => {
          uniquePRs.set(pr.id.toString(), pr);
        });

        // Add review requested PRs, skipping duplicates
        reviewRequestedPRs.forEach((pr) => {
          if (!uniquePRs.has(pr.id.toString())) {
            uniquePRs.set(pr.id.toString(), pr);
          }
        });

        // Convert Map values back to array
        return Array.from(uniquePRs.values());
      }),
    ]).catch(async (error) => {
      // If we get a 401, the token is expired
      if (error.message.includes("401")) {
        // Clear the token and username
        await chrome.storage.sync.remove(["token", "username"]);
        // Clear the PR data
        await chrome.storage.local.remove(["previousPRs", "seenPRs"]);
        // Notify the popup to show setup needed
        await chrome.runtime.sendMessage({ action: "setupNeeded" });
      }
      throw error;
    });

    const newPRs = {
      created: createdPRs,
      assigned: assignedPRs,
    };

    // Check for updates and update seen PRs (but ignore self-updates)
    let hasUpdates = false;
    // Use a Map to track unique PRs across all categories
    const uniquePRs = new Map();

    // Add created PRs first
    createdPRs.forEach((pr) => {
      uniquePRs.set(pr.id.toString(), pr);
    });

    // Add assigned/review-requested PRs, skipping duplicates
    assignedPRs.forEach((pr) => {
      if (!uniquePRs.has(pr.id.toString())) {
        uniquePRs.set(pr.id.toString(), pr);
      }
    });

    const allPRs = Array.from(uniquePRs.values());
    const updatedSeenPRs = { ...seenPRs };

    // Remove PRs that are no longer in the response
    Object.keys(updatedSeenPRs).forEach((prId) => {
      if (!allPRs.find((pr) => pr.id.toString() === prId)) {
        delete updatedSeenPRs[prId];
      }
    });

    // Check for new or updated PRs (but ignore updates caused by the user themselves)
    for (const pr of allPRs) {
      const prId = pr.id.toString();
      const lastSeen = updatedSeenPRs[prId];

      if (!lastSeen || new Date(pr.updated_at) > new Date(lastSeen)) {
        // Only consider it an update if it wasn't caused by the user themselves
        if (!pr.lastUpdatedBy || pr.lastUpdatedBy !== username) {
          hasUpdates = true;
        }
      }
    }

    // Update badge
    const totalPRs = allPRs.length;
    if (totalPRs > 0) {
      chrome.action.setBadgeText({ text: totalPRs.toString() });
      chrome.action.setBadgeTextColor({ color: "#fff" });
      chrome.action.setBadgeBackgroundColor({
        color: hasUpdates ? "#f85149" : "#666",
      });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }

    // Store new PRs and seen state
    await chrome.storage.local.set({
      previousPRs: newPRs,
      seenPRs: updatedSeenPRs,
    });
    await chrome.runtime.sendMessage({ action: "prsUpdated" });
  } catch (error) {
    console.error("Error checking for updates:", error);
  }
}

// Fetch PRs with timeline data for created PRs
async function fetchPRsWithTimeline(token, username, url) {
  const prs = await fetchPRs(token, url);

  // For created PRs, fetch timeline data to check approval status
  const prsWithTimeline = await Promise.all(
    prs.map(async (pr) => {
      const repoUrl = pr.repository_url;
      const repoParts = repoUrl.split('/');
      const repoOwner = repoParts[repoParts.length - 2];
      const repoName = repoParts[repoParts.length - 1];

      const { isApproved, lastUpdatedBy } = await fetchPRTimeline(
        token,
        repoOwner,
        repoName,
        pr.number
      );

      return {
        ...pr,
        isApproved,
        lastUpdatedBy
      };
    })
  );

  return prsWithTimeline;
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
