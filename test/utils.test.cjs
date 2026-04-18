const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadSourceModule } = require('./load-source-module.cjs');

const utilsModule = loadSourceModule(path.join(__dirname, '..', 'src', 'utils.js'), {
  exports: ['Logger', 'normalizeUrl']
});

test('normalizeUrl returns empty string for empty input', () => {
  assert.equal(utilsModule.normalizeUrl(''), '');
});

test('normalizeUrl appends trailing slash when missing', () => {
  assert.equal(utilsModule.normalizeUrl('https://dav.example.com/root'), 'https://dav.example.com/root/');
});

test('normalizeUrl preserves trailing slash when already present', () => {
  assert.equal(utilsModule.normalizeUrl('https://dav.example.com/root/'), 'https://dav.example.com/root/');
});
