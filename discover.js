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
  const capturedRequests = {};

  // Capture GetCreativeById request headers + body to learn exact format
  page.on('request', (request) => {
    if (request.url().includes('GetCreativeById')) {
      capturedRequests[request.url()] = {
        headers: request.headers(),
        postData: request.postData(),
        postDataBuffer: request.postDataBuffer()?.toString('base64'),
      };
    }
  });

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

  // Find and click a Search creative card specifically
  console.log('\n[Finding Search creative card to click...]');
  let searchThumbnailUrl = null;
  if (searchCreativesRaw) {
    try {
      const data = JSON.parse(searchCreativesRaw);
      const searchCreative = (data['1'] || []).find(c => c['4'] === 2);
      if (searchCreative) {
        const html = searchCreative['3']?.['3']?.['2'] || '';
        searchThumbnailUrl = html.match(/src="([^"]+)"/)?.[1] || null;
        console.log(`[Search creative ID: ${searchCreative['2']}, thumbnail: ${searchThumbnailUrl?.slice(0, 60)}...]`);
      }
    } catch (_) {}
  }

  try {
    let clicked = false;
    if (searchThumbnailUrl) {
      // Find the card that contains this thumbnail image
      const cards = await page.$$('a[href*="creative"], button[aria-label], .creative, creative-card');
      console.log(`[Found ${cards.length} potential card elements]`);
      for (const card of cards) {
        const img = await card.$(`img[src*="${searchThumbnailUrl.split('/').pop()}"]`);
        if (img) {
          await card.click();
          console.log('[Clicked Search creative card]');
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) {
      const allCards = await page.$$('a[href*="creative"], button[aria-label], .creative');
      console.log(`[Found ${allCards.length} fallback cards]`);
      if (allCards.length > 0) { await allCards[0].click(); clicked = true; }
    }
    if (clicked) await page.waitForTimeout(4000);
  } catch (e) {
    console.log('[Click failed:', e.message, ']');
  }

  // Print summary of first creative from SearchCreatives
  if (searchCreativesRaw) {
    try {
      const data = JSON.parse(searchCreativesRaw);
      const creatives = data['1'] || [];
      const FORMAT = { 1: 'Display', 2: 'Search', 3: 'YouTube', 4: 'Shopping' };
      console.log(`\n=== SearchCreatives summary: ${creatives.length} creatives ===`);

      // Group by format
      const byFormat = {};
      creatives.forEach(c => {
        const fmt = c['4'] || 'unknown';
        if (!byFormat[fmt]) byFormat[fmt] = [];
        byFormat[fmt].push(c);
      });
      console.log('Formats found:', Object.entries(byFormat).map(([k, v]) => `${FORMAT[k] || k}(${v.length})`).join(', '));

      // Print full structure for each unique format (first creative of each)
      Object.entries(byFormat).forEach(([fmt, list]) => {
        const c = list[0];
        console.log(`\n--- ${FORMAT[fmt] || 'Format ' + fmt} (sample) ---`);
        console.log('  All top-level fields:', Object.keys(c).join(', '));
        Object.entries(c).forEach(([k, v]) => {
          if (k !== '1') { // skip advertiserID
            console.log(`  "${k}":`, JSON.stringify(v).slice(0, 300));
          }
        });
      });
    } catch (e) {
      console.log('Could not parse SearchCreatives JSON:', e.message);
    }
  }

  // Print captured request format
  if (Object.keys(capturedRequests).length > 0) {
    console.log('\n=== GetCreativeById REQUEST FORMAT ===');
    Object.entries(capturedRequests).forEach(([url, req]) => {
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('PostData (text):', req.postData);
      console.log('PostData (base64):', req.postDataBuffer);
    });
    console.log('=====================================');
  }

  // Call GetCreativeById for first Search creative (format "4": 2) to see text structure
  if (searchCreativesRaw) {
    try {
      const data = JSON.parse(searchCreativesRaw);
      const searchCreative = (data['1'] || []).find(c => c['4'] === 2);
      if (searchCreative) {
        const cid = searchCreative['2'];
        console.log(`\n[Fetching GetCreativeById for Search creative: ${cid}]`);
        const raw = await page.evaluate(async ({ advertiserId, creativeId }) => {
          const res = await fetch(
            'https://adstransparency.google.com/anji/_/rpc/LookupService/GetCreativeById?authuser=',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json+protobuf', 'X-Same-Domain': '1' },
              body: JSON.stringify({ "1": advertiserId, "2": creativeId }),
            }
          );
          return res.text();
        }, { advertiserId: ADVERTISER_ID, creativeId: cid });

        console.log('\n=== GetCreativeById for SEARCH creative ===');
        console.log('Length:', raw.length);
        console.log('Full response:', raw);
        console.log('============================================');
        fs.writeFileSync(path.join(__dirname, 'discover-search-detail.json'), raw, 'utf8');
        console.log('[Saved to discover-search-detail.json]');
      } else {
        console.log('\n[No Search creative found in response]');
      }
    } catch (e) {
      console.log('GetCreativeById failed:', e.message);
    }
  }

  console.log(`\n[Total other endpoints captured: ${detailResponses.length}]`);
  await browser.close();
})().catch(err => {
  console.error('Discovery failed:', err.message);
  process.exit(1);
});
