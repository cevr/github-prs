// GitHub API endpoints
const GITHUB_API_BASE = 'https://api.github.com';

// Default check interval (15 minutes)
const DEFAULT_CHECK_INTERVAL = 15;

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.sync.get(['token', 'username', 'checkInterval'], (result) => {
    if (!result.checkInterval) {
      chrome.storage.sync.set({ checkInterval: DEFAULT_CHECK_INTERVAL });
    }

    // Setup alarm for periodic checks
    setupAlarm(result.checkInterval || DEFAULT_CHECK_INTERVAL);
  });
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-prs') {
    checkForUpdates();
  }
});

// Setup the alarm for periodic checking
function setupAlarm(interval) {
  chrome.alarms.clear('check-prs', () => {
    chrome.alarms.create('check-prs', {
      periodInMinutes: parseInt(interval)
    });
  });
}

// Check for PR updates
async function checkForUpdates() {
  try {
    const { token, username } = await chrome.storage.sync.get(['token', 'username']);

    if (!token || !username) {
      updateBadge('!', '#FF0000');
      return;
    }

    const [createdPRs, assignedPRs] = await Promise.all([
      fetchPRs(`author:${username} is:open is:pr`, token),
      fetchPRs(`assignee:${username} is:open is:pr -author:${username}`, token)
    ]);

    // Store the current PRs
    const currentPRs = { created: createdPRs, assigned: assignedPRs };

    // Get previous PR data to compare
    const { previousPRs } = await chrome.storage.local.get(['previousPRs']);

    // Check for updates
    const hasUpdates = checkForPRUpdates(previousPRs, currentPRs);

    // Update badge
    const totalPRs = createdPRs.length + assignedPRs.length;
    updateBadge(totalPRs.toString(), hasUpdates ? '#FF0000' : '#4CAF50');

    // Store the current PRs for future comparison
    chrome.storage.local.set({ previousPRs: currentPRs });

  } catch (error) {
    console.error('Error checking for updates:', error);
    updateBadge('!', '#FF0000');
  }
}

// Fetch PRs from GitHub API
async function fetchPRs(query, token) {
  const response = await fetch(
    `${GITHUB_API_BASE}/search/issues?q=${encodeURIComponent(query)}&sort=updated`,
    {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items.map(pr => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    html_url: pr.html_url,
    repository_url: pr.repository_url,
    updated_at: pr.updated_at,
    user: {
      login: pr.user.login,
      avatar_url: pr.user.avatar_url
    }
  }));
}

// Check if there are updates in PRs
function checkForPRUpdates(previousPRs, currentPRs) {
  if (!previousPRs) return false;

  // Helper function to check for updates in a PR list
  const checkUpdates = (oldList, newList) => {
    if (!oldList) return false;

    for (const newPR of newList) {
      const oldPR = oldList.find(pr => pr.id === newPR.id);
      if (!oldPR || new Date(newPR.updated_at) > new Date(oldPR.updated_at)) {
        return true;
      }
    }
    return false;
  };

  return checkUpdates(previousPRs.created, currentPRs.created) ||
         checkUpdates(previousPRs.assigned, currentPRs.assigned);
}

// Update the extension badge
function updateBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Listen for messages from popup or options
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkNow') {
    checkForUpdates();
    sendResponse({ status: 'checking' });
  } else if (message.action === 'updateSettings') {
    setupAlarm(message.checkInterval || DEFAULT_CHECK_INTERVAL);
    sendResponse({ status: 'updated' });
  }
  return true;
});