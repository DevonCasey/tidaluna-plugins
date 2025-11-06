import { Tracer, type LunaUnload, ReactiveStore, ftch } from "@luna/core";
import { ContextMenu } from "@luna/lib";

export const { errSignal, trace } = Tracer("[tidarr-integration]");
export const unloads = new Set<LunaUnload>();
export { Settings } from "./Settings";

// Load saved plugin settings
async function getSettings() {
  return await ReactiveStore.getPluginStorage<any>("tidarr-integration", {
    tidarrUrl: "",
    adminPassword: "",
    downloadQuality: "high",
    debugMode: false,
  });
}

// Send a media item (track or album) to Tidarr
async function sendToTidarr(mediaItem: any) {
  const settings = await getSettings();
  const tidarrUrl = settings.tidarrUrl;
  const adminPassword = settings.adminPassword;
  const quality = settings.downloadQuality || "high";

  if (!tidarrUrl) {
    trace.msg.err("Tidarr URL not configured in settings");
    return;
  }

  try {
    // Authenticate with Tidarr
    const authResponse = await ftch.json(`${tidarrUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });

    if (!(authResponse as any).accessGranted || !(authResponse as any).token) {
      trace.msg.err("Failed to authenticate with Tidarr");
      return;
    }

    const token = (authResponse as any).token;
    const tidalItem = mediaItem.tidalItem || mediaItem;

    let tidarrItem: any;

    // Check album context
    const isAlbumContext =
      tidalItem.album !== undefined && (mediaItem.trackCount || 0) > 1;

    if (isAlbumContext && tidalItem.album) {
      // Construct proper album object for Tidarr
      const album = tidalItem.album;
      const mainArtist =
        tidalItem.artists?.[0]?.name ||
        "Unknown Artist"; // fallback to first track artist
      
      const tidarrAlbumItem = {
        id: String(album.id),
        title: album.title,
        artist: album.artist || tidalItem.artists?.[0]?.name || "Unknown Artist",
        artists: [{ name: album.artist || tidalItem.artists?.[0]?.name || "Unknown Artist" }],
        url: album.url,
        type: "album",
        quality,
        status: "queue",
        loading: true,
        error: false,
      };
      
    } else {
      // Single track
      tidarrItem = {
        id: String(tidalItem.id),
        title: tidalItem.title || "Unknown Title",
        artist: tidalItem.artists?.[0]?.name || "Unknown Artist",
        artists:
          tidalItem.artists?.map((a: any) => ({ name: a.name })) || [
            { name: "Unknown Artist" },
          ],
        url:
          tidalItem.url ||
          (tidalItem.album
            ? `https://tidal.com/browse/album/${tidalItem.album.id}/track/${tidalItem.id}`
            : `https://tidal.com/browse/track/${tidalItem.id}`),
        type: "track",
        quality,
        status: "queue",
        loading: true,
        error: false,
      };
    }

    // Send to Tidarr
    const response = await ftch.text(`${tidarrUrl}/api/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Origin: tidarrUrl,
        Referer: `${tidarrUrl}/`,
      },
      body: JSON.stringify({ item: tidarrItem }),
    });

    if (response === "Created" || response.includes("201")) {
      trace.msg.log(
        `Successfully added to Tidarr: "${tidarrItem.title}" by ${tidarrItem.artist}`
      );
    } else {
      trace.msg.err("Unexpected response from Tidarr:", response);
    }
  } catch (error: any) {
    trace.msg.err("Failed to send to Tidarr:", error.message || error);
  }
}

// Context menu integration
ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
  const settings = await getSettings();
  const debugMode = settings.debugMode;

  const trackCount = await mediaCollection.count();
  if (trackCount === 0) return;

  const mediaItems = await mediaCollection.mediaItems();
  const firstItem = await mediaItems[Symbol.asyncIterator]().next();
  if (!firstItem.value) return;

  const firstTrack = firstItem.value;
  const isAlbumContext = firstTrack.album !== undefined && trackCount > 1;

  const tidarrDownloadButton = (ContextMenu as any).addButton(unloads);
  const defaultText = (tidarrDownloadButton.text = isAlbumContext
    ? `Send album to Tidarr`
    : `Send ${trackCount} track(s) to Tidarr`);

  tidarrDownloadButton.onClick(async () => {
    if (!tidarrDownloadButton.elem) return;

    tidarrDownloadButton.text = "Sending to Tidarr...";

    try {
      // Send album as single album object
      if (isAlbumContext) {
        await sendToTidarr(firstTrack);
        tidarrDownloadButton.text = `Sent album to Tidarr!`;
      } else {
        let successCount = 0;
        for await (const mediaItem of await mediaCollection.mediaItems()) {
          await sendToTidarr(mediaItem);
          successCount++;
        }
        tidarrDownloadButton.text = `Sent ${successCount} item(s) to Tidarr!`;
      }
    } catch (error) {
      trace.msg.err("Error sending to Tidarr:", error);
      tidarrDownloadButton.text = "Failed to send to Tidarr";
    }

    setTimeout(() => {
      tidarrDownloadButton.text = defaultText;
    }, 3000);
  });

  await tidarrDownloadButton.show(contextMenu);

  // Debug button
  if (debugMode) {
    const debugButton = (ContextMenu as any).addButton(unloads);
    debugButton.text = "[DEBUG] Show Media Info";

    debugButton.onClick(async () => {
      const win = window.open("", "Tidarr Item Info", "width=500,height=400,resizable");
      if (win) {
        const info = firstTrack;
        win.document.title = "Tidarr Item Info";
        const pre = win.document.createElement("pre");
        pre.textContent = JSON.stringify(info, null, 2);
        win.document.body.innerHTML = "";
        win.document.body.appendChild(pre);
      }
    });

    await debugButton.show(contextMenu);
  }
});

