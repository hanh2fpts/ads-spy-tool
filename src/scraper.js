const { chromium } = require('playwright');

const API_URL_PATTERN = /SearchService\/SearchCreatives/;
const TIMEOUT_MS = 30000;
const MAX_PAGES = 200; // safety cap: 200 pages × ~40 ads = 8000 ads max

const PROXY_URL = process.env.https_proxy || process.env.HTTPS_PROXY ||
                  process.env.http_proxy  || process.env.HTTP_PROXY  || null;
const LAUNCH_OPTS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
  ],
  ...(PROXY_URL ? { proxy: { server: PROXY_URL } } : {}),
};

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
  const browser = await chromium.launch(LAUNCH_OPTS);

  try {
    const page = await browser.newPage();
    // Hide webdriver flag that Google uses to detect headless browsers
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await blockJunk(page);

    // Run goto and response-listener concurrently (same as original pattern).
    // This is critical: the SearchCreatives response can arrive before domcontentloaded,
    // so the listener must be active during navigation, not after.
    let endpointPath = null;
    const firstPagePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('NO_DATA')), TIMEOUT_MS);
      page.on('response', async (response) => {
        const url = response.url();
        if (!API_URL_PATTERN.test(url)) return;
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('json')) return;
        try {
          const json = JSON.parse(await response.text());
          const u = new URL(url);
          if (Array.isArray(json?.["1"])) {
            clearTimeout(timer);
            endpointPath = u.pathname + u.search;
            resolve(json);
          } else if (Object.keys(json).length === 0) {
            clearTimeout(timer);
            endpointPath = u.pathname + u.search;
            resolve({ "1": [] });
          }
        } catch (_) {}
      });
    });

    const pageUrl = `https://adstransparency.google.com/advertiser/${advertiserId}?region=anywhere`;
    console.log(`[scraper] navigating to ${pageUrl}`);
    // Navigate first so we can detect Google's sorry/block page immediately.
    // firstPagePromise timer already started above, so no time is lost.
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

    const finalUrl = page.url();
    console.log(`[scraper] landed on: ${finalUrl.slice(0, 100)}`);
    if (finalUrl.includes('google.com/sorry') || finalUrl.includes('recaptcha.google')) {
      throw new Error('BLOCKED');
    }

    const firstPage = await firstPagePromise;
    console.log(`[scraper] navigation complete, endpoint: ${endpointPath}`);

    const allCreatives = [];
    const seenIds = new Set();
    const addBatch = (batch) => {
      let added = 0;
      for (const c of (batch || [])) {
        const id = c["2"];
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        allCreatives.push(c);
        added++;
      }
      return added;
    };

    addBatch(firstPage["1"]);
    const extraKeys = Object.keys(firstPage).filter(k => k !== "1");
    console.log(`[scraper] page 1: ${firstPage["1"].length} creatives — extra fields: [${extraKeys.join(', ')}]`);

    // Google updated their API format (2025-05+): token-based pagination.
    // Advertiser ID goes in "3"."13"."1" (array). Next-page token from response field "2"
    // is passed back in request field "4". Field "7" stays constant.
    const PAGE_SIZE = 40;
    let pageNum = 1;
    let pageToken = firstPage["2"] || null;

    while (pageToken && pageNum < MAX_PAGES) {
      const nextPage = await page.evaluate(async ({ path, advId, token, pageSize }) => {
        try {
          const body = new URLSearchParams({
            'f.req': JSON.stringify({
              "2": pageSize,
              "3": {
                "12": { "1": "", "2": true },
                "13": { "1": [advId] },
              },
              "4": token,
              "7": { "1": 1, "2": 0, "3": 2704 },
            }),
          }).toString();
          const res = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Same-Domain': '1' },
            body,
          });
          if (!res.ok) return null;
          return res.json();
        } catch (_) { return null; }
      }, { path: endpointPath, advId: advertiserId, token: pageToken, pageSize: PAGE_SIZE });

      if (!nextPage || !Array.isArray(nextPage["1"]) || nextPage["1"].length === 0) break;

      const added = addBatch(nextPage["1"]);
      pageNum++;
      pageToken = nextPage["2"] || null;
      console.log(`[scraper] page ${pageNum}: +${added} new (total: ${allCreatives.length})`);
    }

    // Fallback: if direct pagination didn't find a token (field "2" absent or wrong),
    // scroll the DOM to trigger the page's own pagination logic and intercept responses.
    if (pageNum === 1) {
      console.log(`[scraper] no page token found in field "2" — falling back to scroll pagination`);
      let lastCount = allCreatives.length;
      let idleRounds = 0;

      // Re-attach listener to collect scroll-triggered responses
      page.on('response', async (response) => {
        if (!API_URL_PATTERN.test(response.url())) return;
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('json')) return;
        try {
          const json = JSON.parse(await response.text());
          if (Array.isArray(json?.["1"])) {
            const added = addBatch(json["1"]);
            if (added > 0) console.log(`[scraper] scroll: +${added} new (total: ${allCreatives.length})`);
          }
        } catch (_) {}
      });

      for (let i = 0; i < MAX_PAGES && idleRounds < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        if (allCreatives.length === lastCount) {
          idleRounds++;
        } else {
          idleRounds = 0;
          lastCount = allCreatives.length;
        }
      }
    }

    console.log(`[scraper] done: ${allCreatives.length} total creatives across ${pageNum} pages`);
    const rawData = { "1": allCreatives };
    const thumbnailBuffers = await fetchThumbnailBuffers(page, rawData);
    return [rawData, thumbnailBuffers];
  } finally {
    await browser.close();
  }
}

