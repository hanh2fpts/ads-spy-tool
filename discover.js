const { chromium } = require('playwright');

const ADVERTISER_ID = process.argv[2] || 'AR12345678'; // thay bằng ID thật

// NOTE: Khi chạy với ID thật, tìm các endpoint có dạng:
//   - https://adstransparency.google.com/api/...
//   - Các response chứa "creatives", "campaigns", "ads" trong JSON
// Endpoint đó sẽ được dùng trong scraper chính (Task 5).

(async () => {
  const browser = await chromium.launch({ headless: false }); // headless: false để quan sát
  const page = await browser.newPage();

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('json') || url.includes('Transparency') || url.includes('advertiser')) {
      try {
        const text = await response.text();
        if (text.length > 100 && text.length < 500000) {
          console.log('\n=== RESPONSE ===');
          console.log('URL:', url);
          console.log('Preview:', text.slice(0, 300));
          console.log('================');
        }
      } catch (_) {}
    }
  });

  const url = `https://adstransparency.google.com/advertiser/${ADVERTISER_ID}`;
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);

  await browser.close();
})();
