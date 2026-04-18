const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadSourceModule } = require('./load-source-module.cjs');

function loadUtilsModule({ consoleStub } = {}) {
  return loadSourceModule(path.join(__dirname, '..', 'src', 'utils.js'), {
    context: consoleStub ? { console: consoleStub } : {},
    exports: ['Logger', 'normalizeUrl']
  });
}

const utilsModule = loadUtilsModule();

test('normalizeUrl returns empty string for empty input', () => {
  assert.equal(utilsModule.normalizeUrl(''), '');
});

test('normalizeUrl appends trailing slash when missing', () => {
  assert.equal(utilsModule.normalizeUrl('https://dav.example.com/root'), 'https://dav.example.com/root/');
});

test('normalizeUrl preserves trailing slash when already present', () => {
  assert.equal(utilsModule.normalizeUrl('https://dav.example.com/root/'), 'https://dav.example.com/root/');
});

test('Logger.info is suppressed when debug logging is disabled', () => {
  const calls = [];
  const { Logger } = loadUtilsModule({
    consoleStub: {
      log: (...args) => calls.push(args),
      error() {}
    }
  });

  Logger.setDebugEnabled(false);
  Logger.info('hidden');
  assert.equal(calls.length, 0);
});

test('Logger.info is emitted when debug logging is enabled', () => {
  const calls = [];
  const { Logger } = loadUtilsModule({
    consoleStub: {
      log: (...args) => calls.push(args),
      error() {}
    }
  });

  Logger.setDebugEnabled(true);
  Logger.info('visible', { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '[ZoteroHelper] visible');
});
