const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadSourceModule } = require('./load-source-module.cjs');

function createChromeStub({ settings = {}, downloadId = 99 } = {}) {
  return {
    runtime: {
      onMessage: { addListener() {} }
    },
    downloads: {
      onChanged: { addListener() {} },
      open() {},
      download: async () => downloadId
    },
    storage: {
      local: {
        get: async () => settings
      }
    }
  };
}

function createBackgroundHarness({
  settings = { webdavUrl: 'https://dav.example.com/', username: 'alice', password: 'secret' },
  clientGetImpl,
  zipFiles,
  downloadId = 99
} = {}) {
  const requestedPaths = [];
  class FakeWebDAVClient {
    constructor(url, username, password) {
      this.url = url;
      this.username = username;
      this.password = password;
    }

    async get(path) {
      requestedPaths.push(path);
      return clientGetImpl(path);
    }
  }

  const chrome = createChromeStub({ settings, downloadId });

  class FakeFileReader {
    readAsDataURL(blob) {
      this.result = `data:application/octet-stream;base64,${blob.base64 || 'ZmFrZQ=='}`;
      queueMicrotask(() => {
        if (this.onloadend) {
          this.onloadend();
        }
      });
    }
  }

  const backgroundModule = loadSourceModule(path.join(__dirname, '..', 'src', 'background.js'), {
    deps: {
      './utils.js': {
        Logger: {
          setDebugEnabled() {},
          info() {},
          error() {}
        }
      },
      './webdav_client.js': {
        WebDAVClient: FakeWebDAVClient
      }
    },
    sideEffects: {
      './lib/jszip.min.js': () => {}
    },
    context: {
      chrome,
      FileReader: FakeFileReader,
      self: {
        JSZip: {
          loadAsync: async () => ({ files: zipFiles })
        }
      }
    },
    exports: ['handleDownload']
  });

  return {
    handleDownload: backgroundModule.handleDownload,
    requestedPaths,
    chrome
  };
}

test('handleDownload fails fast when WebDAV settings are missing', async () => {
  const { handleDownload } = createBackgroundHarness({
    settings: { webdavUrl: '', username: '', password: '' },
    clientGetImpl: async () => new ArrayBuffer(0),
    zipFiles: {}
  });

  await assert.rejects(
    () => handleDownload({ key: 'ABCD1234', filename: 'paper.pdf' }),
    /WebDAV settings not configured\./
  );
});

test('handleDownload retries inside zotero/ when root zip is missing', async () => {
  const zipFiles = {
    'paper.pdf': {
      dir: false,
      async: async () => ({ base64: 'cGRm' })
    }
  };

  const { handleDownload, requestedPaths } = createBackgroundHarness({
    clientGetImpl: async (path) => {
      if (path === 'ABCD1234.zip') {
        throw new Error('WebDAV GET failed: 404 Not Found');
      }
      if (path === 'zotero/ABCD1234.zip') {
        return new ArrayBuffer(8);
      }
      throw new Error(`Unexpected path: ${path}`);
    },
    zipFiles,
    downloadId: 321
  });

  const result = await handleDownload({ key: 'ABCD1234', filename: 'paper.pdf' });
  assert.deepEqual(requestedPaths, ['ABCD1234.zip', 'zotero/ABCD1234.zip']);
  assert.equal(result, 321);
});

test('handleDownload reports both attempted zip locations when neither exists', async () => {
  const { handleDownload } = createBackgroundHarness({
    clientGetImpl: async () => {
      throw new Error('WebDAV GET failed: 404 Not Found');
    },
    zipFiles: {}
  });

  await assert.rejects(
    () => handleDownload({ key: 'ABCD1234', filename: 'paper.pdf' }),
    /File not found on WebDAV \(checked ABCD1234\.zip and zotero\/ABCD1234\.zip\)\./
  );
});
