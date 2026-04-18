// Logger utility inlined for Content Script (no module support)
class Logger {
    static debugEnabled = false;

    static setDebugEnabled(enabled) {
        Logger.debugEnabled = Boolean(enabled);
    }

    static info(message, ...args) {
        if (!Logger.debugEnabled) return;
        console.log(`[ZoteroHelper] ${message}`, ...args);
    }

    static error(message, ...args) {
        console.error(`[ZoteroHelper] ${message}`, ...args);
    }
}

// Configuration
const RECHECK_INTERVAL = 1000;
// Matches web-library and library routes that contain /items/, including collection paths.
const ZOTERO_URL_PATTERN = /^https:\/\/www\.zotero\.org\/(?:web-library|[^?#]*\/items(?:\/|$))/;
let lastLoggedPageState = null;

function initializeDebugLogging() {
    if (!chrome?.storage?.local) return;

    chrome.storage.local.get({ debugEnabled: false }, (items) => {
        Logger.setDebugEnabled(items.debugEnabled);
        Logger.info('Content script loaded');
        Logger.info('Content debug logging configured', {
            debugEnabled: Boolean(items.debugEnabled)
        });
        checkForAttachments();
    });

    if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'local' && changes.debugEnabled) {
                Logger.setDebugEnabled(changes.debugEnabled.newValue);
                Logger.info('Content debug logging updated', {
                    debugEnabled: Boolean(changes.debugEnabled.newValue)
                });
            }
        });
    }
}

function isSupportedZoteroPage(url = window.location.href) {
    return ZOTERO_URL_PATTERN.test(url);
}

function getAttachmentKey(pathname = window.location.pathname) {
    const attachmentMatch = pathname.match(/\/attachment\/([A-Z0-9]+)(?:\/|$)/);
    return attachmentMatch ? attachmentMatch[1] : null;
}

function logPageState(state, details = {}) {
    const signature = JSON.stringify({ state, ...details });
    if (signature === lastLoggedPageState) return;
    lastLoggedPageState = signature;
    Logger.info(`Page state: ${state}`, details);
}

function init() {
    Logger.info('Initializing content script observers');
    // Ideally use MutationObserver, but for simplicity in MV3/SPA, polling + Observer is robust.
    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true });

    // Also check periodically in case of subtle changes
    setInterval(checkForAttachments, RECHECK_INTERVAL);
}

function handleMutations(mutations) {
    // Debounce or filter?
    checkForAttachments();
}

function checkForAttachments() {
    if (!isSupportedZoteroPage(window.location.href)) {
        logPageState('unsupported-route', {
            href: window.location.href
        });
        removeExistingButtons();
        return;
    }

    // Selector for attachment items in Zotero Web Library
    // Note: Zotero classes might be obfuscated or standard.
    // Based on open source Zotero web library or inspection.
    // Assuming a list structure. We'll look for elements representing items that are attachments.
    // Attachments usually have a specific icon or type.
    // This part requires inspected knowledge of Zotero DOM.
    // Since I can't browse, I will use generic selectors or assume "item-title" or similar.
    // User provided architecture mentions: "UI注入: 在附件预览区域插入..."
    // Let's target the "Attachment Preview" area or the item list.
    // If we select an item, the URL might change to /items/[KEY].

    // Strategy: Look for an "open" button or "download" button (native) and add ours next to it.
    // Or if in the list view, add an icon.
    // Let's implement a "Page Action" style or a button in the details pane.

    // Attempt to find the "Info" pane or specific item buttons.
    // Since I don't know the exact class names, I will try to find generic actionable areas.
    // However, the user said "zotero.org/items/". 
    // IF the URL contains /items/, we are viewing an item.

    const attachmentKey = getAttachmentKey(window.location.pathname);

    if (attachmentKey) {
        logPageState('attachment-page-detected', {
            href: window.location.href,
            attachmentKey
        });
        const itemKey = attachmentKey;
        // Clean up any existing buttons (e.g. from previous navigation)
        removeExistingButtons(itemKey);
        
        // Check if file exists before injecting -> REMOVED as per user request
        // checkAndInject(itemKey);
        injectDownloadButtons(itemKey);
    } else {
        logPageState('supported-non-attachment-page', {
            href: window.location.href
        });
        // specific requirement: "best if switch item, remove button"
        removeExistingButtons();
    }
}

