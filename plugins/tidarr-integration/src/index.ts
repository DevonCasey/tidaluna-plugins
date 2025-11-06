import { Tracer, type LunaUnload, ReactiveStore, ftch } from "@luna/core";
import { ContextMenu } from "@luna/lib";
import { Settings } from "./Settings";

export const { errSignal, trace } = Tracer("[tidarr-integration]");
export const unloads = new Set<LunaUnload>();
export { Settings } from "./Settings";

// Helper to always get the latest settings
async function getSettings() {
  return await ReactiveStore.getPluginStorage<any>("tidarr-integration", {});
}

async function sendToTidarr(mediaItem: any) {
  const settings = await getSettings();
  const tidarrUrl = settings.tidarrUrl;
  const adminPassword = settings.adminPassword;
  const quality = settings.downloadQuality || "high";

  if (!tidarrUrl || !adminPassword) {
    trace.msg.err("Tidarr URL or admin password not configured in settings");
    return;
  }

  try {
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

    const tidalItem = mediaItem.tidalItem || mediaItem; // fallback
    const isAlbumContext = mediaItem.type !== "track" && tidalItem.album !== undefined && (mediaItem.trackCount || 0) > 1;

    let tidarrItem: any;

    if (isAlbumContext && tidalItem.album) {
      tidarrItem = {
        id: String(tidalItem.album.id),
        title: tidalItem.album.title,
        artist: tidalItem.artists?.[0]?.name || "Unknown Artist",
        artists: [{ name: tidalItem.artists?.[0]?.name || "Unknown Artist" }],
        url: tidalItem.album.url || `https://tidal.com/browse/album/${tidalItem.album.id}`,
        type: "album",
        quality,
        status: "queue",
        loading: true,
        error: false,
      };
    } else {
      tidarrItem = {
        id: String(tidalItem.id),
        title: tidalItem.title || "Unknown Title",
        artist: tidalItem.artists?.[0]?.name || "Unknown Artist",
        artists:
          tidalItem.artists?.map((a: any) => ({ name: a.name })) || [{ name: "Unknown Artist" }],
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

    const response = await ftch.text(`${tidarrUrl}/api/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Origin": tidarrUrl,
        "Referer": `${tidarrUrl}/`,
      },
      body: JSON.stringify({ item: tidarrItem }),
    });

    if (response === "Created" || response.includes("201")) {
      trace.msg.log(`Successfully added to Tidarr: "${tidarrItem.title}" by ${tidarrItem.artist}`);
    } else {
      trace.msg.err("Unexpected response from Tidarr:", response);
    }
  } catch (error: any) {
    trace.msg.err("Failed to send to Tidarr:", error.message || error);
  }
}

ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
  const settings = await getSettings(); // always get the latest settings
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

  // Only show debug button if debugMode is true
  if (debugMode) {
    const debugButton = (ContextMenu as any).addButton(unloads);
    debugButton.text = "Show Tidarr Item Info";

    debugButton.onClick(async () => {
      const win = window.open("", "Tidarr Item Info", "width=500,height=400,resizable");
      if (win) {
        const info = firstTrack;
        win.document.title = "Tidarr Item Info";
        win.document.body.innerHTML = `<pre>${JSON.stringify(info, null, 2)}</pre>`;
      }
    });

    await debugButton.show(contextMenu);
  }
});

