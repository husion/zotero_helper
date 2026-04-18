import { Logger, normalizeUrl } from './utils.js';

// Saves options to chrome.storage
const saveOptions = () => {
    const webdavUrl = document.getElementById('webdav_url').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const debugEnabled = document.getElementById('debug_enabled').checked;

    const normalizedUrl = normalizeUrl(webdavUrl);
    Logger.setDebugEnabled(debugEnabled);
    Logger.info('Saving WebDAV settings', {
        webdavUrl,
        normalizedUrl,
        username,
        passwordConfigured: Boolean(password),
        debugEnabled
    });

    chrome.storage.local.set(
        { webdavUrl: normalizedUrl, username, password, debugEnabled },
        () => {
            Logger.info('WebDAV settings saved successfully');
            // Update status to let user know options were saved.
            const status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(() => {
                status.textContent = '';
            }, 750);
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.local.get(
        { webdavUrl: '', username: '', password: '', debugEnabled: false },
        (items) => {
            Logger.setDebugEnabled(Boolean(items.debugEnabled));
            Logger.info('Restoring WebDAV settings', {
                webdavUrl: items.webdavUrl,
                username: items.username,
                passwordConfigured: Boolean(items.password),
                debugEnabled: Boolean(items.debugEnabled)
            });
            document.getElementById('webdav_url').value = items.webdavUrl;
            document.getElementById('username').value = items.username;
            document.getElementById('password').value = items.password;
            document.getElementById('debug_enabled').checked = Boolean(items.debugEnabled);
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
