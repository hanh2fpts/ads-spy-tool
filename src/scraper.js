const { chromium } = require('playwright');

const API_URL_PATTERN = /SearchService\/SearchCreatives/;
const TIMEOUT_MS = 30000;

const BLOCK_TYPES = new Set(['image', 'stylesheet', 'font', 'media']);
const BLOCK_HOSTS = /google-analytics|googletagmanager|doubleclick\.net|googlesyndication|ogads-pa\.clients6/;

async function blockJunk(page) {
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const url = route.request().url();
    if (BLOCK_TYPES.has(type) || BLOCK_HOSTS.test(url)) return route.abort();
    return route.continue();
  });
}

async function scrape(advertiserId) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await blockJunk(page);

    const dataPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('NO_DATA')), TIMEOUT_MS);

      page.on('response', async (response) => {
        if (!API_URL_PATTERN.test(response.url())) return;
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('json')) return;
        try {
          const json = JSON.parse(await response.text());
          if (Array.isArray(json?.["1"])) {
            clearTimeout(timer);
            resolve(json);
          }
        } catch (_) {}
      });
    });

    const url = `https://adstransparency.google.com/advertiser/${advertiserId}?region=anywhere`;
    const [, rawData] = await Promise.all([
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS }),
      dataPromise,
    ]);

    return rawData;
  } finally {
    await browser.close();
  }
}

async function scrapeCreativeDetail(advertiserId, creativeId) {
  try {
    return await fetchCreativeDetailDirect(advertiserId, creativeId);
  } catch (_) {
    return fetchCreativeDetailWithBrowser(advertiserId, creativeId);
  }
}

async function fetchCreativeDetailDirect(advertiserId, creativeId) {
  // Correct format discovered via network capture: application/x-www-form-urlencoded, body = f.req=<JSON>
  const body = new URLSearchParams({
    'f.req': JSON.stringify({ "1": advertiserId, "2": creativeId }),
  }).toString();

  const res = await fetch(
    'https://adstransparency.google.com/anji/_/rpc/LookupService/GetCreativeById?authuser=',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Same-Domain': '1',
        'Origin': 'https://adstransparency.google.com',
        'Referer': `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${creativeId}?region=anywhere`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body,
    }
  );
  if (!res.ok) throw new Error('HTTP_ERROR');
  const json = await res.json();
  if (!json?.["1"]) throw new Error('NO_DATA');
  return json;
}

async function fetchCreativeDetailWithBrowser(advertiserId, creativeId) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await blockJunk(page);

    // Navigate directly to the creative detail page URL (triggers GetCreativeById automatically)
    const dataPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('NO_DATA')), TIMEOUT_MS);
      page.on('response', async (response) => {
        if (!response.url().includes('GetCreativeById')) return;
        try {
          const json = JSON.parse(await response.text());
          if (json?.["1"]) { clearTimeout(timer); resolve(json); }
        } catch (_) {}
      });
    });

    const url = `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${creativeId}?region=anywhere`;
    await Promise.all([
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS }),
      dataPromise,
    ]);

    return await dataPromise;
  } finally {
    await browser.close();
  }
}

// Fetches destination URLs for a list of creatives in parallel (5 at a time).
// Returns Map<creativeId, homepageUrl|null>. Individual failures are silently null.
async function batchFetchFinalUrls(advertiserId, rawCreatives) {
  const { parseCreativeDetail } = require('./parser');
  const results = new Map();
  const BATCH = 5;
  const FETCH_TIMEOUT_MS = 5000;

  for (let i = 0; i < rawCreatives.length; i += BATCH) {
    const batch = rawCreatives.slice(i, i + BATCH);
    await Promise.all(batch.map(async (c) => {
      const creativeId = c["2"];
      if (!creativeId) return;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const body = new URLSearchParams({
          'f.req': JSON.stringify({ "1": advertiserId, "2": creativeId }),
        }).toString();
        const res = await fetch(
          'https://adstransparency.google.com/anji/_/rpc/LookupService/GetCreativeById?authuser=',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Same-Domain': '1',
              'Origin': 'https://adstransparency.google.com',
              'Referer': `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${creativeId}?region=anywhere`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
            body,
            signal: controller.signal,
          }
        );
        clearTimeout(timer);
        if (!res.ok) { results.set(creativeId, null); return; }
        const json = await res.json();
        const detail = parseCreativeDetail(json);
        results.set(creativeId, detail.homepageUrl || null);
      } catch (_) {
        results.set(creativeId, null);
      }
    }));
  }
  return results;
}

module.exports = { scrape, scrapeCreativeDetail, batchFetchFinalUrls };
