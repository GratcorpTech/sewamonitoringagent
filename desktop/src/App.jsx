import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [instanceUrl, setInstanceUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");


const handleConnect = async (e) => {
  e.preventDefault();

  setSaveMessage("");
  setSaveError("");

  if (!instanceUrl.trim() || !username.trim() || !password) {
    setSaveError("Please fill in all fields.");
    return;
  }

  try {
    setIsSaving(true);

    const result = await window.sewaAPI.saveSettings({
      instanceUrl: instanceUrl.trim(),
      username: username.trim(),
      password,
    });

    setSaveMessage(result.message || "Monitoring agent started successfully.");

    // Clear the password from the React form state.
    setPassword("");

    console.log("[AGENT]", result.message);
  } catch (error) {
    console.error("[AGENT ERROR]", error);
    setSaveError(error.message || "Unable to save configuration.");
  } finally {
    setIsSaving(false);
  }
};


useEffect(() => {
  const loadSavedSettings = async () => {
    try {
      const settings = await window.sewaAPI.getSettings();

      if (settings) {
        setInstanceUrl(settings.instanceUrl || "");
        setUsername(settings.username || "");
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  loadSavedSettings();
}, []);

  return (
    <div className="app-container">
      <aside className="brand-panel">
        <div className="brand-content">
          <div className="brand-logo">S</div>

          <div>
            <h2>SEWA</h2>
            <span>MONITORING AGENT</span>
          </div>
        </div>

        <div className="brand-message">
          <div className="brand-tag">WORKSPACE MANAGEMENT</div>

          <h1>
            Your workspace.
            <br />
            Your productivity.
            <br />
            <span>Connected.</span>
          </h1>

          <p>
            Connect your SEWA account and register your device to get started
            with application usage monitoring.
          </p>
        </div>

        <div className="brand-footer">
          <span className="status-dot" />
          SEWA Monitoring Platform
        </div>
      </aside>

      <main className="setup-panel">
        <div className="setup-content">
          <div className="step-indicator">
            <span className="step-number">01</span>
            <span>INITIAL CONFIGURATION</span>
          </div>

          <h1>Connect your account</h1>

          <p className="setup-description">
            Enter your SEWA instance details and employee credentials to
            register this device.
          </p>

          <form onSubmit={handleConnect}>
            <div className="form-group">
              <label>SEWA INSTANCE URL</label>

              <div className="input-wrapper">
                <span className="input-icon">↗</span>
                <input
                  type="url"
                  placeholder="https://your-instance.sewa.com"
                  value={instanceUrl}
                  onChange={(e) => setInstanceUrl(e.target.value)}
                  required
                />
              </div>
              <small>Enter your organization's SEWA URL.</small>
            </div>

            <div className="form-group">
              <label>EMPLOYEE ID / USERNAME</label>

              <div className="input-wrapper">
                <span className="input-icon">◎</span>
                <input
                  type="text"
                  placeholder="Enter your employee ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>PASSWORD</label>

              <div className="input-wrapper">
                <span className="input-icon">⌑</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="connect-button"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Configuration"}
              {!isSaving && <span>→</span>}
            </button>

            {saveMessage && (
              <p style={{ color: "green", fontSize: "13px" }}>{saveMessage}</p>
            )}

            {saveError && (
              <p style={{ color: "red", fontSize: "13px" }}>{saveError}</p>
            )}
          </form>

          <div className="security-note">
            <span>🔒</span>
            <p>
              Your credentials will be handled securely. Authentication details
              are not stored as plain text.
            </p>
          </div>
        </div>

        <footer className="setup-footer">
          <span>SEWA Monitoring Agent</span>
          <span>Version 1.0.0</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