function getButtonId(itemKey) {
    return `zotero-helper-btn-${itemKey}`;
}

function removeExistingButtons(keepItemKey = null) {
    const existing = document.querySelectorAll('[id^="zotero-helper-btn-"]');
    let removedCount = 0;
    existing.forEach(btn => {
        if (keepItemKey && btn.id === getButtonId(keepItemKey)) {
            return;
        }
        btn.remove();
        removedCount += 1;
    });
    if (removedCount > 0) {
        Logger.info(`Removing ${removedCount} existing Zotero Helper button(s)`);
    }
}



function injectDownloadButtons(itemKey) {
    // Prevent double injection
    if (document.getElementById(getButtonId(itemKey))) {
        Logger.info(`Button already exists for attachment ${itemKey}`);
        return;
    }

    // User requested to ONLY show the bottom right button.
    // We force appending to document.body and using fixed positioning.
    const container = document.body;

    if (container) {
        Logger.info(`Injecting download button for attachment ${itemKey}`);
        const btn = document.createElement('button');
        btn.id = getButtonId(itemKey);
        btn.innerText = 'Download from WebDAV';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            margin-left: 10px;
            padding: 5px 10px;
            background-color: #cc2936;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            z-index: 2147483647; /* Max z-index */
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;

        btn.onclick = () => {
            Logger.info(`Requesting download for ${itemKey}`);
            btn.innerText = 'Downloading...';
            btn.disabled = true;

            // Extract filename from title
            // Title format usually: "Title - Zotero" or just "Title" in h1
            // User requested: real filename
            // Best we can do is sanitize the title.
            // If the attachment is a PDF, we might want to append .pdf if checking WebDAV didn't give us type.
            // But we know it's likely a PDF inside the zip.
            // Let's take the H1 or document title.
            let filename = `${itemKey}.pdf`; // Fallback
            
            const titleEl = document.querySelector('h1.item-title') || document.querySelector('h1') || document.title;
            if (titleEl) {
                let text = titleEl.innerText || titleEl.textContent;
                text = text.replace(/- Zotero$/, '').trim();
                text = text.replace(/[:\\/*?"<>|]/g, '_'); // Sanitize
                if (text) {
                    filename = text.endsWith('.pdf') ? text : `${text}.pdf`;
                }
            }

            Logger.info(`Resolved download filename for ${itemKey}: ${filename}`);

            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_ITEM',
                payload: {
                    key: itemKey,
                    filename: filename
                }
            }, (response) => {
                if (response && response.success) {
                    Logger.info(`Download request succeeded for ${itemKey}`, response);
                    btn.innerText = 'Downloaded';
                    // Optional: remove button after success? User said "downloaded button still exists"
                    // "切到其他条目两个按钮重合" -> fixed by removeExistingButtons
                    // "switch item, eliminate downloaded button" -> fixed by removeExistingButtons
                    // User might want it to go away after download? "downloaded button still exists" might be a complaint.
                    // Let's hide it after a few seconds or keep it to show status.
                    // User said: "best to eliminate downloaded button AND check webdav"
                    // So maybe remove it? Or just reset.
                    // For now, let's leave it as "Downloaded" but it will be removed on navigation.
                } else {
                    const err = response ? response.error : 'Unknown error';
                    btn.innerText = 'Error';
                    Logger.error(`Download request failed for ${itemKey}: ${err}`);
                    alert('Download failed: ' + err);
                    setTimeout(() => {
                        btn.innerText = 'Download from WebDAV';
                        btn.disabled = false;
                    }, 3000);
                }
            });
        };

        container.appendChild(btn);
    } else {
        Logger.error(`Unable to inject button for ${itemKey}: document.body is unavailable`);
    }
}

init();
initializeDebugLogging();
