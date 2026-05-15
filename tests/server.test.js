// tests/server.test.js
const request = require('supertest');
const app = require('../src/server');

// Mock ocr to avoid tesseract.js dependency
jest.mock('../src/ocr', () => ({
  extractText: jest.fn().mockResolvedValue(null),
  parseAdText: jest.fn().mockReturnValue({ headlines: [], descriptions: [] }),
}));

// Mock scraper và cache để không cần browser thật
jest.mock('../src/scraper', () => ({
  scrape: jest.fn().mockResolvedValue({
    "1": [
      {
        "1": "AR123456",
        "2": "CR111",
        "3": { "3": { "2": "<img src=\"https://example.com/t.jpg\">" }, "5": true },
        "4": 1,
        "6": { "1": "1735689600" },
        "7": { "1": "1767225600" },
        "12": "TestGame",
        "13": 5
      }
    ]
  }),
  scrapeCreativeDetail: jest.fn(),
  batchFetchFinalUrls: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../src/cache', () => ({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
}));

test('POST /api/scrape trả 200 với data', async () => {
  const res = await request(app)
    .post('/api/scrape')
    .send({ advertiserId: 'AR123456' });
  expect(res.status).toBe(200);
  expect(res.body.campaigns).toHaveLength(1);
  expect(res.body.campaigns[0].name).toBe('TestGame');
});

test('POST /api/scrape trả 400 nếu ID rỗng', async () => {
  const res = await request(app).post('/api/scrape').send({});
  expect(res.status).toBe(400);
  expect(res.body.error).toBeDefined();
});

test('POST /api/scrape trả 400 nếu ID sai format', async () => {
  const res = await request(app)
    .post('/api/scrape')
    .send({ advertiserId: '12345' });
  expect(res.status).toBe(400);
});

test('GET /api/export trả CSV', async () => {
  const cache = require('../src/cache');
  cache.get.mockReturnValue([
    { name: 'TestGame', startDate: '2025-01-01', endDate: null, isActive: true, formats: ['Display'], thumbnailUrl: null }
  ]);
  const res = await request(app)
    .get('/api/export')
    .query({ advertiserId: 'AR123456' });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/csv/);
  expect(res.text).toContain('TestGame');
});

test('POST /api/scrape trả từ cache nếu có', async () => {
  const cache = require('../src/cache');
  cache.get.mockReturnValueOnce([
    { name: 'CachedGame', startDate: '2025-01-01', endDate: null, isActive: true, formats: ['Display'], thumbnailUrl: null }
  ]);
  const res = await request(app)
    .post('/api/scrape')
    .send({ advertiserId: 'AR123456' });
  expect(res.status).toBe(200);
  expect(res.body.fromCache).toBe(true);
  expect(res.body.campaigns[0].name).toBe('CachedGame');
});

test('POST /api/scrape trả 502 khi scraper throw lỗi', async () => {
  const cache = require('../src/cache');
  cache.get.mockReturnValueOnce(null);
  const { scrape } = require('../src/scraper');
  scrape.mockRejectedValueOnce(new Error('NO_DATA'));
  const res = await request(app)
    .post('/api/scrape')
    .send({ advertiserId: 'AR123456' });
  expect(res.status).toBe(502);
  expect(res.body.error).toContain('Không tìm thấy');
});
