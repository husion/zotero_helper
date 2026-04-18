const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadSourceModule } = require('./load-source-module.cjs');

function loadClient({ fetchImpl }) {
  return loadSourceModule(path.join(__dirname, '..', 'src', 'webdav_client.js'), {
    deps: {
      './utils.js': {
        Logger: {
          info() {},
          error() {}
        }
      }
    },
    context: {
      fetch: fetchImpl,
      btoa: (value) => Buffer.from(value, 'utf8').toString('base64')
    },
    exports: ['WebDAVClient']
  }).WebDAVClient;
}

test('WebDAVClient builds Basic auth header', () => {
  const WebDAVClient = loadClient({ fetchImpl: async () => { throw new Error('unused'); } });
  const client = new WebDAVClient('https://dav.example.com/', 'alice', 'secret');
  assert.equal(
    client.getAuthHeader().Authorization,
    `Basic ${Buffer.from('alice:secret', 'utf8').toString('base64')}`
  );
});

test('propfind sends PROPFIND with Depth header and returns text', async () => {
  const calls = [];
  const WebDAVClient = loadClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        text: async () => '<propfind />'
      };
    }
  });

  const client = new WebDAVClient('https://dav.example.com/base/', 'alice', 'secret');
  const result = await client.propfind('item.zip');

  assert.equal(result, '<propfind />');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://dav.example.com/base/item.zip');
  assert.equal(calls[0].options.method, 'PROPFIND');
  assert.equal(calls[0].options.headers.Depth, '0');
});

test('get returns arrayBuffer when response is ok', async () => {
  const payload = new ArrayBuffer(8);
  const WebDAVClient = loadClient({
    fetchImpl: async () => ({
      ok: true,
      arrayBuffer: async () => payload
    })
  });

  const client = new WebDAVClient('https://dav.example.com/', 'alice', 'secret');
  const result = await client.get('item.zip');
  assert.equal(result, payload);
});

test('get wraps network errors with actionable message', async () => {
  const WebDAVClient = loadClient({
    fetchImpl: async () => {
      throw new Error('Failed to fetch');
    }
  });

  const client = new WebDAVClient('https://dav.example.com/', 'alice', 'secret');
  await assert.rejects(
    () => client.get('item.zip'),
    /WebDAV request blocked or unreachable for https:\/\/dav\.example\.com\/item\.zip: Failed to fetch/
  );
});

test('get surfaces HTTP status errors', async () => {
  const WebDAVClient = loadClient({
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    })
  });

  const client = new WebDAVClient('https://dav.example.com/', 'alice', 'secret');
  await assert.rejects(() => client.get('item.zip'), /WebDAV GET failed: 403 Forbidden/);
});