async function fetchThumbnailBuffers(page, rawData) {
  const urls = [...new Set(
    (rawData?.["1"] || [])
      .map(c => (c?.["3"]?.["3"]?.["2"] || '').match(/src="([^"]+)"/)?.[1])
      .filter(Boolean)
  )];

  const buffers = new Map();
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await page.request.fetch(url, { timeout: 10000 });
      if (res.ok()) buffers.set(url, await res.body());
    } catch (_) {}
  }));
  return buffers;
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
  const browser = await chromium.launch(LAUNCH_OPTS);

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
    const [, rawData] = await Promise.all([
      page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS }),
      dataPromise,
    ]);

    return rawData;
  } finally {
    await browser.close();
  }
}

// Fetches destination URLs using the browser's session cookies (bypasses Google's server-side blocking).
// Opens one browser, loads the advertiser page to establish session, then calls GetCreativeById
// from inside page.evaluate() — same-origin requests with real cookies succeed where Node.js fetch fails.
async function batchFetchFinalUrls(advertiserId, rawCreatives) {
  const { parseCreativeDetail } = require('./parser');
  const results = new Map();
  if (rawCreatives.length === 0) return results;

  const browser = await chromium.launch(LAUNCH_OPTS);
  try {
    const page = await browser.newPage();
    await blockJunk(page);

    await page.goto(
      `https://adstransparency.google.com/advertiser/${advertiserId}?region=anywhere`,
      { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS }
    );

    const creativeIds = rawCreatives.map(c => c["2"]).filter(Boolean);
    const BATCH = 8;

    for (let i = 0; i < creativeIds.length; i += BATCH) {
      const batch = creativeIds.slice(i, i + BATCH);
      try {
        const batchResults = await page.evaluate(async ({ ids, advId }) => {
          return Promise.all(ids.map(async (creativeId) => {
            try {
              const body = new URLSearchParams({
                'f.req': JSON.stringify({ "1": advId, "2": creativeId }),
              }).toString();
              const res = await fetch('/anji/_/rpc/LookupService/GetCreativeById?authuser=', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'X-Same-Domain': '1',
                },
                body,
              });
              if (!res.ok) return { creativeId, data: null };
              return { creativeId, data: await res.json() };
            } catch (_) {
              return { creativeId, data: null };
            }
          }));
        }, { ids: batch, advId: advertiserId });

        for (const { creativeId, data } of batchResults) {
          if (data) {
            try {
              const detail = parseCreativeDetail(data);
              console.log(`[batch] ${creativeId} → homepageUrl="${detail.homepageUrl}"`);
              results.set(creativeId, detail.homepageUrl || null);
            } catch (_) {
              results.set(creativeId, null);
            }
          } else {
            console.log(`[batch] ${creativeId} → no data`);
            results.set(creativeId, null);
          }
        }
      } catch (err) {
        console.warn(`[batchFetchFinalUrls] batch ${i}: ${err.message}`);
        for (const id of batch) results.set(id, null);
      }
    }
  } catch (err) {
    console.warn('[batchFetchFinalUrls] browser setup failed:', err.message);
  } finally {
    await browser.close();
  }

  return results;
}

