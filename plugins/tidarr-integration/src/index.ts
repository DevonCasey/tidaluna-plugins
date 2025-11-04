import { Tracer, type LunaUnload, ReactiveStore, ftch } from "@luna/core";
import { ContextMenu, safeInterval, StyleTag } from "@luna/lib";
import { settings } from "./Settings";

export const { errSignal, trace } = Tracer("[tidarr-integration]");
export const unloads = new Set<LunaUnload>();
export { Settings } from "./Settings";

async function sendToTidarr(mediaItem: any) {
	const settings = await ReactiveStore.getPluginStorage<any>("tidarr-integration", {});
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
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ password: adminPassword }),
		});

		if (!(authResponse as any).accessGranted || !(authResponse as any).token) {
			trace.msg.err("Failed to authenticate with Tidarr");
			return;
		}

		const token = (authResponse as any).token;
		const { tags } = await mediaItem.flacTags();
		
		let itemType: string;
		let tidalItemUrl: string;
		let itemId: string;
		let title: string;
		let artist: string;
				
		if (mediaItem.type === "album" || mediaItem.album) {
			itemType = "album";
			// luna often provides fake sequential ids that are off by 1
			const rawId = mediaItem.album?.id || mediaItem.id;
			itemId = String(parseInt(rawId) - 1);
			title = tags.album || mediaItem.album?.name || mediaItem.name || "Unknown Album";
			artist = tags.albumartist || tags.artist || mediaItem.artists?.[0]?.name || "Unknown Artist";
			tidalItemUrl = `http://www.tidal.com/album/${itemId}`;
		} else {
			itemType = "track";
			itemId = mediaItem.id;
			title = tags.title || mediaItem.name || "Unknown Title";
			artist = tags.artist || mediaItem.artists?.[0]?.name || "Unknown Artist";
			tidalItemUrl = `http://www.tidal.com/track/${itemId}`;
		}
		const tidarrItem = {
			id: itemId,
			title: title,
			artist: artist, 
			artists: [{ name: artist }],
			url: tidalItemUrl,
			type: itemType,
			quality: quality,
			status: "queue",
			loading: true,
			error: false
		};

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
			trace.msg.log(`Successfully added to Tidarr: "${title}" by ${artist}`);
		} else {
			trace.msg.err("Unexpected response from Tidarr:", response);
		}
	} catch (error: any) {
		trace.msg.err("Failed to send to Tidarr:", error.message || error);
	}
}

ContextMenu.onMediaItem(unloads, async ({ mediaCollection, contextMenu }) => {
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
		if (tidarrDownloadButton.elem === undefined) return;
		
		tidarrDownloadButton.text = "Sending to Tidarr...";
		
		try {
			if (isAlbumContext) {
				// send one album request instead of multiple track requests
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
});