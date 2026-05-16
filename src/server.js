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

const OCR_SKIP = new Set(['sponsored', 'được tài trợ', 'ad', 'quảng cáo', 'advertisement']);

// Extract display URL from OCR text (e.g. "www.fxify.com/" baked into ad preview images).
function extractUrlFromOcrText(rawText) {
  if (!rawText) return null;
  for (let line of rawText.split('\n').map(l => l.trim())) {
    // Strip leading non-URL chars: icons, ®, ^, letters followed by space (e.g. "® ", "a ", "^ ")
    line = line.replace(/^[^a-z0-9]+/i, '').trim();
    // Normalize OCR artifact "www. domain.com" → "www.domain.com"
    line = line.replace(/^(www)\.\s+/i, 'www.');
    if (!line || line.includes(' ') || line.includes('@')) continue;
    // Match: one or more subdomain parts + TLD, optional path (e.g. app.tradesyncer.com, www.fxify.com/)
    if (!/^([a-z0-9][a-z0-9-]*\.)+[a-z]{2,6}(\/\S*)?$/i.test(line)) continue;
    try {
      const href = `https://${line.replace(/\/$/, '')}`;
      return new URL(href).href;
    } catch (_) {}
  }
  return null;
}

// Extract a clean brand name from OCR text. Returns null if nothing usable.
function extractNameFromOcrText(rawText) {
  if (!rawText) return null;
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  for (const line of lines) {
    if (line.includes('/') || line.includes('http')) continue;
    if (/^\d+$/.test(line)) continue;
    if (OCR_SKIP.has(line.toLowerCase())) continue;
    // Skip domain-like strings (contain a dot followed by 2-4 letter TLD)
    if (/\.[a-z]{2,4}(\b|$)/i.test(line)) continue;
    // Strip leading single-char OCR artifacts (e.g. icon read as "a FXIFY" → "FXIFY")
    const cleaned = line.replace(/^[a-z®©^•\-–]\s+/i, '').trim();
    const alpha = cleaned.replace(/[^a-zA-ZÀ-ỹ]/g, '');
    if (alpha.length < 3) continue;
    return cleaned.length > 40 ? cleaned.slice(0, 40).trim() : cleaned;
  }
  return null;
}

// Run OCR on thumbnails to derive project names. Updates campaign.name in-place.
// thumbnailBuffers: Map<url, Buffer> pre-fetched by the Playwright browser session.
async function enrichNamesFromOCR(campaigns, thumbnailBuffers = new Map()) {
  const urlToIndices = new Map();
  campaigns.forEach((c, i) => {
    if (!c.thumbnailUrl) return;
    if (!urlToIndices.has(c.thumbnailUrl)) urlToIndices.set(c.thumbnailUrl, []);
    urlToIndices.get(c.thumbnailUrl).push(i);
  });

  for (const [url, indices] of urlToIndices) {
    try {
      const imageData = thumbnailBuffers.has(url) ? thumbnailBuffers.get(url) : url;
      const rawText = await extractText(imageData);
      console.log(`[OCR] raw text: ${JSON.stringify(rawText?.slice(0, 200))}`);
      const name = extractNameFromOcrText(rawText);
      const ocrUrl = extractUrlFromOcrText(rawText);
      console.log(`[OCR] → name="${name}" url="${ocrUrl}"`);
      if (name) {
        for (const i of indices) campaigns[i].name = name;
      }
      if (ocrUrl) {
        for (const i of indices) {
          if (!campaigns[i].homepageUrl) campaigns[i].homepageUrl = ocrUrl;
        }
      }
    } catch (err) {
      console.warn(`[OCR] failed ${url.slice(0, 80)}: ${err.message}`);
    }
  }
  return campaigns;
}

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
    const [raw, thumbnailBuffers] = await scrape(advertiserId);
    const rawCreatives = raw?.["1"] || [];
    const enrichments = await batchFetchFinalUrls(advertiserId, rawCreatives);
    const campaigns = parse(raw, enrichments);
    await enrichNamesFromOCR(campaigns, thumbnailBuffers);
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

app.post('/api/clear-cache', (req, res) => {
  const { advertiserId } = req.body;
  if (!advertiserId || !ID_REGEX.test(advertiserId)) {
    return res.status(400).json({ error: 'Advertiser ID không hợp lệ.' });
  }
  cache.clear(advertiserId);
  return res.json({ ok: true });
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

  function calcDays(startDate, endDate) {
    if (!startDate) return '';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : '';
  }

  const header = 'Name,Homepage URL,Start Date,End Date,Days,Is Active,Formats,Ad Link\n';
  const rows = campaigns.map(c => {
    const safeName = c.name.replace(/"/g, '""');
    const safeUrl = (c.homepageUrl || '').replace(/"/g, '""');
    const days = calcDays(c.startDate, c.endDate);
    const adLink = c.creativeId
      ? `https://adstransparency.google.com/advertiser/${advertiserId}/creative/${c.creativeId}?region=anywhere`
      : '';
    return `"${safeName}","${safeUrl}",${c.startDate || ''},${c.endDate || ''},${days},${c.isActive},${c.formats.join('|')},"${adLink}"`;
  }).join('\n');

  const BOM = '﻿';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${advertiserId}.csv"`);
  return res.send(BOM + header + rows);
});

module.exports = app;