// Like scrape() but calls onPage({ creatives, pageNum, done }) after each Google page.
// Skips thumbnail pre-fetch and enrichment — caller gets raw creatives immediately.
async function scrapeStream(advertiserId, onPage) {
  const browser = await chromium.launch(LAUNCH_OPTS);
  const allCreatives = [];
  const seenIds = new Set();

  const addBatch = (batch) => {
    const newOnes = [];
    for (const c of (batch || [])) {
      const id = c["2"];
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      allCreatives.push(c);
      newOnes.push(c);
    }
    return newOnes;
  };

  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await blockJunk(page);

    let endpointPath = null;
    const firstPagePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('NO_DATA')), TIMEOUT_MS);
      page.on('response', async (response) => {
        const url = response.url();
        if (!API_URL_PATTERN.test(url)) return;
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('json')) return;
        try {
          const json = JSON.parse(await response.text());
          const u = new URL(url);
          if (Array.isArray(json?.["1"])) {
            clearTimeout(timer);
            endpointPath = u.pathname + u.search;
            resolve(json);
          } else if (Object.keys(json).length === 0) {
            clearTimeout(timer);
            endpointPath = u.pathname + u.search;
            resolve({ "1": [] });
          }
        } catch (_) {}
      });
    });

    const pageUrl = `https://adstransparency.google.com/advertiser/${advertiserId}?region=anywhere`;
    console.log(`[scraper/stream] navigating to ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

    const finalUrl = page.url();
    if (finalUrl.includes('google.com/sorry') || finalUrl.includes('recaptcha.google')) {
      throw new Error('BLOCKED');
    }

    const firstPage = await firstPagePromise;
    console.log(`[scraper/stream] page 1: ${firstPage["1"].length} creatives, endpoint: ${endpointPath}`);

    const batch1 = addBatch(firstPage["1"]);
    let pageToken = firstPage["2"] || null;
    await onPage({ creatives: batch1, pageNum: 1, done: !pageToken });

    let pageNum = 1;
    while (pageToken && pageNum < MAX_PAGES) {
      const nextPage = await page.evaluate(async ({ path, advId, token, pageSize }) => {
        try {
          const body = new URLSearchParams({
            'f.req': JSON.stringify({
              "2": pageSize,
              "3": { "12": { "1": "", "2": true }, "13": { "1": [advId] } },
              "4": token,
              "7": { "1": 1, "2": 0, "3": 2704 },
            }),
          }).toString();
          const res = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Same-Domain': '1' },
            body,
          });
          if (!res.ok) return null;
          return res.json();
        } catch (_) { return null; }
      }, { path: endpointPath, advId: advertiserId, token: pageToken, pageSize: PAGE_SIZE });

      if (!nextPage || !Array.isArray(nextPage["1"]) || nextPage["1"].length === 0) break;

      const batch = addBatch(nextPage["1"]);
      pageNum++;
      pageToken = nextPage["2"] || null;
      console.log(`[scraper/stream] page ${pageNum}: +${batch.length} new (total: ${allCreatives.length})`);
      await onPage({ creatives: batch, pageNum, done: !pageToken });
    }

    console.log(`[scraper/stream] done: ${allCreatives.length} total across ${pageNum} pages`);
  } finally {
    await browser.close();
  }

  return allCreatives;
}

module.exports = { scrape, scrapeStream, scrapeCreativeDetail, batchFetchFinalUrls };
