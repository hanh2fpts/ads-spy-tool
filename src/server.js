// src/server.js
const express = require('express');
const path = require('path');
const { scrape, scrapeCreativeDetail, batchFetchFinalUrls } = require('./scraper');
const { parse, parseCreativeDetail } = require('./parser');
const { extractText, parseAdText } = require('./ocr');
const cache = require('./cache');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const ID_REGEX = /^AR\d+$/;

const ERROR_MESSAGES = {
  NO_DATA: 'Không tìm thấy dữ liệu cho ID này.',
  TIMEOUT: 'Hết thời gian chờ, vui lòng thử lại.',
  BLOCKED: 'Google tạm thời chặn, chờ vài phút rồi thử lại.',
  DEFAULT: 'Đã xảy ra lỗi, vui lòng thử lại.',
};

app.post('/api/scrape', async (req, res) => {
  const { advertiserId } = req.body;

  if (!advertiserId || !ID_REGEX.test(advertiserId)) {
    return res.status(400).json({ error: 'Advertiser ID không hợp lệ. Phải có format: AR + số (vd: AR12345678)' });
  }

  const cached = cache.get(advertiserId);
  if (cached) {
    return res.json({ campaigns: cached, fromCache: true });
  }

  try {
    const raw = await scrape(advertiserId);
    const rawCreatives = raw?.["1"] || [];
    const enrichments = await batchFetchFinalUrls(advertiserId, rawCreatives);
    const campaigns = parse(raw, enrichments);
    cache.set(advertiserId, campaigns);
    return res.json({ campaigns, fromCache: false });
  } catch (err) {
    const msg = ERROR_MESSAGES[err.message] || ERROR_MESSAGES.DEFAULT;
    return res.status(502).json({ error: msg });
  }
});

app.get('/api/creative-detail', async (req, res) => {
  const { advertiserId, creativeId } = req.query;
  if (!advertiserId || !ID_REGEX.test(advertiserId)) {
    return res.status(400).json({ error: 'Advertiser ID không hợp lệ.' });
  }
  if (!creativeId || !/^CR\d+$/.test(creativeId)) {
    return res.status(400).json({ error: 'Creative ID không hợp lệ.' });
  }

  const cacheKey = `${advertiserId}:${creativeId}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const raw = await scrapeCreativeDetail(advertiserId, creativeId);
    const detail = parseCreativeDetail(raw);

    // Run OCR on the largest image to extract text content (headlines, descriptions)
    if (detail.images && detail.images.length > 0) {
      const largest = detail.images.reduce((a, b) =>
        (b.width || 0) * (b.height || 0) > (a.width || 0) * (a.height || 0) ? b : a
      );
      const ocrRaw = await extractText(largest.url);
      if (ocrRaw) {
        const { headlines, descriptions } = parseAdText(ocrRaw);
        if (detail.headlines.length === 0) detail.headlines = headlines;
        if (detail.descriptions.length === 0) detail.descriptions = descriptions;
        detail.ocrText = ocrRaw;
      }
    }

    cache.set(cacheKey, detail);
    return res.json(detail);
  } catch (err) {
    return res.status(502).json({ error: 'Không thể tải chi tiết quảng cáo. Vui lòng thử lại.' });
  }
});

app.get('/api/export', (req, res) => {
  const { advertiserId } = req.query;
  if (!advertiserId || !ID_REGEX.test(advertiserId)) {
    return res.status(400).json({ error: 'Advertiser ID không hợp lệ.' });
  }

  const campaigns = cache.get(advertiserId);
  if (!campaigns) {
    return res.status(404).json({ error: 'Không có dữ liệu. Hãy scrape trước.' });
  }

  const header = 'Name,Homepage URL,Start Date,End Date,Is Active,Formats\n';
  const rows = campaigns.map(c => {
    const safeName = c.name.replace(/"/g, '""');
    const safeUrl = (c.homepageUrl || '').replace(/"/g, '""');
    return `"${safeName}","${safeUrl}",${c.startDate || ''},${c.endDate || ''},${c.isActive},${c.formats.join('|')}`;
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${advertiserId}.csv"`);
  return res.send(header + rows);
});

module.exports = app;
