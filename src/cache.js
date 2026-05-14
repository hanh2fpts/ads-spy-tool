// src/cache.js
const fs = require('fs');
const path = require('path');

const DEFAULT_CACHE_DIR = path.join(__dirname, '../cache');
const TTL_MS = 60 * 60 * 1000; // 1 giờ

function get(advertiserId, cacheDir = DEFAULT_CACHE_DIR) {
  const file = path.join(cacheDir, `${advertiserId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const { data, cachedAt } = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (Date.now() - cachedAt > TTL_MS) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function set(advertiserId, data, cacheDir = DEFAULT_CACHE_DIR) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const file = path.join(cacheDir, `${advertiserId}.json`);
  fs.writeFileSync(file, JSON.stringify({ data, cachedAt: Date.now() }));
}

module.exports = { get, set };
