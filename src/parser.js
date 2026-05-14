// src/parser.js
const FORMAT_MAP = {
  DISPLAY: 'Display',
  SEARCH: 'Search',
  VIDEO: 'YouTube',
  SHOPPING: 'Shopping',
};

function formatDate({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parse(raw) {
  const groups = raw?.creativeGroups || [];
  return groups.map((g) => ({
    name: g.advertiserName || 'Unknown',
    startDate: g.firstShownDate ? formatDate(g.firstShownDate) : null,
    endDate: g.lastShownDate ? formatDate(g.lastShownDate) : null,
    isActive: g.lastShownDate == null,
    formats: (g.adTypes || []).map((t) => FORMAT_MAP[t] || t),
    thumbnailUrl: g.thumbnailUrl || null,
  }));
}

module.exports = { parse };
