const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadSourceModule } = require('./load-source-module.cjs');

function createFakeDom() {
  const nodes = new Map();

  const fakeBody = {
    appendChild(node) {
      nodes.set(node.id, node);
      node.parentNode = fakeBody;
    }
  };

  const fakeDocument = {
    body: fakeBody,
    title: 'Example - Zotero',
    querySelectorAll(selector) {
      if (selector === '[id^="zotero-helper-btn-"]') {
        return [...nodes.values()].filter((node) => node.id.startsWith('zotero-helper-btn-'));
      }
      return [];
    },
    querySelector: () => null,
    getElementById(id) {
      return nodes.get(id) || null;
    },
    createElement() {
      const node = {
        id: '',
        innerText: '',
        disabled: false,
        style: {},
        remove() {
          nodes.delete(node.id);
        }
      };
      return node;
    }
  };

  return {
    fakeDocument,
    getButtons() {
      return [...nodes.values()].filter((node) => node.id.startsWith('zotero-helper-btn-'));
    }
  };
}

function loadContentModule({ href = 'https://www.zotero.org/web-library', pathname = '/web-library' } = {}) {
  const dom = createFakeDom();

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {}
  }

  const moduleExports = loadSourceModule(path.join(__dirname, '..', 'src', 'content.js'), {
    context: {
      window: {
        location: {
          href,
          pathname
        }
      },
      document: dom.fakeDocument,
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
    exports: ['isSupportedZoteroPage', 'getAttachmentKey', 'checkForAttachments', 'removeExistingButtons']
  });

  return {
    ...moduleExports,
    getButtons: dom.getButtons
  };
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

test('repeated checks on the same attachment page reuse the existing button', () => {
  const content = loadContentModule({
    href: 'https://www.zotero.org/husion/items/GDEVQWFG/attachment/N3SNM9CA/item-details',
    pathname: '/husion/items/GDEVQWFG/attachment/N3SNM9CA/item-details'
  });

  assert.equal(content.getButtons().length, 1);
  assert.equal(content.getButtons()[0].id, 'zotero-helper-btn-N3SNM9CA');

  content.checkForAttachments();

  assert.equal(content.getButtons().length, 1);
  assert.equal(content.getButtons()[0].id, 'zotero-helper-btn-N3SNM9CA');
});
