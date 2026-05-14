// src/scraper.js
const { chromium } = require('playwright');

// Update this pattern after running discover.js with a real Advertiser ID
const API_URL_PATTERN = /AdsTTransparencyCenterUi|advertiser.*creative|transparency.*batch/i;
const TIMEOUT_MS = 30000;

async function scrape(advertiserId) {
  const browser = await chromium.launch({ headless: true });
  let rawData = null;
  let intercepted = false; // synchronous flag to prevent duplicate processing

  try {
    const page = await browser.newPage();

    page.on('response', async (response) => {
      if (intercepted) return;
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';
      if (API_URL_PATTERN.test(url) && contentType.includes('json')) {
        intercepted = true;
        try {
          const text = await response.text();
          const json = JSON.parse(text);
          if (json?.creativeGroups || json?.results) {
            rawData = json;
          }
        } catch (_) {
          // body unavailable (redirect, binary, or malformed JSON) — skip silently
          intercepted = false;
        }
      }
    });

    const url = `https://adstransparency.google.com/advertiser/${advertiserId}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT_MS });
    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }

  if (!rawData) {
    throw new Error('NO_DATA');
  }

  return rawData;
}

module.exports = { scrape };
