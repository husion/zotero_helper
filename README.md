# Zotero WebDAV Helper

Unlock your Zotero Web Library attachments by fetching them directly from your WebDAV server.

## Features

- **Direct WebDAV Access**: Bypass Zotero storage limits by connecting directly to your WebDAV provider (e.g., Jianguoyun, Nextcloud).
- **Seamless Integration**: Automatically injects a download button into Zotero Web Library item pages.
- **Smart Handling**: Automatically downloads and extracts Zotero's internal ZIP format to give you the actual file.
- **Secure**: Credentials are stored securely in your browser's local storage.

## Installation

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (top right).
4.  Click **Load unpacked** and select the `zotero_helper` directory.

## Configuration

1.  Click the extension icon in the Chrome toolbar and open **Options**.
2.  Enter your WebDAV details:
    - **URL**: The full path to your Zotero `zotero` directory (e.g., `https://dav.jianguoyun.com/dav/zotero/`).
    - **Username**: WebDAV username.
    - **Password**: WebDAV password.
3.  Click **Save**.

## Usage

1.  Navigate to your [Zotero Web Library](https://www.zotero.org/web-library).
2.  Open an item that has an attachment.
3.  Look for the **Download from WebDAV** button and click it to download your file.
