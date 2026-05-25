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

  const searchCreativesResponses = [];
  const capturedRequests = [];

  // Capture SearchCreatives AND GetCreativeById request bodies
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('SearchCreatives') || url.includes('GetCreativeById')) {
      capturedRequests.push({ url, postData: request.postData() });
      console.log(`\n[REQUEST] ${url.split('/').pop()}`);
      console.log('PostData:', request.postData());
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (!url.includes('anji/_/rpc') && !ct.includes('json')) return;
    if (url.includes('/advertiser/AR') && !url.includes('rpc')) return;

    try {
      const text = await response.text();

      if (url.includes('SearchCreatives')) {
        if (text.length < 5) return;
        const pageIndex = searchCreativesResponses.length;
        searchCreativesResponses.push(text);
        console.log(`\n[SearchCreatives page ${pageIndex + 1} — ${text.length} bytes]`);
        const fname = `discover-search-creatives-page${pageIndex + 1}.json`;
        fs.writeFileSync(path.join(__dirname, fname), text, 'utf8');
        console.log(`[Saved to ${fname}]`);
        try {
          const parsed = JSON.parse(text);
          console.log('Top-level keys:', Object.keys(parsed).join(', '));
          console.log('Creatives count:', parsed["1"]?.length || 0);
          Object.entries(parsed).forEach(([k, v]) => {
            if (k !== "1") console.log(`  Field "${k}":`, JSON.stringify(v).slice(0, 300));
          });
        } catch (_) {}
      } else if (text.length >= 50 && !url.includes('DunsMapping') && !url.includes('GetAsyncData')) {
        console.log('\n=== OTHER ENDPOINT ===', url);
        console.log('Preview:', text.slice(0, 500));
      }
    } catch (_) {}
  });

  const pageUrl = `https://adstransparency.google.com/advertiser/${ADVERTISER_ID}?region=anywhere`;
  console.log('Navigating to:', pageUrl);
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Scroll to trigger page 2+ of SearchCreatives
  console.log('\n[Scrolling to trigger pagination...]');
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    console.log(`  scroll ${i + 1}: ${searchCreativesResponses.length} responses so far`);
    if (searchCreativesResponses.length >= 3) break;
  }
  console.log(`\n[Total SearchCreatives responses captured: ${searchCreativesResponses.length}]`);

  // Print summary across all pages
  let allCreatives = [];
  searchCreativesResponses.forEach((raw, i) => {
    try {
      const data = JSON.parse(raw);
      const creatives = data['1'] || [];
      allCreatives = allCreatives.concat(creatives);
      console.log(`  Page ${i + 1}: ${creatives.length} creatives`);
    } catch (_) {}
  });
  console.log(`  Total across pages: ${allCreatives.length} creatives`);

  if (allCreatives.length > 0) {
    const FORMAT = { 1: 'Display', 2: 'Search', 3: 'YouTube', 4: 'Shopping' };
    const byFormat = {};
    allCreatives.forEach(c => {
      const fmt = FORMAT[c['4']] || `format_${c['4']}`;
      byFormat[fmt] = (byFormat[fmt] || 0) + 1;
    });
    console.log('Formats:', Object.entries(byFormat).map(([k, v]) => `${k}(${v})`).join(', '));
  }

  // Print captured request formats
  console.log('\n=== CAPTURED REQUESTS ===');
  capturedRequests.forEach(r => {
    console.log(`\n${r.url.split('/').pop()}`);
    console.log('PostData:', r.postData);
  });

  // Try calling SearchCreatives directly via page.evaluate to see full request/response
  console.log('\n[Attempting direct SearchCreatives call from browser context...]');
  try {
    const result = await page.evaluate(async (advId) => {
      // Try to replicate what the page does
      const body = new URLSearchParams({
        'f.req': JSON.stringify({ "1": advId }),
      }).toString();
      const res = await fetch('/anji/_/rpc/SearchService/SearchCreatives?authuser=', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Same-Domain': '1',
        },
        body,
      });
      const text = await res.text();
      return { status: res.status, text: text.slice(0, 2000) };
    }, ADVERTISER_ID);
    console.log('Direct call status:', result.status);
    console.log('Direct call response:', result.text);
  } catch (e) {
    console.log('Direct call failed:', e.message);
  }

  await browser.close();
})().catch(err => {
  console.error('Discovery failed:', err.message);
  process.exit(1);
});
