import React from "react";
import {
  queryOptions,
  QueryClientProvider,
  useSuspenseQuery,
  QueryClient,
} from "@tanstack/react-query";
import { z } from "zod/v4";
import { ErrorBoundary } from "react-error-boundary";

interface StatusState {
  message: string;
  type: string;
  visible: boolean;
}

const OptionsSchema = z.object({
  token: z.string().min(1).default(""),
  username: z.string().min(1).default(""),
  checkInterval: z.coerce.number().min(5).max(60).default(15),
  hideInactivePRs: z.coerce.boolean().default(true),
});

type Options = z.infer<typeof OptionsSchema>;

const OptionsQuery = queryOptions({
  queryKey: ["options"],
  queryFn: async () => {
    const { token, username, checkInterval, hideInactivePRs } =
      await chrome.storage.sync.get([
        "token",
        "username",
        "checkInterval",
        "hideInactivePRs",
      ]);

    const parsed = OptionsSchema.safeParse({
      token,
      username,
      checkInterval,
      hideInactivePRs,
    });
    if (!parsed.success) {
      throw new Error("Invalid options");
    }

    return parsed.data;
  },
});

const queryClient = new QueryClient();

function ErrorFallback({ error }: { error: Error }) {
  return <div>Error: {error.message}</div>;
}

export function Options() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <React.Suspense fallback={<div>Loading...</div>}>
          <OptionsPage />
        </React.Suspense>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

const OptionsPage: React.FC = () => {
  const { data: options } = useSuspenseQuery(OptionsQuery);
  const [status, setStatus] = React.useState<StatusState>({
    message: "",
    type: "",
    visible: false,
  });

  // Save settings
  const saveSettings = (newOptions: Options) => {
    // Validate inputs
    if (!newOptions.token) {
      showStatus("Please enter your GitHub Personal Access Token.", "error");
      return;
    }

    if (!newOptions.username) {
      showStatus("Please enter your GitHub username.", "error");
      return;
    }

    // Ensure interval is at least 5 minutes
    const interval = Math.max(5, newOptions.checkInterval);

    // Save to storage
    chrome.storage.sync.set(
      {
        token: newOptions.token,
        username: newOptions.username,
        checkInterval: interval,
        hideInactivePRs: newOptions.hideInactivePRs,
      },
      () => {
        // Show success message
        showStatus("Settings saved successfully!", "success");

        // Update check interval in background script
        chrome.runtime.sendMessage({
          action: "updateSettings",
          checkInterval: interval,
        });

        // Trigger an immediate check
        chrome.runtime.sendMessage({
          action: "checkNow",
        });
      }
    );
  };

  // Helper to show status messages
  const showStatus = (message: string, type: string) => {
    setStatus({ message, type, visible: true });
  };
  const clearStatus = () => {
    setStatus({ message: "", type: "", visible: false });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newOptions = OptionsSchema.safeParse({
      token: formData.get("token"),
      username: formData.get("username"),
      checkInterval: formData.get("checkInterval"),
      hideInactivePRs: formData.get("hideInactivePRs"),
    });
    if (!newOptions.success) {
      showStatus(newOptions.error.message, "error");
      return;
    }
    clearStatus();
    saveSettings(newOptions.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>GitHub PR Tracker Settings</h1>

      <div className="token-section">
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
            Give your token a descriptive name (e.g., "PR Tracker Extension")
          </li>
          <li>
            Select the following scopes: <strong>repo</strong> (to access
            repositories)
          </li>
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
          name="token"
          defaultValue={options.token}
        />
        <div className="help-text">
          Your token is stored locally and only used to access GitHub API.
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="username">GitHub Username:</label>
        <input
          type="text"
          id="username"
          placeholder="yourusername"
          name="username"
          defaultValue={options.username}
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
          name="checkInterval"
          defaultValue={options.checkInterval}
        />
        <div className="help-text">
          How often to check for PR updates (minimum 5 minutes).
        </div>
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            name="hideInactivePRs"
            defaultChecked={options.hideInactivePRs}
          />
          Hide PRs with no activity for over a month
        </label>
        <div className="help-text">
          PRs that haven't been updated in 30+ days will be hidden from the
          list.
        </div>
      </div>

      {status.visible && (
        <div className={`status ${status.type}`}>{status.message}</div>
      )}

      <div className="button-group">
        <button type="submit">Save Settings</button>
      </div>
    </form>
  );
};
