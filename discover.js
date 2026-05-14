const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ADVERTISER_ID = process.argv[2] || 'AR12345678';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let searchCreativesRaw = null;
  const detailResponses = [];

  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (!url.includes('anji/_/rpc') && !ct.includes('json')) return;
    if (url.includes('/advertiser/AR')) return; // skip main HTML

    try {
      const text = await response.text();
      if (text.length < 50) return;

      if (url.includes('SearchCreatives') && !searchCreativesRaw) {
        searchCreativesRaw = text;
        console.log(`\n[SearchCreatives captured — ${text.length} bytes]`);
        fs.writeFileSync(path.join(__dirname, 'discover-search-creatives.json'), text, 'utf8');
        console.log('[Saved to discover-search-creatives.json]');
      } else if (!url.includes('SearchCreatives') && !url.includes('DunsMapping') && !url.includes('GetAsyncData')) {
        detailResponses.push({ url, length: text.length, preview: text.slice(0, 800) });
        console.log('\n=== OTHER ENDPOINT ===');
        console.log('URL:', url);
        console.log('Length:', text.length);
        console.log('Preview:', text.slice(0, 800));
        console.log('=====================');
      }
    } catch (_) {}
  });

  const pageUrl = `https://adstransparency.google.com/advertiser/${ADVERTISER_ID}`;
  console.log('Navigating to:', pageUrl);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Click the first ad card to see if a detail endpoint is triggered
  console.log('\n[Trying to click first ad card...]');
  try {
    // ATC renders ad cards as clickable containers
    const card = await page.$('creative-card, [data-creative-id], .creative-preview, mat-card, .ads-creative-card');
    if (card) {
      await card.click();
      console.log('[Clicked a card — waiting for detail response...]');
      await page.waitForTimeout(4000);
    } else {
      // Try finding any clickable element in the ad grid
      const allCards = await page.$$('a[href*="creative"], button[aria-label], .creative');
      console.log(`[Found ${allCards.length} potential card elements]`);
      if (allCards.length > 0) {
        await allCards[0].click();
        await page.waitForTimeout(4000);
      }
    }
  } catch (e) {
    console.log('[Click failed:', e.message, ']');
  }

  // Print summary of first creative from SearchCreatives
  if (searchCreativesRaw) {
    try {
      const data = JSON.parse(searchCreativesRaw);
      const creatives = data['1'] || [];
      console.log(`\n=== SearchCreatives summary: ${creatives.length} creatives ===`);
      creatives.slice(0, 3).forEach((c, i) => {
        console.log(`\nCreative #${i + 1}:`);
        console.log('  Fields present:', Object.keys(c).join(', '));
        console.log('  field "3" keys:', c['3'] ? Object.keys(c['3']).join(', ') : 'none');
        if (c['3']) {
          Object.entries(c['3']).forEach(([k, v]) => {
            console.log(`  "3"."${k}":`, JSON.stringify(v).slice(0, 200));
          });
        }
      });
    } catch (e) {
      console.log('Could not parse SearchCreatives JSON:', e.message);
    }
  }

  console.log(`\n[Total other endpoints captured: ${detailResponses.length}]`);
  await browser.close();
})().catch(err => {
  console.error('Discovery failed:', err.message);
  process.exit(1);
});
