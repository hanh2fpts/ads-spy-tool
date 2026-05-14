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
