document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const content = document.getElementById('content');
  const refreshButton = document.getElementById('refresh-button');
  const settingsButton = document.getElementById('settings-button');
  const tabs = document.querySelectorAll('.tab');

  // Current active tab
  let activeTab = 'created';

  // Initialize popup
  init();

  // Add event listeners
  refreshButton.addEventListener('click', () => {
    refreshData();
  });

  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      setActiveTab(tabName);
    });
  });

  // Initialize the popup
  async function init() {
    try {
      const { token, username } = await chrome.storage.sync.get(['token', 'username']);

      if (!token || !username) {
        showSetupNeeded();
        return;
      }

      // Load PRs from storage
      const { previousPRs } = await chrome.storage.local.get(['previousPRs']);

      if (!previousPRs) {
        // If no data, trigger a refresh
        refreshData();
        return;
      }

      // Display PRs
      renderPRs(previousPRs);

    } catch (error) {
      showError(error.message);
    }
  }

  // Refresh PR data
  function refreshData() {
    showLoading();

    // Send message to background script to check for updates
    chrome.runtime.sendMessage({ action: 'checkNow' }, async () => {
      try {
        const { previousPRs } = await chrome.storage.local.get(['previousPRs']);
        if (previousPRs) {
          renderPRs(previousPRs);
        } else {
          showEmptyState();
        }
      } catch (error) {
        showError(error.message);
      }
    });
  }

  // Set active tab
  function setActiveTab(tabName) {
    activeTab = tabName;

    // Update tab UI
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Re-render PRs with the active tab
    chrome.storage.local.get(['previousPRs'], ({ previousPRs }) => {
      if (previousPRs) {
        renderPRs(previousPRs);
      }
    });
  }

  // Render PRs in the popup
  function renderPRs(data) {
    const prs = data[activeTab] || [];

    if (prs.length === 0) {
      showEmptyState();
      return;
    }

    const listElement = document.createElement('ul');
    listElement.className = 'pr-list';

    prs.forEach(pr => {
      const repoName = getRepoNameFromUrl(pr.repository_url);
      const timeAgo = getTimeAgo(new Date(pr.updated_at));

      const listItem = document.createElement('li');
      listItem.className = 'pr-item';
      listItem.addEventListener('click', () => {
        chrome.tabs.create({ url: pr.html_url });
      });

      listItem.innerHTML = `
        <div class="pr-title">${pr.title}</div>
        <div class="pr-meta">
          <span class="pr-repo">${repoName} #${pr.number}</span>
          <span class="pr-updated">${timeAgo}</span>
        </div>
      `;

      listElement.appendChild(listItem);
    });

    content.innerHTML = '';
    content.appendChild(listElement);
  }

  // Show setup needed message
  function showSetupNeeded() {
    content.innerHTML = `
      <div class="setup-needed">
        <p>Please set up your GitHub token to start tracking PRs.</p>
        <button class="setup-button">Open Settings</button>
      </div>
    `;

    content.querySelector('.setup-button').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Show empty state
  function showEmptyState() {
    content.innerHTML = `
      <div class="empty-state">
        <p>No ${activeTab === 'created' ? 'created' : 'assigned'} PRs found.</p>
      </div>
    `;
  }

  // Show loading state
  function showLoading() {
    content.innerHTML = `
      <div class="loading">
        Loading...
      </div>
    `;
  }

  // Show error message
  function showError(message) {
    content.innerHTML = `
      <div class="empty-state">
        <p>Error: ${message}</p>
      </div>
    `;
  }

  // Helper: Extract repo name from repository URL
  function getRepoNameFromUrl(url) {
    const parts = url.split('/');
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
    }
    return 'Unknown Repository';
  }

  // Helper: Format time ago
  function getTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return `${interval} years ago`;
    if (interval === 1) return `1 year ago`;

    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return `${interval} months ago`;
    if (interval === 1) return `1 month ago`;

    interval = Math.floor(seconds / 86400);
    if (interval > 1) return `${interval} days ago`;
    if (interval === 1) return `1 day ago`;

    interval = Math.floor(seconds / 3600);
    if (interval > 1) return `${interval} hours ago`;
    if (interval === 1) return `1 hour ago`;

    interval = Math.floor(seconds / 60);
    if (interval > 1) return `${interval} minutes ago`;
    if (interval === 1) return `1 minute ago`;

    return 'just now';
  }
});