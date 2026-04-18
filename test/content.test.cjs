const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadSourceModule } = require('./load-source-module.cjs');

function loadContentModule({ href = 'https://www.zotero.org/web-library', pathname = '/web-library' } = {}) {
  const fakeBody = {
    appendChild() {}
  };

  const fakeDocument = {
    body: fakeBody,
    title: 'Example - Zotero',
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => ({ style: {}, remove() {} })
  };

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {}
  }

  return loadSourceModule(path.join(__dirname, '..', 'src', 'content.js'), {
    context: {
      window: {
        location: {
          href,
          pathname
        }
      },
      document: fakeDocument,
      MutationObserver: FakeMutationObserver,
      setInterval: () => 1,
      clearInterval: () => {},
      chrome: {
        runtime: { sendMessage() {} },
        storage: {
          local: {
            get(_defaults, callback) {
              callback({ debugEnabled: false });
            }
          },
          onChanged: {
            addListener() {}
          }
        }
      },
      alert() {}
    },
    exports: ['isSupportedZoteroPage', 'getAttachmentKey']
  });
}

test('supports classic web-library route', () => {
  const content = loadContentModule();
  assert.equal(content.isSupportedZoteroPage('https://www.zotero.org/web-library'), true);
});

test('supports collection attachment route under a user library', () => {
  const content = loadContentModule();
  assert.equal(
    content.isSupportedZoteroPage('https://www.zotero.org/husion/collections/WVD3Q2S7/items/3XPEPU5R/attachment/9DHLKRYR/item-list'),
    true
  );
});

test('does not support unrelated zotero pages without /items/', () => {
  const content = loadContentModule();
  assert.equal(content.isSupportedZoteroPage('https://www.zotero.org/husion/collections/WVD3Q2S7'), false);
});

test('extracts attachment key from item-list attachment route', () => {
  const content = loadContentModule();
  assert.equal(
    content.getAttachmentKey('/husion/collections/WVD3Q2S7/items/3XPEPU5R/attachment/9DHLKRYR/item-list'),
    '9DHLKRYR'
  );
});

test('returns null when path is not an attachment page', () => {
  const content = loadContentModule();
  assert.equal(content.getAttachmentKey('/husion/collections/WVD3Q2S7/items/3XPEPU5R/item-details'), null);
});
