# Zotero WebDAV Downloader

Download Zotero web-library attachments directly from your own WebDAV storage.

## Overview

Zotero stores web-library attachments as ZIP payloads keyed by attachment ID. This extension adds a floating **Download from WebDAV** button to supported attachment pages, fetches the ZIP from your WebDAV backend, extracts the real file, and passes it to Chrome downloads.

## Features

- Works on Zotero attachment routes such as:
  - `.../attachment/.../library`
  - `.../attachment/.../item-list`
- Supports arbitrary WebDAV hosts, not just one provider
- Retries both:
  - `<attachmentKey>.zip`
  - `zotero/<attachmentKey>.zip`
- Extracts the real file from Zotero's ZIP wrapper before download
- Includes opt-in debug logging

## Install for development

1. Clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this repository directory.

## Configure WebDAV

Open the extension **Options** page and set:

- **WebDAV URL** — for example `https://dav.example.com/zotero/`
- **Username**
- **Password**
- optional: **Enable debug logging**

Then click **Save Settings**.

## Use the extension

1. Open a Zotero attachment page in the web library.
2. Click **Download from WebDAV**.
3. The background worker fetches the ZIP from WebDAV and downloads the extracted file.

## Debugging

When debug logging is enabled:

- Inspect Zotero page logs in the page DevTools console
- Inspect extension background logs in:
  - `chrome://extensions`
  - find the extension
  - click **service worker → Inspect**

## Development

Run tests:

```bash
npm test
```

Current automated coverage includes:

- WebDAV request and retry behavior
- attachment-route detection
- floating button lifecycle
- debug logger gating
- click payload generation

## Repository contents

- `manifest.json` — extension metadata
- `src/` — extension source files
- `src/icons/` — extension icon assets
- `test/` — automated tests
