const { chromium } = require('playwright');

const API_URL_PATTERN = /SearchService\/SearchCreatives/;
const TIMEOUT_MS = 30000;

async function scrape(advertiserId) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

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
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    // Navigate to the advertiser page to establish session cookies
    await page.goto(`https://adstransparency.google.com/advertiser/${advertiserId}?region=anywhere`, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT_MS,
    });

    // Call GetCreativeById from within the browser context (uses existing session)
    const raw = await page.evaluate(async ({ advertiserId, creativeId }) => {
      const res = await fetch(
        'https://adstransparency.google.com/anji/_/rpc/LookupService/GetCreativeById?authuser=',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json+protobuf',
            'X-Same-Domain': '1',
          },
          body: JSON.stringify({ "1": advertiserId, "2": creativeId }),
        }
      );
      if (!res.ok) throw new Error('FETCH_FAILED');
      return res.json();
    }, { advertiserId, creativeId });

    if (!raw?.["1"]) throw new Error('NO_DATA');
    return raw;
  } finally {
    await browser.close();
  }
}

module.exports = { scrape, scrapeCreativeDetail };
