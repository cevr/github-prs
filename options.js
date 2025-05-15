import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';

// Initialize htm with Preact
const html = htm.bind(h);

// Options component
function Options() {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [checkInterval, setCheckInterval] = useState(15);
  const [status, setStatus] = useState({ message: '', type: '', visible: false });

  // Load saved settings on component mount
  useEffect(() => {
    chrome.storage.sync.get(['token', 'username', 'checkInterval'], (result) => {
      if (result.token) {
        setToken(result.token);
      }

      if (result.username) {
        setUsername(result.username);
      }

      if (result.checkInterval) {
        setCheckInterval(result.checkInterval);
      }
    });
  }, []);

  // Save settings
  const saveSettings = () => {
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
    const interval = Math.max(5, checkInterval);

    // Save to storage
    chrome.storage.sync.set({
      token,
      username,
      checkInterval: interval
    }, () => {
      // Show success message
      showStatus('Settings saved successfully!', 'success');

      // Update check interval in background script
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        checkInterval: interval
      });

      // Trigger an immediate check
      chrome.runtime.sendMessage({
        action: 'checkNow'
      });
    });
  };

  // Helper to show status messages
  const showStatus = (message, type) => {
    setStatus({ message, type, visible: true });

    // Hide status after 3 seconds
    setTimeout(() => {
      setStatus(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  return html`
    <h1>GitHub PR Tracker Settings</h1>

    <div class="token-section">
      <h2>How to create a GitHub Personal Access Token:</h2>
      <ol>
        <li>Go to <a href="https://github.com/settings/tokens" target="_blank">GitHub Personal Access Tokens</a></li>
        <li>Click on "Generate new token" and select "Generate new token (classic)"</li>
        <li>Give your token a descriptive name (e.g., "PR Tracker Extension")</li>
        <li>Select the following scopes: <strong>repo</strong> (to access repositories)</li>
        <li>Click "Generate token" at the bottom of the page</li>
        <li>Copy the generated token and paste it below</li>
      </ol>
    </div>

    <div class="form-group">
      <label for="token">GitHub Personal Access Token:</label>
      <input
        type="password"
        id="token"
        placeholder="ghp_xxxxxxxxxxxxxxxx"
        value=${token}
        onInput=${e => setToken(e.target.value)}
      />
      <div class="help-text">Your token is stored locally and only used to access GitHub API.</div>
    </div>

    <div class="form-group">
      <label for="username">GitHub Username:</label>
      <input
        type="text"
        id="username"
        placeholder="yourusername"
        value=${username}
        onInput=${e => setUsername(e.target.value)}
      />
    </div>

    <div class="form-group">
      <label for="interval">Check Interval (minutes):</label>
      <input
        type="number"
        id="interval"
        min="5"
        max="60"
        placeholder="15"
        value=${checkInterval}
        onInput=${e => setCheckInterval(parseInt(e.target.value) || 15)}
      />
      <div class="help-text">How often to check for PR updates (minimum 5 minutes).</div>
    </div>

    ${status.visible && html`
      <div class="status ${status.type}">
        ${status.message}
      </div>
    `}

    <div class="button-group">
      <button onClick=${saveSettings}>Save Settings</button>
    </div>
  `;
}

// Render the options component
render(html`<${Options} />`, document.getElementById('app'));