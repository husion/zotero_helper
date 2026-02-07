import { Logger } from './utils.js';
import { WebDAVClient } from './webdav_client.js';
import './lib/jszip.min.js';

const JSZip = self.JSZip;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DOWNLOAD_ITEM') {
        handleDownload(message.payload).then((downloadId) => {
            sendResponse({ success: true, downloadId: downloadId });
        }).catch(err => {
            Logger.error(`Download failed: ${err.message}`);
            sendResponse({ success: false, error: err.message });
        });
        return true; // Keep channel open
    }
});

// Auto-open file after download
chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state && delta.state.current === 'complete') {
        // We could track specific download IDs if needed, but for now open all completes from this extension
        // Better to check if it matches our downloadId if possible, but handleDownload returns it.
        // For simplicity, we can rely on the user intent 'open after download'.
        chrome.downloads.open(delta.id);
    }
});

async function handleDownload(item) {
    const { key, filename } = item;
    Logger.info(`Starting download for item: ${key} (${filename})`);

    // 1. Get Settings
    const settings = await chrome.storage.local.get(['webdavUrl', 'username', 'password']);
    if (!settings.webdavUrl || !settings.username || !settings.password) {
        throw new Error('WebDAV settings not configured.');
    }

    const client = new WebDAVClient(settings.webdavUrl, settings.username, settings.password);

    // 2. Fetch ZIP
    let zipPath = `${key}.zip`;
    let zipData;
    
    try {
        zipData = await client.get(zipPath);
    } catch (e) {
        // If 404, try adding 'zotero/' prefix in case user configured root WebDAV URL
        if (e.message.includes('404')) {
            Logger.info('404 received, trying zotero/ prefix...');
            zipPath = `zotero/${key}.zip`;
            try {
                zipData = await client.get(zipPath);
            } catch (retryErr) {
                // If it fails again, check if it was 404 or something else
                if (retryErr.message.includes('404')) {
                     // Could be 'zotero' folder is not there, or it's a Prop file issue. 
                     // Zotero sometimes uses .prop files. But usually the zip is the main storage.
                     throw new Error(`File not found on WebDAV (checked ${key}.zip and zotero/${key}.zip). Check your URL settings.`);
                }
                throw retryErr;
            }
        } else {
            throw e;
        }
    }

    // 3. Unzip
    const zip = await JSZip.loadAsync(zipData);

    // 4. Find the file
    let targetFile = null;
    const files = Object.keys(zip.files);
    Logger.info(`Files in zip: ${files.join(', ')}`);

    for (const f of files) {
        // Simple match: if filename is provided and matches end of path
        // OR matching the key inside the zip if Zotero organizes it that way
        if (f.endsWith(filename)) {
            targetFile = zip.files[f];
            break;
        }
    }

    if (!targetFile) {
        // Fallback: finding the largest file that is likely the attachment
        // Filtering out hidden files or known Zotero metadata if any
        let largestSize = 0;
        for (const f of files) {
            if (!zip.files[f].dir && !f.startsWith('.') && !f.includes('__MACOSX')) {
                // JSZip doesn't always have size immediately if streamed, but for this loadAsync it should.
                // We can check internal data or just assume the first main file.
                targetFile = zip.files[f]; // Take the last one or first? Let's take the first valid one if specific not found.
                break;
            }
        }
    }

    if (!targetFile) {
        throw new Error('File not found in ZIP.');
    }

    const blob = await targetFile.async('blob');

    // 5. Download
    const base64data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
    });

    try {
        await chrome.downloads.download({
            url: base64data,
            filename: filename,
            saveAs: true
        });
    } catch (e) {
        Logger.error('Chrome download failed', e);
        throw e;
    }
}
