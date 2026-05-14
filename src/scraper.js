// src/scraper.js
const { chromium } = require('playwright');

// Thay pattern này sau khi chạy discovery
const API_URL_PATTERN = /AdsTTransparencyCenterUi|advertiser.*creative|transparency.*batch/i;
const TIMEOUT_MS = 30000;

async function scrape(advertiserId) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let rawData = null;

  page.on('response', async (response) => {
    if (rawData) return; // chỉ lấy lần đầu
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    if (API_URL_PATTERN.test(url) && contentType.includes('json')) {
      try {
        const text = await response.text();
        const json = JSON.parse(text);
        if (json?.creativeGroups || json?.results) {
          rawData = json;
        }
      } catch (_) {}
    }
  });

  try {
    const url = `https://adstransparency.google.com/advertiser/${advertiserId}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT_MS });
    await page.waitForTimeout(3000); // chờ lazy load
  } finally {
    await browser.close();
  }

  if (!rawData) {
    throw new Error('NO_DATA'); // frontend sẽ hiện thông báo phù hợp
  }

  return rawData;
}

module.exports = { scrape };
