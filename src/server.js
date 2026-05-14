// src/server.js
const express = require('express');
const path = require('path');
const { scrape } = require('./scraper');
const { parse } = require('./parser');
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
    const campaigns = parse(raw);
    cache.set(advertiserId, campaigns);
    return res.json({ campaigns, fromCache: false });
  } catch (err) {
    const msg = ERROR_MESSAGES[err.message] || ERROR_MESSAGES.DEFAULT;
    return res.status(502).json({ error: msg });
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

  const header = 'Name,Start Date,End Date,Is Active,Formats\n';
  const rows = campaigns.map(c =>
    `"${c.name}",${c.startDate || ''},${c.endDate || ''},${c.isActive},${c.formats.join('|')}`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${advertiserId}.csv"`);
  return res.send(header + rows);
});

module.exports = app;
