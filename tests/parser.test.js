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
  expect(first).toHaveProperty('startDate');
  expect(first).toHaveProperty('endDate');
  expect(first).toHaveProperty('isActive');
  expect(first).toHaveProperty('formats');
  expect(first).toHaveProperty('thumbnailUrl');
});

test('campaign đang chạy có isActive=true và endDate=null', () => {
  const result = parser.parse(sampleResponse);
  const active = result.find(c => c.name === 'Dragon & Hero');
  expect(active.isActive).toBe(true);
  expect(active.endDate).toBeNull();
  expect(active.startDate).toBe('2025-01-01');
});

test('campaign đã tắt có isActive=false và endDate đúng', () => {
  const result = parser.parse(sampleResponse);
  const inactive = result.find(c => c.name === 'TriDom');
  expect(inactive.isActive).toBe(false);
  expect(inactive.endDate).toBe('2024-12-30');
});

test('formats được map đúng', () => {
  const result = parser.parse(sampleResponse);
  const first = result[0];
  expect(first.formats).toContain('Display');
  expect(first.formats).toContain('Search');
});

test('parse trả mảng rỗng nếu không có data', () => {
  expect(parser.parse({})).toEqual([]);
  expect(parser.parse({ creativeGroups: [] })).toEqual([]);
});
