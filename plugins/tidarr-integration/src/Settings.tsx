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

  const testTidarrConnection = async () => {
    if (!tidarrUrl.trim()) {
      setTestResult("failure");
      setTimeout(() => setTestResult(null), 3000);
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const isAuthActiveRes = await ftch.json(`${tidarrUrl}/api/is_auth_active`) as IsAuthActiveResponse;
      const isAuthActive = isAuthActiveRes?.isAuthActive ?? false;

      if (isAuthActive) {
        const authResponse = await ftch.json(`${tidarrUrl}/api/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminPassword || "" }),
        }) as TidarrAuthResponse;

        if (authResponse?.token) {
          setTestResult("success");
        } else {
          setTestResult("failure");
        }
      } else {
        setTestResult("success");
      }
    } catch (error) {
      console.error("Tidarr connection test failed:", error);
      setTestResult("failure");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  return (
    <LunaSettings>
      <LunaTextSetting
        title="Tidarr URL"
        desc="The URL where your Tidarr instance is running (e.g., http://localhost:8484)"
        value={tidarrUrl}
        onChange={(e: any) => {
          const newValue = e.target.value;
          setTidarrUrl(newValue);
          settings.tidarrUrl = newValue;
        }}
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
      >
        <LunaSelectItem value="low">Low</LunaSelectItem>
        <LunaSelectItem value="normal">Normal</LunaSelectItem>
        <LunaSelectItem value="high">High</LunaSelectItem>
        <LunaSelectItem value="master">Master</LunaSelectItem>
      </LunaSelectSetting>

      <LunaSwitchSetting
        title="Debug Mode"
        desc="Enables context menu button for debugging purposes"
        checked={debugMode}
        onChange={(_: any, checked: boolean) => {
          setDebugMode(checked);
          settings.debugMode = checked;
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
      </div>
    </LunaSettings>
  );
};

