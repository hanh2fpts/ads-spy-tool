// tests/server.test.js
const request = require('supertest');
const app = require('../src/server');

// Mock scraper và cache để không cần browser thật
jest.mock('../src/scraper', () => ({
  scrape: jest.fn().mockResolvedValue({ creativeGroups: [
    {
      advertiserName: 'TestGame',
      firstShownDate: { year: 2025, month: 1, day: 1 },
      lastShownDate: null,
      adTypes: ['DISPLAY'],
      thumbnailUrl: 'https://example.com/thumb.jpg',
    }
  ]})
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
