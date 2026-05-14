// tests/cache.test.js
const path = require('path');
const fs = require('fs');
const cache = require('../src/cache');

const TEST_CACHE_DIR = path.join(__dirname, 'tmp-cache');

beforeEach(() => {
  fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
});

test('lưu và đọc lại data trong TTL', () => {
  cache.set('AR123', [{ name: 'TestProject' }], TEST_CACHE_DIR);
  const result = cache.get('AR123', TEST_CACHE_DIR);
  expect(result).toEqual([{ name: 'TestProject' }]);
});

test('trả null khi cache hết hạn', () => {
  const expired = { data: [{ name: 'Old' }], cachedAt: Date.now() - 2 * 60 * 60 * 1000 };
  fs.writeFileSync(
    path.join(TEST_CACHE_DIR, 'AR123.json'),
    JSON.stringify(expired)
  );
  const result = cache.get('AR123', TEST_CACHE_DIR);
  expect(result).toBeNull();
});

test('trả null khi không có cache', () => {
  const result = cache.get('AR999', TEST_CACHE_DIR);
  expect(result).toBeNull();
});
