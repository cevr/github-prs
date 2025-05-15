document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const tokenInput = document.getElementById('token');
  const usernameInput = document.getElementById('username');
  const intervalInput = document.getElementById('interval');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Load saved settings
  chrome.storage.sync.get(['token', 'username', 'checkInterval'], (result) => {
    if (result.token) {
      tokenInput.value = result.token;
    }

    if (result.username) {
      usernameInput.value = result.username;
    }

    if (result.checkInterval) {
      intervalInput.value = result.checkInterval;
    } else {
      intervalInput.value = 15; // Default value
    }
  });

  // Save settings
  saveButton.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    const username = usernameInput.value.trim();
    const interval = parseInt(intervalInput.value) || 15;

    // Validate inputs
    if (!token) {
      showStatus('Please enter your GitHub Personal Access Token.', 'error');
      return;
    }

    if (!username) {
      showStatus('Please enter your GitHub username.', 'error');
      return;
    }

    // Ensure interval is at least 5 minutes
    const checkInterval = Math.max(5, interval);

    // Save to storage
    chrome.storage.sync.set({
      token,
      username,
      checkInterval
    }, () => {
      // Show success message
      showStatus('Settings saved successfully!', 'success');

      // Update check interval in background script
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        checkInterval
      });

      // Trigger an immediate check
      chrome.runtime.sendMessage({
        action: 'checkNow'
      });
    });
  });

  // Helper to show status messages
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    // Hide status after 3 seconds
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});