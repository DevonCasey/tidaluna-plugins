import type { PluginContext } from "@plugin";
import { definePlugin } from "@plugin";
import { intercept } from "@utils/intercept";

interface TidarrSettings {
  tidarrUrl: string;
  tidarrPort: string;
  tidarrPassword: string;
  quality: "high" | "lossless" | "master";
  showNotifications: boolean;
}

const defaultSettings: TidarrSettings = {
  tidarrUrl: "http://localhost",
  tidarrPort: "8484",
  tidarrPassword: "",
  quality: "lossless",
  showNotifications: true,
};

export default definePlugin({
  name: "Tidarr Integration",
  author: "Your Name",
  description: "Send tracks and albums to Tidarr for download via context menu",
  version: "1.0.0",

  settings: {
    tidarrUrl: {
      type: "text",
      label: "Tidarr URL",
      description:
        "The URL of your Tidarr instance including http/s (e.g., http://localhost)",
      defaultValue: defaultSettings.tidarrUrl,
    },
    tidarrPort: {
      type: "text",
      label: "Tidarr Port",
      description: "The port your Tidarr instance is running on",
      defaultValue: defaultSettings.tidarrPort,
    },
    tidarrPassword: {
      type: "text",
      label: "Tidarr Password",
      description: "Admin password if you have ADMIN_PASSWORD set in Tidarr",
      defaultValue: defaultSettings.tidarrPassword,
    },
    quality: {
      type: "dropdown",
      label: "Download Quality",
      description: "Default quality for downloads",
      defaultValue: defaultSettings.quality,
      options: [
        { label: "High (16-bit 44.1kHz)", value: "high" },
        { label: "Lossless (16-bit 44.1kHz FLAC)", value: "lossless" },
        { label: "Master (24-bit 192kHz max)", value: "master" },
      ],
    },
    showNotifications: {
      type: "toggle",
      label: "Show Notifications",
      description: "Show notifications when downloads are sent to Tidarr",
      defaultValue: defaultSettings.showNotifications,
    },
  },

  async start(ctx: PluginContext) {
    const settings = ctx.getSettings<TidarrSettings>();

    // helper function to send to Tidarr
    const sendToTidarr = async (
      type: "track" | "album" | "playlist" | "artist",
      id: string,
      title: string
    ) => {
      try {
        const tidarrUrl = settings.tidarrUrl.replace(/\/$/, "");
        const tidalUrl = `https://tidal.com/browse/${type}/${id}`;

        // construct the API request
        const response = await fetch(`${tidarrUrl}/api/download`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(settings.tidarrPassword && {
              Authorization: `Bearer ${settings.tidarrPassword}`,
            }),
          },
          body: JSON.stringify({
            url: tidalUrl,
            quality: settings.quality,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to send to Tidarr: ${response.statusText}`);
        }

        if (settings.showNotifications) {
          ctx.showNotification({
            title: "Sent to Tidarr",
            message: `"${title}" added to download queue`,
            type: "success",
          });
        }

        return true;
      } catch (error) {
        console.error("Tidarr error:", error);
        ctx.showNotification({
          title: "Tidarr Error",
          message:
            error instanceof Error ? error.message : "Failed to send to Tidarr",
          type: "error",
        });
        return false;
      }
    };

    // add context menu items for tracks
    ctx.addContextMenuItem({
      id: "tidarr-download-track",
      label: "Download with Tidarr",
      contexts: ["track"],
      async onClick(data) {
        if (data.track) {
          await sendToTidarr(
            "track",
            data.track.id,
            `${data.track.title} - ${
              data.track.artists?.[0]?.name || "Unknown Artist"
            }`
          );
        }
      },
    });

    // add context menu items for albums
    ctx.addContextMenuItem({
      id: "tidarr-download-album",
      label: "Download with Tidarr",
      contexts: ["album"],
      async onClick(data) {
        if (data.album) {
          await sendToTidarr(
            "album",
            data.album.id,
            `${data.album.title} - ${
              data.album.artists?.[0]?.name || "Unknown Artist"
            }`
          );
        }
      },
    });

    // add context menu items for playlists
    ctx.addContextMenuItem({
      id: "tidarr-download-playlist",
      label: "Download with Tidarr",
      contexts: ["playlist"],
      async onClick(data) {
        if (data.playlist) {
          await sendToTidarr(
            "playlist",
            data.playlist.uuid,
            data.playlist.title
          );
        }
      },
    });

    // add context menu items for artists (downloads all releases)
    ctx.addContextMenuItem({
      id: "tidarr-download-artist",
      label: "Download All Releases with Tidarr",
      contexts: ["artist"],
      async onClick(data) {
        if (data.artist) {
          await sendToTidarr("artist", data.artist.id, data.artist.name);
        }
      },
    });

    // intercept to add button to UI (optional enhancement)
    intercept("Album", (props: any) => {
      const originalElement = props.children;

      // add a download button to album pages
      const downloadButton = {
        type: "button",
        props: {
          className: "tidarr-download-button",
          onClick: async () => {
            if (props.album) {
              await sendToTidarr(
                "album",
                props.album.id,
                `${props.album.title} - ${
                  props.album.artists?.[0]?.name || "Unknown Artist"
                }`
              );
            }
          },
          children: "Download to Tidarr",
        },
      };

      return [originalElement, downloadButton];
    });

    console.log("Tidarr Integration plugin started");
  },

  async stop() {
    console.log("Tidarr Integration plugin stopped");
  },
});
