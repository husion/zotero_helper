// Logger utility inlined for Content Script (no module support)
class Logger {
    static info(message, ...args) {
        console.log(`[ZoteroHelper] ${message}`, ...args);
    }

    static error(message, ...args) {
        console.error(`[ZoteroHelper] ${message}`, ...args);
    }
}

Logger.info('Content script loaded');

// Configuration
const RECHECK_INTERVAL = 1000;
// Matches both /web-library/ and /<user>/items/
const ZOTERO_URL_PATTERN = /^https:\/\/www\.zotero\.org\/(web-library|[\w]+\/items)/;

function init() {
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
    if (!ZOTERO_URL_PATTERN.test(window.location.href)) return;

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

    const path = window.location.pathname; 
    
    // STRICT REQUIREMENT: Only show on attachment pages
    const attachmentMatch = path.match(/attachment\/([A-Z0-9]+)/);

    if (attachmentMatch) {
        const itemKey = attachmentMatch[1];
        // Clean up any existing buttons (e.g. from previous navigation)
        removeExistingButtons();
        
        // Check if file exists before injecting -> REMOVED as per user request
        // checkAndInject(itemKey);
        injectDownloadButtons(itemKey);
    } else {
        // specific requirement: "best if switch item, remove button"
        removeExistingButtons();
    }
}

function removeExistingButtons() {
    const existing = document.querySelectorAll('[id^="zotero-helper-btn-"]');
    existing.forEach(btn => btn.remove());
}



function injectDownloadButtons(itemKey) {
    // Prevent double injection
    if (document.getElementById(`zotero-helper-btn-${itemKey}`)) return;

    // User requested to ONLY show the bottom right button.
    // We force appending to document.body and using fixed positioning.
    const container = document.body;

    if (container) {
        const btn = document.createElement('button');
        btn.id = `zotero-helper-btn-${itemKey}`;
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

            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_ITEM',
                payload: {
                    key: itemKey,
                    filename: filename
                }
            }, (response) => {
                if (response && response.success) {
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
                    Logger.error(err);
                    alert('Download failed: ' + err);
                    setTimeout(() => {
                        btn.innerText = 'Download from WebDAV';
                        btn.disabled = false;
                    }, 3000);
                }
            });
        };

        container.appendChild(btn);
    }
}

init();
