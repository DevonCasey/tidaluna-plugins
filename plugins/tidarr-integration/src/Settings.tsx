import { ReactiveStore, ftch } from "@luna/core";
import { LunaSelectItem, LunaSelectSetting, LunaSettings, LunaSwitchSetting, LunaTextSetting, LunaButton } from "@luna/ui";
import React from "react";

const defaultTidarrUrl = "http://tidarr.example.com";

type Settings = {
	tidarrUrl: string;
	downloadQuality: string;
	adminPassword: string;
};

export const settings = await ReactiveStore.getPluginStorage<Settings>("tidarr-integration", {
	tidarrUrl: defaultTidarrUrl,
	downloadQuality: "high",
	adminPassword: "",
});

export const Settings = () => {
	const [tidarrUrl, setTidarrUrl] = React.useState(settings.tidarrUrl);
	const [downloadQuality, setDownloadQuality] = React.useState(settings.downloadQuality);
	const [adminPassword, setAdminPassword] = React.useState(settings.adminPassword);
	const [testResult, setTestResult] = React.useState<string>("");
	const [testing, setTesting] = React.useState(false);

	const testTidarrConnection = async () => {
		setTesting(true);
		setTestResult("Testing connection...");
		
		try {
			if (adminPassword && adminPassword.trim() !== "") {
                // test with auth
				setTestResult("Testing authentication...");
				
				const authResponse = await ftch.json(`${tidarrUrl}/api/auth`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Origin": tidarrUrl,
						"Referer": `${tidarrUrl}/`,
					},
					body: JSON.stringify({ password: adminPassword }),
				});
				
				if (authResponse && (authResponse as any).token) {
					setTestResult("Connected! Authentication successful.");
				} else {
					setTestResult("Authentication failed. Check your password.");
				}
			} else {
				// test without auth
				setTestResult("Testing connection...");
				
				const healthCheck = await ftch.text(`${tidarrUrl}/api/is_auth_active`);
				setTestResult("Connected! No authentication required.");
			}
			
		} catch (error: any) {
			setTestResult(`Connection failed: ${error.message || 'Unknown error'}`);
		}
		
		setTesting(false);
	};	return (
		<LunaSettings>
			<LunaTextSetting
				title="Tidarr URL"
				desc="The URL where your Tidarr instance is running (e.g., http://localhost:8484 or http://tidarr.example.com)"
				value={tidarrUrl}
				onChange={async (e: any) => {
                    const url = e.target.value;
                    setTidarrUrl((settings.tidarrUrl = url));
                }}
			/>
			<LunaTextSetting
				title="Admin Password"
				desc="Admin password for your Tidarr instance (leave empty if no password required)"
				value={adminPassword}
				type="password"
				onChange={async (e: any) => {
                    const password = e.target.value;
                    setAdminPassword((settings.adminPassword = password));
                }}
			/>
			<LunaSelectSetting
				title="Download Quality"
				desc="The quality to request when sending items to Tidarr"
				value={downloadQuality}
				onChange={(e: any) => setDownloadQuality((settings.downloadQuality = e.target.value))}
			>
				<LunaSelectItem value="low" children="Low" />
				<LunaSelectItem value="normal" children="Normal" />
				<LunaSelectItem value="high" children="High" />
				<LunaSelectItem value="master" children="Master" />
			</LunaSelectSetting>
			<div style={{ margin: "16px 0" }}>
				<button
					onClick={testTidarrConnection}
					disabled={testing}
					style={{
						padding: "8px 16px",
						backgroundColor: testing ? "#666" : "#0066cc",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: testing ? "not-allowed" : "pointer"
					}}
				>
					{testing ? "Testing..." : "Test Tidarr Connection"}
				</button>
				{testResult && (
					<div style={{ 
						marginTop: "8px", 
						padding: "8px", 
						backgroundColor: testResult.startsWith("Connected!") ? "#d4edda" : "#f8d7da",
						color: testResult.startsWith("Connected!") ? "#155724" : "#721c24",
						borderRadius: "4px"
					}}>
						{testResult}
					</div>
				)}
			</div>
		</LunaSettings>
	);
};