import {
  createResource,
  createSignal,
  ErrorBoundary,
  Suspense,
  Show,
} from "solid-js";

interface OptionsData {
  token: string;
  username: string;
  checkInterval: number;
  hideInactivePRs: boolean;
}

async function fetchOptions(): Promise<OptionsData> {
  const result = await chrome.storage.sync.get([
    "token",
    "username",
    "checkInterval",
    "hideInactivePRs",
  ]);
  return {
    token: (result.token as string) ?? "",
    username: (result.username as string) ?? "",
    checkInterval: Number(result.checkInterval) || 15,
    hideInactivePRs: result.hideInactivePRs !== false,
  };
}

function OptionsPage() {
  const [options] = createResource(fetchOptions);
  const [status, setStatus] = createSignal<{
    message: string;
    type: string;
    visible: boolean;
  }>({ message: "", type: "", visible: false });

  const showStatus = (message: string, type: string) => {
    setStatus({ message, type, visible: true });
  };

  const clearStatus = () => {
    setStatus({ message: "", type: "", visible: false });
  };

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    clearStatus();

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const token = (formData.get("token") as string)?.trim();
    const username = (formData.get("username") as string)?.trim();
    const checkInterval = Math.min(60, Math.max(5, Number(formData.get("checkInterval")) || 15));
    const hideInactivePRs = formData.get("hideInactivePRs") === "on";

    if (!token) {
      showStatus("Please enter your GitHub Personal Access Token.", "error");
      return;
    }
    if (!username) {
      showStatus("Please enter your GitHub username.", "error");
      return;
    }

    chrome.storage.sync.set(
      { token, username, checkInterval, hideInactivePRs },
      () => {
        showStatus("Settings saved successfully!", "success");
        chrome.runtime.sendMessage({
          action: "updateSettings",
          checkInterval,
        });
        chrome.runtime.sendMessage({ action: "checkNow" });
      }
    );
  };

  return (
    <Show when={options()} fallback={<div>Loading...</div>}>
      {(opts) => (
        <form onSubmit={handleSubmit}>
          <h1>GitHub PR Tracker Settings</h1>

          <div class="token-section">
            <h2>How to create a GitHub Personal Access Token:</h2>
            <ol>
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub Personal Access Tokens
                </a>
              </li>
              <li>
                Click on "Generate new token" and select "Generate new token
                (classic)"
              </li>
              <li>
                Give your token a descriptive name (e.g., "PR Tracker
                Extension")
              </li>
              <li>
                Select the following scopes: <strong>repo</strong> (to access
                repositories)
              </li>
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
              name="token"
              value={opts().token}
            />
            <div class="help-text">
              Your token is stored locally and only used to access GitHub API.
            </div>
          </div>

          <div class="form-group">
            <label for="username">GitHub Username:</label>
            <input
              type="text"
              id="username"
              placeholder="yourusername"
              name="username"
              value={opts().username}
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
              name="checkInterval"
              value={opts().checkInterval}
            />
            <div class="help-text">
              How often to check for PR updates (minimum 5 minutes).
            </div>
          </div>

          <div class="form-group">
            <label>
              <input
                type="checkbox"
                name="hideInactivePRs"
                checked={opts().hideInactivePRs}
              />
              Hide PRs with no activity for over a month
            </label>
            <div class="help-text">
              PRs that haven't been updated in 30+ days will be hidden from
              the list.
            </div>
          </div>

          <Show when={status().visible}>
            <div class={`status ${status().type}`}>{status().message}</div>
          </Show>

          <div class="button-group">
            <button type="submit">Save Settings</button>
          </div>
        </form>
      )}
    </Show>
  );
}

export function Options() {
  return (
    <ErrorBoundary fallback={(err: Error) => <div>Error: {err.message}</div>}>
      <Suspense fallback={<div>Loading...</div>}>
        <OptionsPage />
      </Suspense>
    </ErrorBoundary>
  );
}
