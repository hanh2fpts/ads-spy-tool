const Tesseract = require('tesseract.js');

// Persistent worker reused across requests to avoid reload overhead (~2-3s startup)
let _worker = null;

async function getWorker() {
  if (!_worker) {
    _worker = await Tesseract.createWorker(['vie', 'eng'], 1, {
      logger: () => {}, // suppress progress logs
    });
  }
  return _worker;
}

// Extract text from an image URL or Buffer. Returns empty string on failure.
async function extractText(input) {
  try {
    const worker = await getWorker();
    // Pre-fetch URLs as Buffer so Tesseract doesn't deal with CDN auth quirks
    let data = input;
    if (typeof input === 'string' && input.startsWith('http')) {
      const res = await fetch(input, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
      });
      if (!res.ok) return '';
      data = Buffer.from(await res.arrayBuffer());
    }
    const { data: { text } } = await worker.recognize(data);
    return text.trim();
  } catch (_) {
    return '';
  }
}

// Parse raw OCR text from a search ad screenshot into structured fields.
// Search ad layout: headline line(s) at top, description below.
function parseAdText(rawText) {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const headlines = [];
  const descriptions = [];

  for (const line of lines) {
    // Short lines at the top are typically headlines (ads limit headlines to ~30 chars each)
    // Multiple headlines may appear on one line separated by " | " or " - "
    if (headlines.length === 0 || (line.length <= 90 && descriptions.length === 0)) {
      // Split on common headline separators
      const parts = line.split(/\s*[|·—]\s*/).filter(p => p.length > 1);
      headlines.push(...parts);
    } else {
      descriptions.push(line);
    }
  }

  return { headlines, descriptions };
}

module.exports = { extractText, parseAdText };
