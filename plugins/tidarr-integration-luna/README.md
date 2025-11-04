# TidaLuna Tidarr Integration Plugin

A TidaLuna plugin that integrates with [Tidarr](https://github.com/cstaelen/tidarr) to download tracks, albums, playlists, and artist discographies directly from the Tidal client.

## Features

- **Context Menu Integration**: Right-click on any track, album, playlist, or artist to send it to Tidarr for download
- **Configurable Quality**: Choose between High (16-bit 44.1kHz), Lossless (FLAC), or Master (24-bit 192kHz) quality
- **Password Protection**: Supports Tidarr instances with admin password authentication
- **Notifications**: Optional notifications when downloads are sent to Tidarr

## Prerequisites

1. [TidaLuna](https://github.com/Inrixia/TidaLuna) installed and working
2. [Tidarr](https://github.com/cstaelen/tidarr) running (via Docker or standalone)
3. Tidarr properly configured with Tidal authentication

## Installation

### Method 1: From Release

1. Download the latest `luna.tidarr` file from the [Releases page](your-repo/releases)
2. In Tidal with TidaLuna, go to **Settings** > **Plugins**
3. Click **Install from file** and select the downloaded `luna.tidarr` file

### Method 2: From URL (Recommended)

1. In Tidal with TidaLuna, go to **Settings** > **Plugins**
2. Click **Install from URL**
3. Paste: `https://your-repo/releases/download/latest/luna.tidarr`

### Method 3: Development Install

1. Clone this repository or use the luna-template:
   ```bash
   git clone https://github.com/Inrixia/luna-template.git tidarr-plugin
   cd tidarr-plugin
   ```

2. Replace the Example plugin with the Tidarr plugin files

3. Install dependencies:
   ```bash
   nvm use node
   corepack enable
   corepack prepare pnpm@latest --activate
   pnpm install
   ```

4. Build and watch:
   ```bash
   pnpm run watch
   ```

5. Install via the DEV store that appears in Luna Settings > Plugin Store

## Configuration

After installation, configure the plugin in **Settings** > **Plugins** > **Tidarr Integration**:

1. **Tidarr URL**: The URL where your Tidarr instance is running
   - `http://tidarr.example.com:8484`

2. **Tidarr Password**: (Optional) Enter if you set `ADMIN_PASSWORD` in your Tidarr environment

3. **Download Quality**: Choose your preferred quality:
   - **High**: 16-bit 44.1kHz (AAC)
   - **Lossless**: 16-bit 44.1kHz FLAC
   - **Master**: 24-bit 192kHz (if available)

4. **Show Notifications**: Toggle to show/hide download confirmation notifications

## Usage

### Context Menu

Right-click on any content in Tidal:

- **Tracks**: Right-click → "Download with Tidarr"
- **Albums**: Right-click → "Download with Tidarr"
- **Playlists**: Right-click → "Download with Tidarr"
- **Artists**: Right-click → "Download All Releases with Tidarr"

The item will be sent to your Tidarr instance and begin downloading according to your Tidarr configuration.

## Troubleshooting

### "Failed to send to Tidarr" error

- Verify Tidarr is running: `docker ps | grep tidarr`
- Check the Tidarr URL in plugin settings is correct
- If using a password, make sure it matches your `ADMIN_PASSWORD`
- Check Tidarr logs: `docker logs tidarr`

### Downloads not starting

- Ensure Tidarr is authenticated with Tidal (check tiddl.json)
- Verify quality settings in Tidarr's tiddl.json match your Tidal subscription
- Check Tidarr download path has write permissions

## API Endpoint Reference

The plugin sends requests to Tidarr's API:

```text
POST /api/download
Content-Type: application/json
Authorization: Bearer <password>  (if password is set)

{
  "url": "https://tidal.com/browse/<type>/<id>",
  "quality": "lossless"
}
```

## Credits

- [TidaLuna](https://github.com/Inrixia/TidaLuna) by Inrixia
- [Tidarr](https://github.com/cstaelen/tidarr) by cstaelen
- [Tiddl](https://github.com/oskvr37/tiddl) by oskvr37