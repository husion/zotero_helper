import { normalizeUrl } from './utils.js';

// Saves options to chrome.storage
const saveOptions = () => {
    const webdavUrl = document.getElementById('webdav_url').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const normalizedUrl = normalizeUrl(webdavUrl);

    chrome.storage.local.set(
        { webdavUrl: normalizedUrl, username, password },
        () => {
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
        { webdavUrl: '', username: '', password: '' },
        (items) => {
            document.getElementById('webdav_url').value = items.webdavUrl;
            document.getElementById('username').value = items.username;
            document.getElementById('password').value = items.password;
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
