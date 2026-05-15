// tests/parser.test.js
const parser = require('../src/parser');
const sampleResponse = require('./fixtures/sample-response.json');

test('parse trả về mảng AdCampaign', () => {
  const result = parser.parse(sampleResponse);
  expect(Array.isArray(result)).toBe(true);
  expect(result.length).toBe(2);
});

test('mỗi campaign có đủ fields', () => {
  const result = parser.parse(sampleResponse);
  const first = result[0];
  expect(first).toHaveProperty('name');
  expect(first).toHaveProperty('creativeId');
  expect(first).toHaveProperty('startDate');
  expect(first).toHaveProperty('endDate');
  expect(first).toHaveProperty('isActive');
  expect(first).toHaveProperty('formats');
  expect(first).toHaveProperty('thumbnailUrl');
});

test('campaign đang chạy có isActive=true', () => {
  const result = parser.parse(sampleResponse);
  const active = result[0];
  expect(active.isActive).toBe(true);
  expect(active.startDate).toBe('2026-01-05');
});

test('campaign đã tắt có isActive=false', () => {
  const result = parser.parse(sampleResponse);
  const inactive = result[1];
  expect(inactive.isActive).toBe(false);
  expect(inactive.endDate).toBe('2025-06-30');
});

test('formats được map đúng', () => {
  const result = parser.parse(sampleResponse);
  expect(result[0].formats).toContain('Display');
  expect(result[1].formats).toContain('YouTube');
});

test('thumbnail URL được trích xuất từ img tag', () => {
  const result = parser.parse(sampleResponse);
  expect(result[0].thumbnailUrl).toContain('tpc.googlesyndication.com');
});

test('parse trả mảng rỗng nếu không có data', () => {
  expect(parser.parse({})).toEqual([]);
  expect(parser.parse({ "1": [] })).toEqual([]);
});

test('parse thêm homepageUrl=null khi không có enrichment', () => {
  const result = parser.parse(sampleResponse);
  expect(result[0]).toHaveProperty('homepageUrl');
  expect(result[0].homepageUrl).toBeNull();
});

test('parse dùng domain từ homepageUrl làm name khi có enrichment', () => {
  const enrichments = new Map([
    [sampleResponse["1"][0]["2"], 'https://mybrand.com/lp?ref=google']
  ]);
  const result = parser.parse(sampleResponse, enrichments);
  expect(result[0].name).toBe('mybrand.com');
  expect(result[0].homepageUrl).toBe('https://mybrand.com/lp?ref=google');
});

test('parse fallback về c["12"] khi enrichment null', () => {
  const enrichments = new Map([[sampleResponse["1"][0]["2"], null]]);
  const result = parser.parse(sampleResponse, enrichments);
  expect(result[0].name).toBe(sampleResponse["1"][0]["12"]);
  expect(result[0].homepageUrl).toBeNull();
});

test('parseCreativeDetail trả về homepageUrl khi có URL trong variant', () => {
  const raw = {
    "1": {
      "1": "AR1", "2": "CR1",
      "5": [
        { "1": { "2": "https://example.com/landing" } }
      ]
    }
  };
  const result = parser.parseCreativeDetail(raw);
  expect(result.homepageUrl).toBe('https://example.com/landing');
});

test('parseCreativeDetail không lấy thumbnail/preview URLs làm homepageUrl', () => {
  const raw = {
    "1": {
      "1": "AR1", "2": "CR1",
      "5": [
        {
          "1": {
            "4": "https://displayads-formats.googleusercontent.com/preview?foo=bar",
            "2": "https://mybrand.com/real-landing"
          }
        }
      ]
    }
  };
  const result = parser.parseCreativeDetail(raw);
  expect(result.homepageUrl).toBe('https://mybrand.com/real-landing');
});

test('parseCreativeDetail trả về homepageUrl=null khi không có URL', () => {
  const raw = { "1": { "1": "AR1", "2": "CR1", "5": [] } };
  const result = parser.parseCreativeDetail(raw);
  expect(result.homepageUrl).toBeNull();
});
