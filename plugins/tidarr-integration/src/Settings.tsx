import { ReactiveStore, ftch } from "@luna/core";
import {
  LunaSelectItem,
  LunaSelectSetting,
  LunaSettings,
  LunaTextSetting,
  LunaSwitchSetting,
} from "@luna/ui";
import React from "react";

type PluginSettings = {
  tidarrUrl: string;
  adminPassword: string;
  downloadQuality: "low" | "normal" | "high" | "master";
  debugMode: boolean;
};

interface TidarrAuthResponse {
  accessGranted?: boolean;
  token?: string;
}

interface IsAuthActiveResponse {
  isAuthActive?: boolean;
}

// load settings once and keep a single reactive object
export const settings = await ReactiveStore.getPluginStorage<PluginSettings>(
  "tidarr-integration",
  {
    tidarrUrl: "",
    adminPassword: "",
    downloadQuality: "high",
    debugMode: false,
  }
);

export const Settings = () => {
  const [tidarrUrl, setTidarrUrl] = React.useState(settings.tidarrUrl);
  const [adminPassword, setAdminPassword] = React.useState(settings.adminPassword);
  const [downloadQuality, setDownloadQuality] = React.useState(settings.downloadQuality);
  const [debugMode, setDebugMode] = React.useState(settings.debugMode);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<"success" | "failure" | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);

  const testTidarrConnection = async () => {
    if (!tidarrUrl.trim()) {
      setTestResult("failure");
      setTestError("No Tidarr URL provided.");
      setTimeout(() => { setTestResult(null); setTestError(null); }, 3000);
      return;
    }

    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const isAuthActiveRes = await ftch.json<{ isAuthActive: boolean }>(`${tidarrUrl}/api/is_auth_active`);
      const isAuthActive = isAuthActiveRes?.isAuthActive ?? false;

      if (isAuthActive) {
        const authResponse = await ftch.json<{ token?: string }>(`${tidarrUrl}/api/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminPassword || "" }),
        }) as TidarrAuthResponse;

        if (authResponse?.token) {
          setTestResult("success");
        } else {
          setTestResult("failure");
          setTestError("Authentication failed: No token returned.");
        }
      } else {
        setTestResult("success");
      }
    } catch (error: any) {
      console.error("Tidarr connection test failed:", error);
      setTestResult("failure");
      setTestError(error?.message || String(error));
    } finally {
      setTesting(false);
      setTimeout(() => { setTestResult(null); setTestError(null); }, 5000);
    }
  };

  return (
    <LunaSettings>
      <LunaTextSetting
        title="Tidarr URL"
        desc="The URL where your Tidarr instance is running. REQUIRES HTTPS (e.g., https://tidarr.example.com)"
        value={tidarrUrl}
        onChange={(e: any) => {
          const newValue = e.target.value;
          setTidarrUrl(newValue);
          settings.tidarrUrl = newValue;
        }}
        style={{ minWidth: "150px", maxWidth: "250px", marginLeft: "auto" }}
      />

      <LunaTextSetting
        title="Admin Password"
        desc="Admin password for Tidarr (leave empty if none)"
        type="password"
        value={adminPassword}
        onChange={(e: any) => {
          const newValue = e.target.value;
          setAdminPassword(newValue);
          settings.adminPassword = newValue;
        }}
        style={{ minWidth: "150px", maxWidth: "250px", marginLeft: "auto" }}
      />

      <LunaSelectSetting
        title="Download Quality"
        desc="Quality to request when sending items to Tidarr"
        value={downloadQuality}
        onChange={(e: any) => {
          const newValue = e.target.value;
          setDownloadQuality(newValue);
          settings.downloadQuality = newValue;
        }}
        style={{ minWidth: "80px", maxWidth: "80px", marginLeft: "auto" }}
      >
        <LunaSelectItem value="low">Low</LunaSelectItem>
        <LunaSelectItem value="normal">Normal</LunaSelectItem>
        <LunaSelectItem value="high">High</LunaSelectItem>
        <LunaSelectItem value="master">Master</LunaSelectItem>
      </LunaSelectSetting>

      <LunaSwitchSetting
        title="Debug Mode"
        desc="Enables context menu button for debugging purposes"
        // currently commented out due to typing issues in TidaLuna
        // checked={debugMode}
        {...({ checked: debugMode } as any)}
        onChange={(_event: React.ChangeEvent<HTMLInputElement>, nextChecked: boolean) => {
          setDebugMode(nextChecked);
          settings.debugMode = nextChecked;
        }}
      />

      <div style={{ margin: "16px 0", textAlign: "right" }}>
        <button
          onClick={testTidarrConnection}
          disabled={testing}
          style={{
            padding: "8px 16px",
            backgroundColor:
              testing
                ? "#666"
                : testResult === "success"
                ? "#28a745"
                : testResult === "failure"
                ? "#dc3545"
                : "#0066cc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: testing ? "not-allowed" : "pointer",
            minWidth: "160px",
            maxWidth: "240px",
            fontSize: "14px",
            fontWeight: 500,
            textAlign: "center",
          }}
        >
          {testing
            ? "Testing..."
            : testResult === "success"
            ? "\u2714 Connected"
            : testResult === "failure"
            ? "\u2716 Connection Failed"
            : "Test Tidarr Connection"}
        </button>
        {testResult === "failure" && testError && (
          <div style={{ color: "#dc3545", marginTop: "8px", fontSize: "13px", textAlign: "right" }}>
            Error: {testError}
          </div>
        )}
      </div>
    </LunaSettings>
  );
};

