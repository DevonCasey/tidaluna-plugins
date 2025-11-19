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
    // Authenticate if password is set
    let token: string | undefined;
    // authenticate if password is set
    if (adminPassword) {
      const authResponse = await ftch.json(`${tidarrUrl}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      }) as TidarrAuthResponse;
      // token is required for authenticated requests
      if (!authResponse.token) {
        trace.msg.err("failed to authenticate with tidarr");
        return;
      }
      token = authResponse.token;
    }

    // use mediaitem.type if present, otherwise infer from context
    const tidalItem: TidalItem = mediaItem.tidalItem || mediaItem;
    let detectedType: string = "track";
    if (mediaItem.type) {
      detectedType = mediaItem.type;
    } else if (asAlbum && tidalItem.album) {
      detectedType = "album";
    }

    let itemType: string = detectedType;
    let itemUrl: string | undefined;
    let item: any = { status: "queue" };

    // map type to correct url format and collect metadata
    switch (itemType) {
      case "album": {
        const album = tidalItem.album || tidalItem;
        itemUrl = album.url || `https://listen.tidal.com/album/${album.id}`;
        item.type = "album";
        item.url = itemUrl;
        item.title = album.title;
        // album artist: use tidalItem.artists if available
        item.artist = Array.isArray(tidalItem.artists) && tidalItem.artists.length > 0 ? tidalItem.artists[0].name : undefined;
        item.quality = mediaItem.quality || "max";
        // album date: use tidalItem.album?.releaseDate if available
        item.date = tidalItem.album?.releaseDate;
        item.track_number = typeof tidalItem.trackNumber === "number" ? tidalItem.trackNumber : undefined;
        item.item = {
          title: tidalItem.title,
          artist: Array.isArray(tidalItem.artists) && tidalItem.artists.length > 0 ? tidalItem.artists[0].name : undefined,
          track_number: typeof tidalItem.trackNumber === "number" ? tidalItem.trackNumber : undefined,
        };
        break;
      }
      case "track": {
        itemUrl = tidalItem.url || `https://listen.tidal.com/track/${tidalItem.id}`;
        item.type = "track";
        item.url = itemUrl;
        item.title = tidalItem.title;
        item.artist = Array.isArray(tidalItem.artists) && tidalItem.artists.length > 0 ? tidalItem.artists[0].name : undefined;
        item.quality = mediaItem.quality || "max";
        item.album = tidalItem.album?.title;
        item.date = tidalItem.album?.releaseDate;
        item.track_number = typeof tidalItem.trackNumber === "number" ? tidalItem.trackNumber : undefined;
        break;
      }
      case "video": {
        itemUrl = tidalItem.url || `https://listen.tidal.com/video/${tidalItem.id}`;
        item.type = "video";
        item.url = itemUrl;
        item.title = tidalItem.title;
        item.artist = Array.isArray(tidalItem.artists) && tidalItem.artists.length > 0 ? tidalItem.artists[0].name : undefined;
        item.quality = mediaItem.quality || "fhd";
        item.album = tidalItem.album?.title;
        item.date = tidalItem.album?.releaseDate;
        break;
      }
      case "playlist": {
        itemUrl = tidalItem.url || `https://listen.tidal.com/playlist/${tidalItem.id}`;
        item.type = "playlist";
        item.url = itemUrl;
        item.title = tidalItem.title;
        item.artist = Array.isArray(tidalItem.artists) && tidalItem.artists.length > 0 ? tidalItem.artists[0].name : undefined;
        item.quality = mediaItem.quality || "max";
        break;
      }
      case "mix": {
        itemUrl = tidalItem.url || `https://listen.tidal.com/mix/${tidalItem.id}`;
        item.type = "mix";
        item.url = itemUrl;
        item.title = tidalItem.title;
        item.artist = Array.isArray(tidalItem.artists) && tidalItem.artists.length > 0 ? tidalItem.artists[0].name : undefined;
        item.quality = mediaItem.quality || "max";
        break;
      }
      case "artist": {
        itemUrl = tidalItem.url || `https://listen.tidal.com/artist/${tidalItem.id}`;
        item.type = "artist";
        item.url = itemUrl;
        item.title = tidalItem.title;
        item.quality = mediaItem.quality || "max";
        break;
      }
      case "artist_videos": {
        itemUrl = tidalItem.url || `https://listen.tidal.com/artist/${tidalItem.id}`;
        item.type = "artist_videos";
        item.url = itemUrl;
        item.title = tidalItem.title;
        item.quality = mediaItem.quality || "max";
        break;
      }
      case "favorite_albums":
      case "favorite_tracks":
      case "favorite_playlists": {
        item.type = itemType;
        item.quality = mediaItem.quality || "max";
        break;
      }
      default: {
        itemType = "track";
        itemUrl = tidalItem.url || `https://listen.tidal.com/track/${tidalItem.id}`;
        item.type = "track";
        item.url = itemUrl;
        item.title = tidalItem.title;
        item.artist = tidalItem.artists?.[0]?.name;
        item.quality = mediaItem.quality || "max";
        break;
      }
    }

    // send to /api/save
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // add authorization header if token is present
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await ftch.text(`${tidarrUrl}/api/save`, {
      method: "POST",
      headers,
      body: JSON.stringify({ item }),
    });

    // check for success by response content
    const isSuccess = response === "Created" ||
      response.toLowerCase().includes("created") ||
      /\b201\b/.test(response);

    if (isSuccess) {
      trace.msg.log(`successfully sent to tidarr: type=${itemType} url=${itemUrl || itemType}`);
    } else {
      trace.msg.warn(`unexpected response from tidarr: ${response}`);
    }
  } catch (error: any) {
    trace.msg.err("failed to send to tidarr:", error.message || error);
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
