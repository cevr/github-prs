import React, { useState, useEffect } from 'react';

interface StatusState {
  message: string;
  type: string;
  visible: boolean;
}

export const OptionsApp: React.FC = () => {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [checkInterval, setCheckInterval] = useState(15);
  const [status, setStatus] = useState<StatusState>({ message: '', type: '', visible: false });

  // Load saved settings on component mount
  useEffect(() => {
    // @ts-ignore - Chrome API
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
    // @ts-ignore - Chrome API
    chrome.storage.sync.set({
      token,
      username,
      checkInterval: interval
    }, () => {
      // Show success message
      showStatus('Settings saved successfully!', 'success');

      // Update check interval in background script
      // @ts-ignore - Chrome API
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        checkInterval: interval
      });

      // Trigger an immediate check
      // @ts-ignore - Chrome API
      chrome.runtime.sendMessage({
        action: 'checkNow'
      });
    });
  };

  // Helper to show status messages
  const showStatus = (message: string, type: string) => {
    setStatus({ message, type, visible: true });

    // Hide status after 3 seconds
    setTimeout(() => {
      setStatus(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  return (
    <>
      <h1>GitHub PR Tracker Settings</h1>

      <div className="token-section">
        <h2>How to create a GitHub Personal Access Token:</h2>
        <ol>
          <li>Go to <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">GitHub Personal Access Tokens</a></li>
          <li>Click on "Generate new token" and select "Generate new token (classic)"</li>
          <li>Give your token a descriptive name (e.g., "PR Tracker Extension")</li>
          <li>Select the following scopes: <strong>repo</strong> (to access repositories)</li>
          <li>Click "Generate token" at the bottom of the page</li>
          <li>Copy the generated token and paste it below</li>
        </ol>
      </div>

      <div className="form-group">
        <label htmlFor="token">GitHub Personal Access Token:</label>
        <input
          type="password"
          id="token"
          placeholder="ghp_xxxxxxxxxxxxxxxx"
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        <div className="help-text">Your token is stored locally and only used to access GitHub API.</div>
      </div>

      <div className="form-group">
        <label htmlFor="username">GitHub Username:</label>
        <input
          type="text"
          id="username"
          placeholder="yourusername"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="interval">Check Interval (minutes):</label>
        <input
          type="number"
          id="interval"
          min="5"
          max="60"
          placeholder="15"
          value={checkInterval}
          onChange={e => setCheckInterval(parseInt(e.target.value) || 15)}
        />
        <div className="help-text">How often to check for PR updates (minimum 5 minutes).</div>
      </div>

      {status.visible && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}

      <div className="button-group">
        <button onClick={saveSettings}>Save Settings</button>
      </div>
    </>
  );
};