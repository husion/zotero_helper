/**
 * Shared utility functions
 */

export class Logger {
    static info(message, ...args) {
        console.log(`[ZoteroHelper] ${message}`, ...args);
    }

    static error(message, ...args) {
        console.error(`[ZoteroHelper] ${message}`, ...args);
    }
}

/**
 * Helper to ensure URLs are valid
 * @param {string} url 
 * @returns {string}
 */
export function normalizeUrl(url) {
    if (!url) return '';
    return url.endsWith('/') ? url : `${url}/`;
}
