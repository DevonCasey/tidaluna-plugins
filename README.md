# TidalLuna Plugins

A collection of TidalLuna plugins. Well, the one plugin.

## Tidarr Integration

A plugin that integrates with [Tidarr](https://github.com/cstaelen/tidarr) to send tracks and albums from Tidal directly to your media server.

### What it does

Right-click on any track or album in Tidal and send it to Tidarr for download. Supports password-protected Tidarr instances and lets you choose download quality (low, normal, high, master).

### Requirements

- [TidalLuna](https://github.com/Inrixia/TidaLuna) installed and working
- [Tidarr](https://github.com/cstaelen/tidarr) running somewhere you can access
- Tidarr configured with your Tidal credentials

### Installation

This will add this repo as a source for plugins that will appear in the store to download.

1. Open Tidal with TidalLuna
2. Go to **Settings** > **Plugins**
3. Click **Install from URL**
4. Paste: `https://github.com/DevonCasey/tidal-luna-plugins/releases/download/latest/store.json`

Navigate to the **Plugin Store** and download away!

### Setup

After installing, configure the plugin in Settings > Plugins > Tidarr Integration:

- **Tidarr URL**: Where your Tidarr instance is running (like `http://localhost:8484`).
- **Admin Password**: Leave empty if no password, otherwise enter your Tidarr admin password  
- **Download Quality**: Pick from low, normal, high, or master

### Usage

Right-click on any track or album in Tidal and choose **Send to Tidarr**. The plugin will talk with your Tidarr instance and add the item to the download queue.

### Troubleshooting

If downloads aren't working:

- Make sure Tidarr is running and accessible at the correct URL
- Test if the Tidarr API is responsive:

```bash
# Set your Tidarr details
TIDARR_URL="https://tidarr.example.com"
TIDARR_PASSWORD="your-password"

# Test authentication
curl -X POST "$TIDARR_URL/api/auth" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"$TIDARR_PASSWORD\"}"

# Should return: {"accessGranted":true,"token":"..."}

# Test without authentication  
curl -X GET "$TIDARR_URL/api/is_auth_active"
# Should return: "false" if no auth required
```

- Check that your admin password is correct (if you set one)
- Verify Tidarr works on its own
- Open a ticket

## Development

For local development:

```bash
git clone https://github.com/DevonCasey/tidal-luna-plugins.git
cd tidal-luna-plugins
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm run watch
```

The local repo will then appear in the **Plugin Store**, select what you want to download and test there.

## Credits

- Lovingly inspired by the SongDownloader plugin written by [Inrixia](https://github.com/Inrixia/luna-plugins/tree/master/plugins/SongDownloader)

<small>Built for [TidalLuna](https://github.com/Inrixia/TidaLuna) and [Tidarr](https://github.com/cstaelen/tidarr).</small>