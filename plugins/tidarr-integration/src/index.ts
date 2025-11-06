import { Tracer, type LunaUnload, ReactiveStore, ftch } from "@luna/core";
import { ContextMenu } from "@luna/lib";

export const { errSignal, trace } = Tracer("[tidarr-integration]");
export const unloads = new Set<LunaUnload>();
export { Settings } from "./Settings";

// flexing type safety, because why not
interface TidalArtist {
  id: number;
  name: string;
  type: string;
  picture: string | null;
  handle: string | null;
  userId: number | null;
}

interface TidalAlbum {
  id: number;
  title: string;
  cover: string;
  vibrantColor: string | null;
  videoCover: string | null;
  url: string;
  releaseDate: string;
}

interface TidalItem {
  id: number;
  title: string;
  duration: number;
  version: string | null;
  url: string;
  artists: TidalArtist[];
  album: TidalAlbum | null;
  explicit: boolean;
  volumeNumber: number;
  trackNumber: number;
  popularity: number;
  doublePopularity: number;
  allowStreaming: boolean;
  streamReady: boolean;
  streamStartDate: string;
  adSupportedStreamReady: boolean;
  djReady: boolean;
  stemReady: boolean;
  editable: boolean;
  replayGain: number;
  audioQuality: string;
  audioModes: string[];
  mixes: Record<string, string>;
  mediaMetadata: {
    tags: string[];
  };
  upload: boolean;
  payToStream: boolean;
  accessType: string;
  spotlighted: boolean;
  contentType: string;
}

interface PluginSettings {
  tidarrUrl: string;
  adminPassword: string;
  downloadQuality: string;
  debugMode: boolean;
}

interface TidarrAuthResponse {
  accessGranted: boolean;
  token: string;
}

interface TidarrItem {
  id: string;
  title: string;
  artist: string;
  type: "track" | "album";
  quality: string;
  status: string;
  loading: boolean;
  error: boolean;
  url: string;
}

async function getSettings(): Promise<PluginSettings> {
  return await ReactiveStore.getPluginStorage<PluginSettings>("tidarr-integration", {
    tidarrUrl: "",
    adminPassword: "",
    downloadQuality: "high",
    debugMode: false,
  });
}

async function sendToTidarr(mediaItem: any, asAlbum = false): Promise<void> {
  const settings = await getSettings();
  const { tidarrUrl, adminPassword, downloadQuality } = settings;
  const quality = downloadQuality || "high";

  if (!tidarrUrl?.trim()) {
    trace.msg.err("Tidarr URL not configured in settings");
    return;
  }

  try {
    const authResponse = await ftch.json(`${tidarrUrl}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    }) as TidarrAuthResponse;

    if (!authResponse.accessGranted || !authResponse.token) {
      trace.msg.err("Failed to authenticate with Tidarr");
      return;
    }

    const { token } = authResponse;
    const tidalItem: TidalItem = mediaItem.tidalItem || mediaItem;

    let tidarrItem: TidarrItem;

    if (asAlbum && tidalItem.album) {
      const album = tidalItem.album;
      
      if (!album.id) {
        trace.msg.err("Album ID is missing, cannot send to Tidarr");
        return;
      }
      
      const albumUrl = album.url || `https://tidal.com/browse/album/${album.id}`;
      
      if (!albumUrl.startsWith('http')) {
        trace.msg.err(`Invalid album URL: ${albumUrl}`);
        return;
      }
      
      tidarrItem = {
        id: String(album.id),
        title: album.title || "Unknown Album",
        artist: tidalItem.artists?.[0]?.name || "Unknown Artist",
        type: "album",
        quality,
        status: "queue",
        loading: true,
        error: false,
        url: albumUrl,
      };
    } else {
      const trackUrl = tidalItem.url || 
        (tidalItem.album 
          ? `https://tidal.com/browse/album/${tidalItem.album.id}/track/${tidalItem.id}`
          : `https://tidal.com/browse/track/${tidalItem.id}`);
      
      if (!trackUrl.startsWith('http')) {
        trace.msg.err(`Invalid track URL: ${trackUrl}`);
        return;
      }
      
      tidarrItem = {
        id: String(tidalItem.id),
        title: tidalItem.title || "Unknown Track",
        artist: tidalItem.artists?.[0]?.name || "Unknown Artist",
        type: "track",
        quality,
        status: "queue",
        loading: true,
        error: false,
        url: trackUrl,
      };
    }

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

    const isSuccess = response === "Created" || 
                      response.toLowerCase().includes("created") || 
                      /\b201\b/.test(response);

    if (isSuccess) {
      trace.msg.log(
        `Successfully sent to Tidarr: "${tidarrItem.title}" by ${tidarrItem.artist}`
      );
    } else {
      trace.msg.warn(`Unexpected response from Tidarr: ${response}`);
    }
  } catch (error: any) {
    trace.msg.err("Failed to send to Tidarr:", error.message || error);
  }
}

ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
  const settings = await getSettings();
  const debugMode = settings.debugMode;

  // convert async iterable to array for processing
  const mediaItemsArray: any[] = [];
  for await (const item of await mediaCollection.mediaItems()) {
    mediaItemsArray.push(item);
  }

  if (!mediaItemsArray.length) return;

  const firstItem = mediaItemsArray[0];

  // check if all items belong to the same album
  const isAlbumContext =
    firstItem.tidalItem?.album &&
    mediaItemsArray.length > 1 &&
    mediaItemsArray.every(
      (item) =>
        item.tidalItem?.album?.id === firstItem.tidalItem?.album?.id
    );

  const tidarrButton = (ContextMenu as any).addButton(unloads);
  tidarrButton.text = isAlbumContext
    ? "Send Album to Tidarr"
    : `Send ${mediaItemsArray.length} Track(s) to Tidarr`;

  tidarrButton.onClick(async () => {
    tidarrButton.text = "Sending to Tidarr...";

    try {
      if (isAlbumContext) {
        await sendToTidarr(firstItem, true);
      } else {
        for (const item of mediaItemsArray) {
          await sendToTidarr(item, false);
        }
      }

      tidarrButton.text = isAlbumContext
        ? "Sent Album to Tidarr!"
        : `Sent ${mediaItemsArray.length} Track(s) to Tidarr!`;
    } catch (err) {
      trace.msg.err("Error sending to Tidarr:", err);
      tidarrButton.text = "Failed to Send to Tidarr";
    }

    setTimeout(() => {
      tidarrButton.text = isAlbumContext
        ? "Send Album to Tidarr"
        : `Send ${mediaItemsArray.length} Track(s) to Tidarr`;
    }, 3000);
  });

  await tidarrButton.show(contextMenu);

  if (debugMode) {
    const debugButton = (ContextMenu as any).addButton(unloads);
    debugButton.text = "[DEBUG] Show Media Info";
    debugButton.onClick(() => {
      const win = window.open("", "Tidarr Item Info", "width=500,height=400,resizable");
      if (win) {
        win.document.body.innerHTML = "";
        const pre = win.document.createElement("pre");
        pre.textContent = JSON.stringify(firstItem, null, 2);
        win.document.body.appendChild(pre);
      }
    });
    await debugButton.show(contextMenu);
  }
});
